import VKApi from "node-vk-bot-api";
import LRU from "lru";
import Raven from "raven";
import { LRU_CACHE_MAXAGE } from "../../utils";

import BaseProvider from "../BaseProvider.js";
import Message from "../../message";
import { format, formatBadge } from "../../format.js";
import { extractAttachments, sendWithAttachments } from "./attachments";

class VK extends BaseProvider {
  constructor(token, groupId) {
    super();

    this.namesCache = new LRU({
      max: 8192,
      maxAge: LRU_CACHE_MAXAGE
    });
    this.titlesCache = new LRU({
      max: 256,
      maxAge: LRU_CACHE_MAXAGE
    });

    this.PROVIDER = "vk";
    this.api = new VKApi({
      token,
      group_id: groupId
    });
    this.api.command("/start", this.cmdConnectionFromLeft);
    this.api.command("/connect", this.cmdConnectionToRight);
    this.api.command("/list", this.cmdList);
    this.api.command("/disconnect", this.cmdDisconnect);
    this.api.use(async ctx => {
      if (ctx.message.type === "message_new") {
        const msg = await this.extractMessage(ctx);
        this.messageReceived(msg);
      }
    });
    this.api.startPolling();
  }

  async fetchUserInfo(userIds) {
    if (userIds.length === 0) return {};
    if (!Array.isArray(userIds)) {
      userIds = [userIds];
    }

    const unknownIds = userIds.filter(
      id => this.namesCache.get(id) === undefined
    );

    let res;
    try {
      res = await this.execute("users.get", {
        user_ids: unknownIds.join(","),
        name_case: "nom",
        fields: "domain"
      });
    } catch (e) {
      Raven.captureException(e);
    }
    if (res) {
      res.forEach(user => {
        this.namesCache.set(user.id, {
          name: `${user.first_name} ${user.last_name}`,
          domain: user.domain
        });
      });
    }

    const result = {};
    userIds.forEach(id => {
      result[id] = this.namesCache.get(id) || {
        name: `[id${id}]`
      };
    });
    return result;
  }

  async getChatTitle(ctx, originChatId) {
    return new Promise(resolve => {
      if (this.titlesCache.peek(originChatId)) {
        resolve(this.titlesCache.get(originChatId));
        return;
      }
      ctx.bot.execute(
        "messages.getConversationsById  ",
        {
          peer_ids: originChatId
        },
        res => {
          if (res && res.items && res.items[0]) {
            this.titlesCache.set(
              originChatId,
              res.items[0].chat_settings.title
            );
            resolve(res.items[0].chat_settings.title);
          } else {
            resolve(`#${originChatId}`);
          }
        }
      );
    });
  }

  unwrapIds(fwdMessages, i = 0) {
    if (i > 30) return "";
    let ids = {};
    fwdMessages.forEach(msg => {
      if (msg.fwd_messages) {
        const innerIds = this.unwrapIds(fwdMessages, i + 1);
        Object.keys(innerIds).forEach(id => {
          ids[id] = true;
        });
      }
      ids[msg.from_id] = true;
    });
    return ids;
  }

  async unwrapForwarded(fwdMessages, userInfo = null, i = 0) {
    if (i === 0) {
      const ids = this.unwrapIds(fwdMessages);
      userInfo = await this.fetchUserInfo(Object.keys(ids));
    }
    if (i > 30) return "";
    let text = [];
    await Promise.all(
      fwdMessages.map(async msg => {
        if (msg.fwd_messages) {
          text = text.concat(
            (await this.unwrapForwarded(msg.fwd_messages, userInfo, i + 1)).map(
              r => `›${r}`
            )
          );
        }
        if (msg.from_id > 0) {
          text.push(
            `› ${formatBadge(
              null,
              userInfo[msg.from_id].name,
              userInfo[msg.from_id].domain,
              msg.date
            )}${msg.text.length > 0 ? ":" : ""}`
          );
        }
        if (msg.text.length > 0) {
          text = text.concat(msg.text.split("\n").map(r => `› ${r}`));
        }
      })
    );
    return text;
  }

  async extractMessage(ctx, needChatTitle = false) {
    const userInfo = await this.fetchUserInfo(ctx.message.from_id);
    console.log(ctx.message);

    const forwardedText = await this.unwrapForwarded(ctx.message.fwd_messages);
    if (forwardedText.length > 0) {
      forwardedText.push("");
    }
    return new Message({
      provider: "vk",
      originChatId: ctx.message.peer_id,
      originSenderId: ctx.message.from_id,
      ...(needChatTitle
        ? { chatTitle: await this.getChatTitle(ctx, ctx.message.peer_id) }
        : {}),
      meta: {
        id: ctx.message.conversation_message_id
      },
      fullname: userInfo[ctx.message.from_id].name,
      username: userInfo[ctx.message.from_id].domain,
      url: `https://vk.com/id${ctx.message.from_id}`,
      text:
        forwardedText.length > 0 || ctx.message.text
          ? `${forwardedText.join("\n")}${ctx.message.text || ""}`
          : null,
      attachments: await extractAttachments(ctx, ctx.message),
      date: ctx.message.date
    });
  }

  async execute(method, settings, cb) {
    Raven.captureBreadcrumb({
      data: {
        method
      },
      message: "Executed method",
      category: "api",
      level: "debug"
    });
    try {
      const args = Object.assign({}, { v: "5.80" }, settings);
      if (!cb) {
        return new Promise((resolve, reject) => {
          this.api.execute(method, args, res => {
            resolve(res);
          });
        });
      }
      return this.api.execute(method, args, cb);
    } catch (e) {
      Raven.captureException(e);
    }
  }

  async sendMessage(chatId, msg) {
    this.captureMessageSending(chatId, msg);
    if (msg instanceof Message) {
      if (!msg.attachments.length) {
        return this.execute("messages.send", {
          peer_id: chatId,
          message: format(msg)
        });
      }
      return sendWithAttachments(chatId, msg, this);
    }

    return this.execute("messages.send", {
      peer_id: chatId,
      message: msg
    });
  }
}

export default VK;
