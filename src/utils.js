const randomString = require("crypto-random-string");
const { Op, Chat, Connection } = require("./db");

const LRU_CACHE_MAXAGE = 10 * 60 * 60 * 1000;

async function getChat(provider, providerChatId) {
  const chat = await Chat.findOrCreate({
    where: {
      provider,
      providerChatId
    }
  });
  return chat[0];
}

async function createConnection(chat) {
  const chatConnection = await Connection.create({
    key: randomString(20)
  });
  await chatConnection.setLeftChat(chat);
  return `${chatConnection.id}!${chatConnection.key}`;
}

async function findConnection(id) {
  return Connection.findOne({
    where: {
      id
    }
  });
}

async function findConnectionsForChatId(chatId, activeOnly = true) {
  const clause = [
    {
      [Op.or]: [{ leftChatId: chatId }, { rightChatId: chatId }]
    }
  ];
  if (activeOnly) {
    clause.push({
      direction: {
        [Op.ne]: "NONE"
      }
    });
    clause.push({
      leftChatId: { [Op.ne]: null }
    });
    clause.push({
      rightChatId: { [Op.ne]: null }
    });
  }
  return Connection.findAll({
    include: [
      {
        model: Chat,
        as: "leftChat"
      },
      {
        model: Chat,
        as: "rightChat"
      }
    ],
    where: {
      [Op.and]: clause
    }
  });
}

module.exports = {
  LRU_CACHE_MAXAGE,
  getChat,
  createConnection,
  findConnection,
  findConnectionsForChatId
};
