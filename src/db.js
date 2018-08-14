import Sequelize from "sequelize";
import createDebug from "debug";
const debug = createDebug("bot:db");

const db = new Sequelize("", "", "", {
  dialect: "sqlite",
  storage: process.env.DB_FILE || "meBridgeBot.db",
  operatorsAliases: false,
  logging: false
});
export default db;
export const Op = Sequelize.Op;

export const Chat = db.define("chat", {
  provider: Sequelize.STRING,
  providerChatId: Sequelize.STRING,
  chatTitle: Sequelize.STRING
});

export const Connection = db.define("connection", {
  // TODO: make use of it
  direction: {
    type: Sequelize.ENUM("TWOWAY", "TORIGHT", "TOLEFT", "NONE"),
    defaultValue: "TWOWAY"
  },
  key: Sequelize.STRING
});

Connection.belongsTo(Chat, { as: "leftChat", foreignKey: "leftChatId" });
Connection.belongsTo(Chat, { as: "rightChat", foreignKey: "rightChatId" });

export async function dbSync() {
  await Chat.sync();
  await Connection.sync();
  debug("DB synced");
}
