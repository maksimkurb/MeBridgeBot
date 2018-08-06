import Telegraf from 'telegraf'

import BaseProvider from './BaseProvider.js'
import { formatForTelegram } from '../format.js'
import Message from '../message.js'

function message (ctx) {
  console.log(ctx)
  const msg = ctx.update.message
  return new Message({
    provider: 'telegram',
    originChatId: msg.chat.id,
    originSenderId: msg.from.id,
    fullname: `${msg.from.first_name} ${msg.from.last_name}`,
    ...(msg.from.username ? {url: `https://t.me/${msg.from.username}`} : {}),
    text: msg.text,
    date: msg.date
  })
}

class Telegram extends BaseProvider {
  constructor (token, options) {
    super()
    this._onMessage = this._onMessage.bind(this)

    this.api = new Telegraf(token, options)
    this.api.on('message', this._onMessage)
    this.api.startPolling()
  }

  _onMessage (ctx) {
    const msg = message(ctx)
    this.eventListeners.message.forEach(cb => {
      cb(msg, ctx)
    })
  }

  sendMessage (chatId, message) {
    if (!(message instanceof Message)) throw new Error('message argument in sendMessage() must be an instance of Message class')
    return this.api.telegram.sendMessage(chatId, formatForTelegram(message), {
      parse_mode: 'HTML'
    })
  }
}

export default Telegram
