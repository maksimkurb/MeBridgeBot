import VKApi from 'node-vk-bot-api'

import BaseProvider from './BaseProvider.js'
import Message from '../message'
import { formatForVk } from '../format.js'

class VK extends BaseProvider {
  constructor (token, groupId) {
    super()

    this.fullnamesCache = {}

    this.PROVIDER = 'vk'
    this.api = new VKApi({
      token,
      group_id: groupId
    })
    this.api.command('/start', this.performConnectionFromLeft)
    this.api.command('/connect', this.performConnectionToRight)
    this.api.use((ctx) => {
      if (ctx.message.type === 'message_new') {
        this.onMessage(ctx)
      }
    })
    this.api.startPolling()
  }

  fetchUsername (ctx) {
    console.log(ctx)
    return new Promise((resolve) => {
      if (this.fullnamesCache[ctx.message.from_id]) {
        resolve(this.fullnamesCache[ctx.message.from_id])
        return
      }
      ctx.bot.execute('users.get', {
        user_ids: ctx.message.from_id,
        name_case: 'nom'
      }, (res) => {
        if (res && res[0]) {
          this.fullnamesCache[ctx.message.from_id] = `${res[0].first_name} ${res[0].last_name}`
          resolve(this.fullnamesCache[ctx.message.from_id])
        } else {
          resolve(ctx.message.from_id)
        }
      })
    })
  }

  async extractMessage (ctx) {
    return new Message({
      provider: 'vk',
      originChatId: ctx.message.peer_id,
      originSenderId: ctx.message.from_id,
      fullname: await this.fetchUsername(ctx),
      url: `https://vk.com/id${ctx.message.from_id}`,
      text: ctx.message.text,
      date: ctx.message.date
    // attachments
    })
  }

  execute (method, settings, cb) {
    const args = Object.assign({}, {v: '5.80'}, settings)
    return this.api.execute(method, args, cb)
  }

  sendMessage (chatId, message) {
    return this.execute('messages.send', {
      peer_id: chatId,
      message: (message instanceof Message) ? formatForVk(message) : message
    })
  }
}

export default VK
