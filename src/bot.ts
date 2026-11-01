import { Bot } from 'grammy'
import { normalizeDomain, parseInterval } from './domains'
import type { Storage } from './storage'

const HELP = [
  'Мониторинг блокировок доменов:',
  '/add example.com 1h — добавить (интервал от 5m до 7d)',
  '/remove example.com — удалить',
  '/interval example.com 30m — изменить интервал',
  '/list — домены и последний результат',
  '/status example.com — состояние домена',
].join('\n')

const splitArgs = (text: string): string[] => text.trim().split(/\s+/).slice(1)
const formatMonitor = (monitor: ReturnType<Storage['list']>[number]): string => {
  const checked = monitor.last_checked_at ? new Date(monitor.last_checked_at * 1000).toISOString() : 'ещё не проверялся'
  return `${monitor.domain} · ${monitor.interval_seconds / 60} мин · ${monitor.last_state ?? 'ожидает проверки'}\n${monitor.last_details ?? ''}\nПроверено: ${checked}`
}

export const createBot = (token: string, storage: Storage): Bot => {
  const bot = new Bot(token)

  bot.command(['start', 'help'], async (ctx) => ctx.reply(HELP))

  bot.command('add', async (ctx) => {
    const [rawDomain, rawInterval = '1h'] = splitArgs(ctx.msg?.text ?? '')
    const domain = rawDomain && normalizeDomain(rawDomain)
    const interval = parseInterval(rawInterval)
    if (!domain || !interval) return ctx.reply('Формат: /add example.com 1h. Интервал: 5m–7d.')
    const added = storage.add(ctx.chat.id, domain, interval)
    return ctx.reply(added ? `${domain} добавлен. Первая проверка начнётся в ближайшее время.` : `${domain} уже отслеживается.`)
  })

  bot.command('remove', async (ctx) => {
    const [rawDomain] = splitArgs(ctx.msg?.text ?? '')
    const domain = rawDomain && normalizeDomain(rawDomain)
    if (!domain) return ctx.reply('Формат: /remove example.com')
    return ctx.reply(storage.remove(ctx.chat.id, domain) ? `${domain} удалён.` : `${domain} не найден.`)
  })

  bot.command('interval', async (ctx) => {
    const [rawDomain, rawInterval] = splitArgs(ctx.msg?.text ?? '')
    const domain = rawDomain && normalizeDomain(rawDomain)
    const interval = rawInterval && parseInterval(rawInterval)
    if (!domain || !interval) return ctx.reply('Формат: /interval example.com 30m. Интервал: 5m–7d.')
    return ctx.reply(storage.setInterval(ctx.chat.id, domain, interval) ? `Интервал ${domain} изменён.` : `${domain} не найден.`)
  })

  bot.command('list', async (ctx) => {
    const monitors = storage.list(ctx.chat.id)
    return ctx.reply(monitors.length ? monitors.map(formatMonitor).join('\n\n').slice(0, 4000) : 'Нет отслеживаемых доменов. Добавьте: /add example.com 1h')
  })

  bot.command('status', async (ctx) => {
    const [rawDomain] = splitArgs(ctx.msg?.text ?? '')
    const domain = rawDomain && normalizeDomain(rawDomain)
    if (!domain) return ctx.reply('Формат: /status example.com')
    const monitor = storage.list(ctx.chat.id).find((item) => item.domain === domain)
    return ctx.reply(monitor ? formatMonitor(monitor) : `${domain} не найден.`)
  })

  bot.catch((error) => console.error('Telegram update failed:', error))
  return bot
}
