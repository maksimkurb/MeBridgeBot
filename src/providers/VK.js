import VKApi from 'node-vk-bot-api'

import BaseProvider from './BaseProvider.js'
import Message from '../message'
import { formatForVk } from '../format.js'

class VK extends BaseProvider {
  constructor (token, groupId) {
    super()

    this.fullnamesCache = {}
    this.fetchUsername = this.fetchUsername.bind(this)
    this.extractMessage = this.extractMessage.bind(this)
    this._callback = this._callback.bind(this)

    this.PROVIDER = 'vk'
    this.api = new VKApi({
      token,
      group_id: groupId
    })
    this.api.use(this._callback)
    this.api.startPolling()
  }

  _callback (ctx) {
    switch (ctx.message.type) {
      case 'message_new':
        return this.onMessage(ctx)
    }
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
    if (!(message instanceof Message)) throw new Error('message argument in sendMessage() must be an instance of Message class')
    return this.execute('messages.send', {
      peer_id: chatId,
      message: formatForVk(message)
    })
  }
}

export default VK
