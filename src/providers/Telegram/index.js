const Telegraf = require("telegraf");
const LRU = require("lru");
const { LRU_CACHE_MAXAGE } = require("../../utils");

const BaseProvider = require("../BaseProvider.js");
const { format, formatBadge } = require("../../format.js");
const { Message, AttachmentTypes } = require("../../message.js");
const { extractAttachments, sendWithAttachments } = require("./attachments");

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
      // Do not resend service messages
      if (
        ctx.new_chat_members ||
        ctx.left_chat_member ||
        ctx.new_chat_title ||
        ctx.new_chat_photo ||
        ctx.delete_chat_photo ||
        ctx.group_chat_created ||
        ctx.supergroup_chat_created ||
        ctx.channel_chat_created ||
        ctx.migrate_to_chat_id ||
        ctx.migrate_from_chat_id ||
        ctx.invoice ||
        ctx.successful_payment ||
        ctx.connected_website ||
        ctx.passport_data ||
        ctx.pinned_message
      ) {
        return;
      }
      const msg = await this.extractMessage(ctx);
      this.messageReceived(msg);
    });
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
    this.captureMessageSending(providerChatId, msg);
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

module.exports = Telegram;
