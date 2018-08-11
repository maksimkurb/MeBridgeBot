const Sequelize = require("sequelize");

const db = new Sequelize("", "", "", {
  dialect: "sqlite",
  storage: process.env.DB_FILE || "meBridgeBot.db",
  operatorsAliases: false,
  logging: process.env.NODE_ENV === "production" ? false : console.log
});

const Chat = db.define("chat", {
  provider: Sequelize.STRING,
  chatId: Sequelize.STRING,
  chatTitle: Sequelize.STRING
});

const Connection = db.define("connection", {
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
  console.log("DB synced");
}

module.exports = db;
module.exports.Op = Sequelize.Op;
module.exports.Chat = Chat;
module.exports.Connection = Connection;
module.exports.dbSync = dbSync;
