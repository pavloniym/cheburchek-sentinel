import type { Bot } from 'grammy'
import type { CheburcheckClient } from './cheburcheck'
import type { Storage } from './storage'

const CHECK_GAP_MS = 15000

export const startScheduler = (bot: Bot, storage: Storage, client: CheburcheckClient): void => {
  let isRunning = false
  const run = async () => {
    if (isRunning) return
    const monitor = storage.nextDue()
    if (!monitor) return
    isRunning = true

    try {
      const result = await client.check(monitor.domain)
      const shouldNotify = result.state === 'blocked'
        ? monitor.last_state !== 'blocked'
        : result.state === 'clear' && monitor.last_state === 'blocked'
      if (shouldNotify) {
        const message = result.state === 'blocked'
          ? `⚠️ ${monitor.domain}: обнаружены признаки блокировки.\n${result.details}`
          : `✅ ${monitor.domain}: блокировка больше не обнаружена.\n${result.details}`
        await bot.api.sendMessage(monitor.chat_id, message)
      }
      storage.finish(monitor, result.state === 'unknown' ? null : result.state, result.details)
    } catch (error) {
      storage.finish(monitor, null, null)
      console.error(`Check failed for ${monitor.domain}:`, error)
    } finally {
      isRunning = false
    }
  }

  void run()
  setInterval(() => void run(), CHECK_GAP_MS)
}
