import VKApi from 'node-vk-bot-api'
import LRU from 'lru'
import { LRU_CACHE_MAXAGE } from '../utils'

import BaseProvider from './BaseProvider.js'
import Message from '../message'
import { format } from '../format.js'

class VK extends BaseProvider {
  constructor (token, groupId) {
    super()

    this.fullnamesCache = new LRU({
      max: 8192,
      maxAge: LRU_CACHE_MAXAGE
    })
    this.titlesCache = new LRU({
      max: 256,
      maxAge: LRU_CACHE_MAXAGE
    })

    this.PROVIDER = 'vk'
    this.api = new VKApi({
      token,
      group_id: groupId
    })
    this.api.command('/start', this.cmdConnectionFromLeft)
    this.api.command('/connect', this.cmdConnectionToRight)
    this.api.command('/list', this.cmdList)
    this.api.command('/disconnect', this.cmdDisconnect)
    this.api.use((ctx) => {
      if (ctx.message.type === 'message_new') {
        this.onMessage(ctx)
      }
    })
    this.api.startPolling()
  }

  async fetchUserInfo (ctx, userId) {
    return new Promise((resolve) => {
      if (this.fullnamesCache.peek(userId) !== undefined) {
        resolve(this.fullnamesCache.get(userId))
        return
      }
      ctx.bot.execute('users.get', {
        user_ids: userId,
        name_case: 'nom',
        fields: 'domain'
      }, (res) => {
        if (res && res[0]) {
          const info = {
            fullname: `${res[0].first_name} ${res[0].last_name}`,
            domain: res[0].domain
          }
          this.fullnamesCache.set(userId, info)
          resolve(info)
        } else {
          resolve({
            fullname: `id${userId}`
          })
        }
      })
    })
  }

  async getChatTitle (ctx, originChatId) {
    return new Promise((resolve) => {
      if (this.titlesCache.peek(originChatId)) {
        resolve(this.titlesCache.get(originChatId))
        return
      }
      ctx.bot.execute('messages.getChat', {
        chat_id: originChatId
      }, (res) => {
        if (res) {
          this.titlesCache.set(originChatId, res.title)
          resolve(res.title)
        } else {
          resolve(`#${originChatId}`)
        }
      })
    })
  }

  async extractMessage (ctx, needChatTitle = false) {
    const userInfo = await this.fetchUserInfo(ctx, ctx.message.from_id)
    return new Message({
      provider: 'vk',
      originChatId: ctx.message.peer_id,
      originSenderId: ctx.message.from_id,
      ...(needChatTitle ? {chatTitle: `#${ctx.message.peer_id}`} : {}),
      fullname: userInfo.fullname,
      username: userInfo.domain,
      url: `https://vk.com/id${ctx.message.from_id}`,
      text: ctx.message.text,
      date: ctx.message.date
    // attachments
    })
  }

  async execute (method, settings, cb) {
    const args = Object.assign({}, {v: '5.80'}, settings)
    return this.api.execute(method, args, cb)
  }

  async sendMessage (chatId, message) {
    return this.execute('messages.send', {
      peer_id: chatId,
      message: (message instanceof Message) ? format(message) : message
    })
  }
}

export default VK
