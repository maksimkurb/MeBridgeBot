import Telegraf from 'telegraf'

import BaseProvider from './BaseProvider.js'
import { formatForTelegram } from '../format.js'
import Message from '../message.js'

class Telegram extends BaseProvider {
  constructor (token, options) {
    super()

    this.PROVIDER = 'tg'
    this.api = new Telegraf(token, options)
    this.api.on('message', this.onMessage)
    this.api.startPolling()
  }

  extractMessage (ctx) {
    const msg = ctx.update.message
    return new Message({
      provider: this.PROVIDER,
      originChatId: msg.chat.id,
      originSenderId: msg.from.id,
      fullname: `${msg.from.first_name} ${msg.from.last_name}`,
      ...(msg.from.username ? {url: `https://t.me/${msg.from.username}`} : {}),
      text: msg.text,
      date: msg.date
    })
  }

  sendMessage (chatId, message) {
    return this.api.telegram.sendMessage(chatId, (message instanceof Message) ? formatForTelegram(message) : message, {
      parse_mode: 'HTML'
    })
  }
}

export default Telegram
