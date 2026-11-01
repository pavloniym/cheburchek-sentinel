import { createBot } from './bot'
import { CheburcheckClient } from './cheburcheck'
import { config } from './config'
import { startScheduler } from './scheduler'
import { Storage } from './storage'

const storage = new Storage(config.databasePath)
const bot = createBot(config.token, storage)
const client = new CheburcheckClient(config.baseUrl)

startScheduler(bot, storage, client)
void bot.start({ onStart: () => console.log('Bot started') })
