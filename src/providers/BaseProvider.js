import { createConnection, findConnection, getChat, findConnectionsForChatId } from '../utils'
import { Connection, Op } from '../db'

export const CONNECTION_TIMEOUT = 600 // ten minutes
const connectionRegexp = /^\/connect(?:@\w+)?\s+\$mbb1\$(\d+)!([a-zA-Z0-9_$]+)/
const disconnectionRegexp = /^\/disconnect[_ ](\d+)/

export default class BaseProvider {
  constructor () {
    this.eventListeners = {
      message: []
    }
    this.onMessage = this.onMessage.bind(this)
    this.cmdConnectionFromLeft = this.cmdConnectionFromLeft.bind(this)
    this.cmdConnectionToRight = this.cmdConnectionToRight.bind(this)
    this.cmdList = this.cmdList.bind(this)
    this.cmdDisconnect = this.cmdDisconnect.bind(this)
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

  /**
   * This chat is initiator of connection (left side)
   * @param {Context} ctx
   */
  async cmdConnectionFromLeft (ctx) {
    const msg = await this.extractMessage(ctx, true)
    const chat = await getChat(this.PROVIDER, msg.originChatId, msg.chatTitle)
    const key = await createConnection(chat)
    await this.sendMessage(msg.originChatId, `🔹 Chat connect command 📫:\n/connect $mbb1$${key}\n\nUse it in another chat to make a bridge`)
  }

  /**
   * This chat is a slave of connection (right side)
   * @param {Context} ctx
   */
  async cmdConnectionToRight (ctx) {
    const msg = await this.extractMessage(ctx, true)
    if (!msg.text) throw new Error('Message is empty')

    const res = msg.text.match(connectionRegexp)
    if (!res) {
      this.sendMessage(msg.originChatId, `🔹 Connection string is wrong 📪`)
      return
    }

    const id = parseInt(res[1])
    const key = res[2]

    const chatConnection = await findConnection(id)
    if (!chatConnection) {
      this.sendMessage(msg.originChatId, `🔹 Connection with that ID is not found 📭`)
      return
    }
    if (chatConnection.key !== key) {
      this.sendMessage(msg.originChatId, `🔹 Connection key is wrong 📪`)
      return
    }

    const chat = await getChat(this.PROVIDER, msg.originChatId, msg.chatTitle)
    if (chatConnection.leftChatId === chat.id) {
      this.sendMessage(msg.originChatId, `🔹 Could not connect chat with itself 😋\nPlease, use this command in another chat with this bot`)
      return
    }
    const connections = await findConnectionsForChatId(chat.id)
    const same = connections.find((con) =>
      (con.leftChatId === chat.id && con.rightChatId === chatConnection.leftChatId) ||
      (con.rightChatId === chat.id && con.leftChatId === chatConnection.leftChatId)
    )
    if (same) {
      this.sendMessage(msg.originChatId, `🔹 Connection between this chats already exists`)
      return
    }
    chatConnection.setRightChat(chat)

    this.sendMessage(msg.originChatId, `🔹 Connection successfully completed ✨💦💦`)
  }

  async cmdList (ctx) {
    const msg = await this.extractMessage(ctx)
    const chat = await getChat(this.PROVIDER, msg.originChatId)
    const connections = await findConnectionsForChatId(chat.id, false)
    const list = await Promise.all(connections.map(async (con, i) => {
      const left = con.leftChatId ? (con.leftChatId === chat.id ? `[${con.leftChat.chatTitle}]` : con.leftChat.chatTitle) : '<NONE>'
      const right = con.rightChatId ? (con.rightChatId === chat.id ? `[${con.rightChat.chatTitle}]` : con.rightChat.chatTitle) : '<NONE>'
      return `${i + 1}. ${left} <--> ${right} /disconnect_${con.id}`
    }))
    if (list.length === 0) {
      this.sendMessage(msg.originChatId, `🔹 No chats connected. Try to /start`)
      return
    }
    this.sendMessage(msg.originChatId, `🔹 Here you go:\n${list.join('\n')}`)
  }
  async cmdDisconnect (ctx) {
    const msg = await this.extractMessage(ctx)
    if (!msg.text) throw new Error('Message is empty')

    const res = msg.text.match(disconnectionRegexp)
    if (!res) {
      this.sendMessage(msg.originChatId, `🔹 Disconnection command requires id`)
      return
    }

    const chat = await getChat(this.PROVIDER, msg.originChatId)

    const connectionId = parseInt(res[1])
    const destroyed = await Connection.destroy({
      where: {
        id: connectionId,
        [Op.or]: [{
          leftChatId: chat.id
        }, {
          rightChatId: chat.id
        }]
      }
    })
    if (destroyed) {
      this.sendMessage(msg.originChatId, `🔹 Chat ${connectionId} disconnected!`)
    } else {
      this.sendMessage(msg.originChatId, `🔹 Chat ${connectionId} not found`)
    }
  }
}
