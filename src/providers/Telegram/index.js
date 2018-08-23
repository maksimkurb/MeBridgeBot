import Telegraf from "telegraf";
import createDebug from "debug";
import LRU from "lru";
import { LRU_CACHE_MAXAGE } from "../../utils";

import BaseProvider from "../BaseProvider.js";
import { format, formatBadge } from "../../format.js";
import { Message, AttachmentTypes } from "../../message.js";
import { extractAttachments, sendWithAttachments } from "./attachments";

const debug = createDebug("bot:provider:tg");

export default class Telegram extends BaseProvider {
  constructor(token, options) {
    super();

    this.titlesCache = new LRU({
      max: 256,
      maxAge: LRU_CACHE_MAXAGE
    });

    this.PROVIDER = "tg";
    this.api = new Telegraf(token, options);
    this.api.use(async (context, next) => {
      try {
        await next();
      } catch (error) {
        debug("Error: %O", error);
      }
    });
    this.api.command("start", this.cmdStart);
    this.api.command("token", this.cmdConnectionFromLeft);
    this.api.command("connect", this.cmdConnectionToRight);
    this.api.command("list", this.cmdList);
    this.api.hears(/^\/disconnect[_ ]\d+/, this.cmdDisconnect);
    this.api.on(
      [
        "text",
        "audio",
        "document",
        "photo",
        "sticker",
        "video",
        "voice",
        "contact",
        "location",
        "venue",
        "video_note"
      ],
      async ctx => {
        await this.event("incomingMessage", ctx);
      }
    );
    this.api.startPolling();
  }

  async getChatTitle(ctx, providerChatId) {
    if (this.titlesCache.peek(providerChatId)) {
      return this.titlesCache.get(providerChatId);
    }
    if (ctx.chat.id === providerChatId) {
      this.titlesCache.set(providerChatId, ctx.chat.title);
      return ctx.chat.title;
    }
    const chat = await ctx.telegram.getChat(providerChatId);
    this.titlesCache.set(providerChatId, chat.title);
    return chat.title;
  }

  extractProfile(msg) {
    return {
      fullname: `${msg.from.first_name} ${msg.from.last_name || ""}`.trim(),
      ...(msg.from.username
        ? {
            profileUrl: `https://t.me/${msg.from.username}`,
            username: msg.from.username
          }
        : {})
    };
  }

  extractMessageReply(msg) {
    if (msg.reply_to_message) {
      const reply = msg.reply_to_message;
      const badge = formatBadge(null, this.extractProfile(reply), reply.date);
      return `›${badge}\n›${msg.reply_to_message.text || `[attachment 📎]`}\n`;
    }
    return "";
  }

  async extractMessage(ctx, needChatTitle) {
    const msg = ctx.update.message;

    let text = this.extractMessageReply(msg);
    text += msg.text || msg.caption || "";

    return new Message({
      provider: this.PROVIDER,
      providerChatId: msg.chat.id,
      providerSenderId: msg.from.id,
      ...(needChatTitle
        ? { chatTitle: await this.getChatTitle(ctx, msg.chat.id) }
        : {}),

      profile: this.extractProfile(msg),
      text,
      meta: {
        id: msg.message_id,
        mediaGroup: msg.media_group_id
      },
      attachments: await extractAttachments(ctx, msg),
      date: msg.date
    });
  }

  async sendMessage(providerChatId, msg) {
    if (msg instanceof Message) {
      // Just forward if it is from TG
      if (msg.provider === "tg") {
        if (
          msg.attachments.length &&
          msg.attachments[0].type === AttachmentTypes.STICKER
        ) {
          msg.icon = msg.attachments[0].providerInfo.emoji;
          await this.api.telegram.sendMessage(providerChatId, format(msg));
        }
        return this.api.telegram.forwardMessage(
          chatId,
          msg.providerChatId,
          msg.meta.id
        );
      }
      if (!msg.attachments.length) {
        return this.api.telegram.sendMessage(providerChatId, format(msg));
      }
      return sendWithAttachments(providerChatId, msg, this.api.telegram);
    }

    return this.api.telegram.sendMessage(providerChatId, msg);
  }
}
