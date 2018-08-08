import Sequelize from 'sequelize'

const db = new Sequelize('', '', '', {
  dialect: 'sqlite',
  storage: 'myBridgeBot.db',
  operatorsAliases: false
})
export default db

export const Chat = db.define('chat', {
  provider: Sequelize.STRING,
  chatId: Sequelize.STRING,
  chatType: Sequelize.STRING
})

export const Connection = db.define('connection', {
  direction: {
    type: Sequelize.ENUM('TWOWAY', 'TORIGHT', 'TOLEFT', 'NONE'),
    defaultValue: 'TWOWAY'
  },
  key: Sequelize.STRING
})

Connection.belongsTo(Chat, { as: 'leftChat' })
Connection.belongsTo(Chat, { as: 'rightChat' })

Chat.sync()
Connection.sync()
