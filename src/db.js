import Sequelize from 'sequelize'

const db = new Sequelize('', '', '', {
  dialect: 'sqlite',
  storage: 'myBridgeBot.db',
  operatorsAliases: false,
  logging: false
})
export default db
export const Op = Sequelize.Op

export const Chat = db.define('chat', {
  provider: Sequelize.STRING,
  chatId: Sequelize.STRING,
  chatTitle: Sequelize.STRING
})

export const Connection = db.define('connection', {
  direction: {
    type: Sequelize.ENUM('TWOWAY', 'TORIGHT', 'TOLEFT', 'NONE'),
    defaultValue: 'TWOWAY'
  },
  key: Sequelize.STRING
})

Connection.belongsTo(Chat, { as: 'leftChat', foreignKey: 'leftChatId' })
Connection.belongsTo(Chat, { as: 'rightChat', foreignKey: 'rightChatId' })

Chat.sync()
Connection.sync()
