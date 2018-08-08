import randomString from 'crypto-random-string'
import { Op, Chat, Connection } from './db'

export const LRU_CACHE_MAXAGE = 10 * 60 * 60 * 1000

export async function getChat (provider, originChatId, chatTitle) {
  const chat = await Chat.findOrCreate({
    where: {
      provider,
      chatId: originChatId
    },
    defaults: {
      chatTitle
    }
  })
  return chat[0]
}

export async function createConnection (chat) {
  const chatConnection = await Connection.create({
    key: randomString(20)
  })
  await chatConnection.setLeftChat(chat)
  return `${chatConnection.id}!${chatConnection.key}`
}

export async function findConnection (id) {
  return Connection.findOne({
    where: {
      id
    }
  })
}

export async function findConnectionsForChatId (chatId, activeOnly = true) {
  const clause = [
    {[Op.or]: [
      { leftChatId: chatId },
      { rightChatId: chatId }
    ]}
  ]
  if (activeOnly) {
    clause.push({
      direction: {
        [Op.ne]: 'NONE'
      }
    })
    clause.push({
      leftChatId: {[Op.ne]: null}
    })
    clause.push({
      rightChatId: {[Op.ne]: null}
    })
  }
  return Connection.findAll({
    include: [
      {
        model: Chat,
        as: 'leftChat'
      },
      {
        model: Chat,
        as: 'rightChat'
      }
    ],
    where: {
      [Op.and]: clause
    }
  })
}
