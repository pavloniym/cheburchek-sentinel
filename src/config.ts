export const config = {
  token: Bun.env.TELEGRAM_BOT_TOKEN ?? '',
  baseUrl: (Bun.env.CHEBURCHECK_BASE_URL ?? 'https://cheburcheck.ru').replace(/\/$/, ''),
  databasePath: Bun.env.DATABASE_PATH ?? './data/bot.sqlite',
}

if (!config.token) throw new Error('TELEGRAM_BOT_TOKEN is required')
