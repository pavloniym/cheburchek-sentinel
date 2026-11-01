import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export type Monitor = {
  chat_id: number
  domain: string
  interval_seconds: number
  next_check_at: number
  last_checked_at: number | null
  last_state: string | null
  last_details: string | null
}

export class Storage {
  private readonly db: Database

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true })
    this.db = new Database(path, { create: true })
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec(`CREATE TABLE IF NOT EXISTS monitors (
      chat_id INTEGER NOT NULL,
      domain TEXT NOT NULL,
      interval_seconds INTEGER NOT NULL,
      next_check_at INTEGER NOT NULL,
      last_checked_at INTEGER,
      last_state TEXT,
      last_details TEXT,
      PRIMARY KEY (chat_id, domain)
    )`)
    this.db.exec('CREATE INDEX IF NOT EXISTS monitors_due ON monitors(next_check_at)')
  }

  add(chatId: number, domain: string, intervalSeconds: number): boolean {
    const result = this.db.query('INSERT OR IGNORE INTO monitors (chat_id, domain, interval_seconds, next_check_at) VALUES (?, ?, ?, ?)')
      .run(chatId, domain, intervalSeconds, Math.floor(Date.now() / 1000))
    return result.changes > 0
  }

  remove(chatId: number, domain: string): boolean {
    return this.db.query('DELETE FROM monitors WHERE chat_id = ? AND domain = ?').run(chatId, domain).changes > 0
  }

  setInterval(chatId: number, domain: string, seconds: number): boolean {
    const now = Math.floor(Date.now() / 1000)
    return this.db.query('UPDATE monitors SET interval_seconds = ?, next_check_at = ? WHERE chat_id = ? AND domain = ?')
      .run(seconds, now + seconds, chatId, domain).changes > 0
  }

  list(chatId: number): Monitor[] {
    return this.db.query('SELECT * FROM monitors WHERE chat_id = ? ORDER BY domain').all(chatId) as Monitor[]
  }

  nextDue(): Monitor | null {
    return this.db.query('SELECT * FROM monitors WHERE next_check_at <= ? ORDER BY next_check_at LIMIT 1')
      .get(Math.floor(Date.now() / 1000)) as Monitor | null
  }

  finish(monitor: Monitor, state: string | null, details: string | null): void {
    const now = Math.floor(Date.now() / 1000)
    this.db.query(`UPDATE monitors SET next_check_at = ?, last_checked_at = ?,
      last_state = COALESCE(?, last_state), last_details = COALESCE(?, last_details)
      WHERE chat_id = ? AND domain = ?`)
      .run(now + monitor.interval_seconds, now, state, details, monitor.chat_id, monitor.domain)
  }
}
