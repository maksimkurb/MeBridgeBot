import VKApi from 'node-vk-bot-api'

import BaseProvider from './BaseProvider.js'
import Message from '../message'
import { formatForVk } from '../format.js'

const fullnames = {}
async function message (ctx) {
  const fullname = await new Promise((resolve, reject) => {
    if (fullnames[ctx.message.from_id]) {
      resolve(fullnames[ctx.message.from_id])
      return
    }
    ctx.bot.execute('users.get', {
      user_ids: ctx.message.from_id,
      name_case: 'nom'
    }, (res) => {
      if (res && res[0]) {
        fullnames[ctx.message.from_id] = `${res[0].first_name} ${res[0].last_name}`
        resolve(fullnames[ctx.message.from_id])
      } else {
        resolve(ctx.message.from_id)
      }
    })
  })
  return new Message({
    provider: 'vk',
    originChatId: ctx.message.peer_id,
    originSenderId: ctx.message.from_id,
    fullname,
    url: `https://vk.com/id${ctx.message.from_id}`,
    text: ctx.message.text,
    date: ctx.message.date
    // attachments
  })
}

class VK extends BaseProvider {
  constructor (token, groupId) {
    super()
    this._onMessage = this._onMessage.bind(this)
    this._callback = this._callback.bind(this)

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
        return this._onMessage(ctx)
    }
  }

  async _onMessage (ctx) {
    const msg = await message(ctx)
    this.eventListeners.message.forEach(cb => {
      cb(msg, ctx)
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
