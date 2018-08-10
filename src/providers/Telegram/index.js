import Telegraf from "telegraf";
import LRU from "lru";
import { LRU_CACHE_MAXAGE } from "../../utils";

import BaseProvider from "../BaseProvider.js";
import { format, formatBadge } from "../../format.js";
import { Message, AttachmentTypes } from "../../message.js";
import { extractAttachments, sendWithAttachments } from "./attachments";

class Telegram extends BaseProvider {
  constructor(token, options) {
    super();

    this.titlesCache = new LRU({
      max: 256,
      maxAge: LRU_CACHE_MAXAGE
    });

    this.PROVIDER = "tg";
    this.api = new Telegraf(token, options);
    this.api.command("start", this.cmdStart);
    this.api.command("token", this.cmdConnectionFromLeft);
    this.api.command("connect", this.cmdConnectionToRight);
    this.api.command("list", this.cmdList);
    this.api.hears(/^\/disconnect[_ ]\d+/, this.cmdDisconnect);
    this.api.on("message", async ctx => {
      const msg = await this.extractMessage(ctx);
      this.messageReceived(msg);
    });
    this.api.startPolling();
  }

  async getChatTitle(ctx, originChatId) {
    if (this.titlesCache.peek(originChatId)) {
      return this.titlesCache.get(originChatId);
    }
    if (ctx.chat.id === originChatId) {
      this.titlesCache.set(originChatId, ctx.chat.title);
      return ctx.chat.title;
    }
    const chat = await ctx.telegram.getChat(originChatId);
    this.titlesCache.set(originChatId, chat.title);
    return chat.title;
  }

  async extractMessage(ctx, needChatTitle) {
    const msg = ctx.update.message;

    let text = "";
    if (msg.reply_to_message) {
      const replyFrom = msg.reply_to_message.from;
      text += `›${formatBadge(
        null,
        `${replyFrom.first_name} ${replyFrom.last_name}`,
        replyFrom.username,
        msg.reply_to_message.date
      )}\n›${msg.reply_to_message.text || `[attachment 📎]`}\n`;
    }
    text += msg.text || msg.caption || "";

    return new Message({
      provider: this.PROVIDER,
      originChatId: msg.chat.id,
      originSenderId: msg.from.id,
      ...(needChatTitle
        ? { chatTitle: await this.getChatTitle(ctx, msg.chat.id) }
        : {}),
      fullname: `${msg.from.first_name} ${msg.from.last_name}`,
      ...(msg.from.username
        ? {
            url: `https://t.me/${msg.from.username}`,
            username: msg.from.username
          }
        : {}),
      text,
      meta: {
        id: msg.message_id,
        mediaGroup: msg.media_group_id
      },
      attachments: await extractAttachments(ctx, msg),
      date: msg.date
    });
  }

  async sendMessage(chatId, msg) {
    this.captureMessageSending(chatId, msg);
    if (msg instanceof Message) {
      // Just forward if it is from TG
      if (msg.provider === "tg") {
        if (
          msg.attachments.length &&
          msg.attachments[0].type === AttachmentTypes.STICKER
        ) {
          msg.icon = msg.attachments[0].originInfo.emoji;
          await this.api.telegram.sendMessage(chatId, format(msg));
        }
        return this.api.telegram.forwardMessage(
          chatId,
          msg.originChatId,
          msg.meta.id
        );
      }
      if (!msg.attachments.length) {
        return this.api.telegram.sendMessage(chatId, format(msg));
      }
      return sendWithAttachments(chatId, msg, this.api.telegram);
    }

    return this.api.telegram.sendMessage(chatId, msg);
  }
}

export default Telegram;
