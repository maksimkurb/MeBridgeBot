import Telegraf from 'telegraf'
import LRU from 'lru'
import { LRU_CACHE_MAXAGE } from '../utils'

import BaseProvider from './BaseProvider.js'
import { format } from '../format.js'
import Message from '../message.js'

class Telegram extends BaseProvider {
  constructor (token, options) {
    super()

    this.titlesCache = new LRU({
      max: 256,
      maxAge: LRU_CACHE_MAXAGE
    })

    this.PROVIDER = 'tg'
    this.api = new Telegraf(token, options)
    this.api.command('start', this.cmdConnectionFromLeft)
    this.api.command('connect', this.cmdConnectionToRight)
    this.api.command('list', this.cmdList)
    this.api.hears(/^\/disconnect[_ ]\d+/, this.cmdDisconnect)
    this.api.on('message', this.onMessage)
    this.api.startPolling()
  }

  async getChatTitle (ctx, originChatId) {
    if (this.titlesCache.peek(originChatId)) {
      return this.titlesCache.get(originChatId)
    }
    if (ctx.chat.id === originChatId) {
      this.titlesCache.set(originChatId, ctx.chat.title)
      return ctx.chat.title
    }
    const chat = await ctx.telegram.getChat(originChatId)
    this.titlesCache.set(originChatId, chat.title)
    return chat.title
  }

  async extractMessage (ctx, needChatTitle) {
    const msg = ctx.update.message
    return new Message({
      provider: this.PROVIDER,
      originChatId: msg.chat.id,
      originSenderId: msg.from.id,
      ...(needChatTitle ? {chatTitle: await this.getChatTitle(ctx, msg.chat.id)} : {}),
      fullname: `${msg.from.first_name} ${msg.from.last_name}`,
      ...(msg.from.username ? {url: `https://t.me/${msg.from.username}`, username: msg.from.username} : {}),
      text: msg.text,
      date: msg.date
    })
  }

  async sendMessage (chatId, message) {
    return this.api.telegram.sendMessage(chatId, (message instanceof Message) ? format(message) : message)
  }
}

export default Telegram
