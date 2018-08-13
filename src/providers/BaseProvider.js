const Raven = require("raven");
const {
  createConnection,
  findConnection,
  getChat,
  findConnectionsForChatId
} = require("../utils");
const { version } = require("../../package.json");
const { Message } = require("../message");
const { Connection, Op } = require("../db");

const CONNECTION_TIMEOUT = 600; // ten minutes
const connectionRegexp = /^\/connect(?:@\w+)?\s+\$mbb1\$(\d+)!([a-zA-Z0-9_$]+)/;
const disconnectionRegexp = /^\/disconnect[_ ](\d+)/;

class BaseProvider {
  constructor() {
    this.eventListeners = {
      incomingMessage: []
    };
    this.cmdStart = this.cmdStart.bind(this);
    this.cmdConnectionFromLeft = this.cmdConnectionFromLeft.bind(this);
    this.cmdConnectionToRight = this.cmdConnectionToRight.bind(this);
    this.cmdList = this.cmdList.bind(this);
    this.cmdDisconnect = this.cmdDisconnect.bind(this);
  }

  addEventListener(type, listener) {
    if (!this.eventListeners.hasOwnProperty(type)) {
      return;
    }
    this.eventListeners[type].push(listener);
  }
  removeEventListener(type, listener) {
    if (this.eventListeners.hasOwnProperty(type)) {
      const idx = this.eventListeners[type].findIndex(listener);
      if (idx !== -1) {
        this.eventListeners[type].splice(idx, 1);
      }
    }
  }

  async event(eventType, context) {
    if (!this.eventListeners["eventType"].length) {
      return;
    }
    const msg = await this.extractMessage(context);
    switch (eventType) {
      case "incomingMessage":
        this.eventListeners.incomingMessage.forEach(cb => {
          cb(this.PROVIDER, msg);
        });
    }
  }

  captureMessageSending(chatId, msg) {
    Raven.captureBreadcrumb({
      data: {
        toProvider: this.PROVIDER,
        toChatId: chatId,
        ...(msg instanceof Message
          ? {
              hasAttachments: msg.attachments.length > 0,
              withAttributes: true
            }
          : {
              withAttributes: false
            })
      },
      message: "Sent message",
      category: "api",
      level: "debug"
    });
  }

  async cmdStart(ctx) {
    const msg = await this.extractMessage(ctx);
    this.sendMessage(
      msg.providerChatId,
      [
        "🔹 Hello! I am a MeBridgeBot!",
        "I can connect multiple chats by resending messages from one to another",
        "Firstly, make sure that this bot has access to all messages in the chat",
        "Secondly, use /token command to get connection token",
        "After that, use /connect <token> command in another conversation with this bot",
        "You can list your connections by /list command",
        "",
        "/author <Maxim Kurbatov> maksimkurb@gmail.com, 20!8",
        `/version ${version}`
      ].join("\n")
    );
  }

  /**
   * This chat is initiator of connection (left side)
   * @param {Context} ctx
   */
  async cmdConnectionFromLeft(ctx) {
    const msg = await this.extractMessage(ctx, true);
    const chat = await getChat(
      this.PROVIDER,
      msg.providerChatId,
      msg.chatTitle
    );
    const key = await createConnection(chat);
    await this.sendMessage(
      msg.providerChatId,
      `🔹 Chat connect command 📫:\n/connect $mbb1$${key}\n\nUse it in another chat to make a bridge`
    );
  }

  /**
   * This chat is a slave of connection (right side)
   * @param {Context} ctx
   */
  async cmdConnectionToRight(ctx) {
    const msg = await this.extractMessage(ctx, true);
    if (!msg.text) throw new Error("Message is empty");

    const res = msg.text.match(connectionRegexp);
    if (!res) {
      this.sendMessage(msg.providerChatId, `🔹 Connection string is wrong 📪`);
      return;
    }

    const id = parseInt(res[1]);
    const key = res[2];

    const chatConnection = await findConnection(id);
    if (!chatConnection) {
      this.sendMessage(
        msg.providerChatId,
        `🔹 Connection with that ID is not found 📭`
      );
      return;
    }
    if (chatConnection.key !== key) {
      this.sendMessage(msg.providerChatId, `🔹 Connection key is wrong 📪`);
      return;
    }

    if (chatConnection.rightChatId) {
      this.sendMessage(msg.providerChatId, `🔹 Connection key is outdated`);
      return;
    }

    const chat = await getChat(
      this.PROVIDER,
      msg.providerChatId,
      msg.chatTitle
    );
    if (chatConnection.leftChatId === chat.id) {
      this.sendMessage(
        msg.providerChatId,
        `🔹 Could not connect chat with itself 😋\nPlease, use this command in another chat with this bot`
      );
      return;
    }
    const connections = await findConnectionsForChatId(chat.id);
    const same = connections.find(
      con =>
        (con.leftChatId === chat.id &&
          con.rightChatId === chatConnection.leftChatId) ||
        (con.rightChatId === chat.id &&
          con.leftChatId === chatConnection.leftChatId)
    );
    if (same) {
      this.sendMessage(
        msg.providerChatId,
        `🔹 Connection between this chats already exists`
      );
      return;
    }
    chatConnection.setRightChat(chat);

    this.sendMessage(
      msg.providerChatId,
      `🔹 Connection successfully completed ✨💦💦`
    );
  }

  async cmdList(ctx) {
    const msg = await this.extractMessage(ctx, true);
    const chat = await getChat(
      this.PROVIDER,
      msg.providerChatId,
      msg.chatTitle
    );
    const connections = await findConnectionsForChatId(chat.id, false);
    const list = await Promise.all(
      connections.map(async (con, i) => {
        const left = con.leftChatId
          ? con.leftChatId === chat.id
            ? `📍[${con.leftChat.provider}] ${con.leftChat.chatTitle}`
            : `[${con.leftChat.provider}] ${con.leftChat.chatTitle}`
          : "<NONE>";
        const right = con.rightChatId
          ? con.rightChatId === chat.id
            ? `[${con.rightChat.provider}] ${con.rightChat.chatTitle} 📍`
            : `[${con.rightChat.provider}] ${con.rightChat.chatTitle}`
          : "<NONE>";
        return `${i + 1}. ${left} <--> ${right} /disconnect_${con.id}`;
      })
    );
    if (list.length === 0) {
      this.sendMessage(
        msg.providerChatId,
        `🔹 No chats connected. Try to /start`
      );
      return;
    }
    this.sendMessage(msg.providerChatId, `🔹 Here you go:\n${list.join("\n")}`);
  }
  async cmdDisconnect(ctx) {
    const msg = await this.extractMessage(ctx);
    if (!msg.text) throw new Error("Message is empty");

    const res = msg.text.match(disconnectionRegexp);
    if (!res) {
      this.sendMessage(
        msg.providerChatId,
        `🔹 Disconnection command requires id`
      );
      return;
    }

    const chat = await getChat(this.PROVIDER, msg.providerChatId);

    const connectionId = parseInt(res[1]);
    const destroyed = await Connection.destroy({
      where: {
        id: connectionId,
        [Op.or]: [
          {
            leftChatId: chat.id
          },
          {
            rightChatId: chat.id
          }
        ]
      }
    });
    if (destroyed) {
      this.sendMessage(
        msg.providerChatId,
        `🔹 Chat ${connectionId} disconnected!`
      );
    } else {
      this.sendMessage(msg.providerChatId, `🔹 Chat ${connectionId} not found`);
    }
  }
}

module.exports = BaseProvider;
module.exports.CONNECTION_TIMEOUT = CONNECTION_TIMEOUT;
