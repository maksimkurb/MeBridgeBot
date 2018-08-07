import Sequelize from 'sequelize'

const db = new Sequelize('sqlite:myBridgeBot.db')
export default db

export const Chat = db.define('chat', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  provider: Sequelize.STRING,
  chatId: Sequelize.STRING,
  chatType: Sequelize.STRING,
  privateKey: Sequelize.STRING
})

export const Connection = db.define('connection', {
  chatA_id: { model: Chat, key: 'id', unique: 'connectionIdx' },
  chatB_id: { model: Chat, key: 'id', unique: 'connectionIdx' }
})

Chat.sync()
Connection.sync()
