import HttpsProxyAgent from 'https-proxy-agent'
import './db'

import VK from './providers/VK'
import Telegram from './providers/Telegram'

export const BOT_NAME = process.env.BOT_NAME || 'MeBridgeBot'

const vk = new VK(process.env.VK_TOKEN, process.env.VK_GROUP_ID)

const telegram = new Telegram(process.env.TELEGRAM_TOKEN, {
  telegram: {
    apiRoot: process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org',
    ...(process.env.TELEGRAM_PROXY ? {agent: new HttpsProxyAgent(process.env.TELEGRAM_PROXY)} : {})
  }})

vk.addEventListener('message', (provider, msg, ctx) => {
  if (ctx.message.from_id < 1) {
    // Do not answer to bot messages
    return
  }
  telegram.sendMessage(321422789, msg)
})

telegram.addEventListener('message', (provider, msg, ctx) => {
  vk.sendMessage(2000000001, msg)
})
