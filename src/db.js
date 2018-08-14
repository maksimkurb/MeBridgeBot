const Sequelize = require("sequelize");
const debug = require("debug")("bot:db");

const db = new Sequelize("", "", "", {
  dialect: "sqlite",
  storage: process.env.DB_FILE || "meBridgeBot.db",
  operatorsAliases: false,
  logging: false
});

const Chat = db.define("chat", {
  provider: Sequelize.STRING,
  providerChatId: Sequelize.STRING,
  chatTitle: Sequelize.STRING
});

const Connection = db.define("connection", {
  // TODO: make use of it
  direction: {
    type: Sequelize.ENUM("TWOWAY", "TORIGHT", "TOLEFT", "NONE"),
    defaultValue: "TWOWAY"
  },
  key: Sequelize.STRING
});

Connection.belongsTo(Chat, { as: "leftChat", foreignKey: "leftChatId" });
Connection.belongsTo(Chat, { as: "rightChat", foreignKey: "rightChatId" });

async function dbSync() {
  await Chat.sync();
  await Connection.sync();
  debug("DB synced");
}

module.exports = db;
module.exports.Op = Sequelize.Op;
module.exports.Chat = Chat;
module.exports.Connection = Connection;
module.exports.dbSync = dbSync;
