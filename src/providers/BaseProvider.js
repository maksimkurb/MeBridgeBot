import randomString from 'crypto-random-string'
import { Chat, Connection } from '../db'

export const CONNECTION_TIMEOUT = 600 // ten minutes

const connectionRegexp = /^\/connect(?:@\w+)?\s+\$mbb1\$(\d+)!([a-zA-Z0-9_$]+)/

export default class BaseProvider {
  constructor () {
    this.eventListeners = {
      message: []
    }
    this.onMessage = this.onMessage.bind(this)
    this.performConnectionFromLeft = this.performConnectionFromLeft.bind(this)
    this.performConnectionToRight = this.performConnectionToRight.bind(this)
  }

  addEventListener (type, listener) {
    if (!this.eventListeners.hasOwnProperty(type)) {
      return
    }
    this.eventListeners[type].push(listener)
  }
  removeEventListener (type, listener) {
    if (this.eventListeners.hasOwnProperty(type)) {
      const idx = this.eventListeners[type].findIndex(listener)
      if (idx !== -1) {
        this.eventListeners[type].splice(idx, 1)
      }
    }
  }

  async onMessage (ctx) {
    const msg = await this.extractMessage(ctx)
    this.eventListeners.message.forEach(cb => {
      cb(this.PROVIDER, msg, ctx)
    })
  }

  async getChat (chatId, chatType) {
    return Chat.findOrCreate({
      where: {
        provider: this.PROVIDER,
        chatId
      },
      defaults: {
        chatType
      }
    })[0]
  }

  async createConnection (chat) {
    const chatConnection = await Connection.create({
      key: randomString(20)
    })
    await chatConnection.setLeftChat(chat)
    return `${chatConnection.id}!${chatConnection.key}`
  }
  async findConnection (id) {
    return Connection.findOne({
      where: {
        id
      }
    })
  }

  /**
   * This chat is initiator of connection (left side)
   * @param {Context} ctx
   */
  async performConnectionFromLeft (ctx) {
    const msg = await this.extractMessage(ctx)
    const chat = await this.getChat(msg.originChatId, msg.originChatType)
    const key = await this.createConnection(chat)
    this.sendMessage(msg.originChatId, `[‼️] Chat connect command:\n/connect $mbb1$${key}\n\nUse it in another chat to make a bridge`)
  }

  /**
   * This chat is a slave of connection (right side)
   * @param {Context} ctx
   */
  async performConnectionToRight (ctx) {
    const msg = await this.extractMessage(ctx)
    if (!msg.text) throw new Error('Message is empty')

    const res = msg.text.match(connectionRegexp)
    if (!res) {
      this.sendMessage(msg.originChatId, `[‼️] Connection string is wrong`)
      return
    }

    const id = parseInt(res[1])
    const key = res[2]

    const chatConnection = await this.findConnection(id)
    if (!chatConnection) {
      this.sendMessage(msg.originChatId, `[‼️] Connection with that ID is not found`)
      return
    }
    if (chatConnection.key !== key) {
      this.sendMessage(msg.originChatId, `[‼️] Connection key is wrong`)
      return
    }

    const chat = await this.getChat(msg.originChatId, msg.originChatType)
    chatConnection.setRightChat(chat)

    this.sendMessage(msg.originChatId, `[‼️] Connection successfully completed ✨`)
  }
}
