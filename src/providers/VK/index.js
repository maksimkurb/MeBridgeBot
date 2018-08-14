const { VK: VKApi } = require("vk-io");
const debug = require("debug")("bot:provider:vk");
const LRU = require("lru");
const { LRU_CACHE_MAXAGE } = require("../../utils");

const BaseProvider = require("../BaseProvider.js");
const { Message } = require("../../message");
const { format, formatBadge } = require("../../format.js");
const { extractAttachments, sendWithAttachments } = require("./attachments");

class VK extends BaseProvider {
  constructor({
    token,
    agent,
    lang,

    pollingGroupId,

    webhookPath,
    webhookConfirmation,
    webhookPort,
    isWebhook
  }) {
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
    this.vk = new VKApi({
      token,
      agent,
      lang: lang || "ru",
      apiMode: "parallel_selected",
      apiLimit: 5,
      apiAttemts: 10,
      apiExecuteMethods: [
        "messages.getConversationsById",
        "users.get",
        "docs.getMessagesUploadServer",
        "docs.save",
        "photos.saveMessagesPhoto",
        "photos.getMessagesUploadServer",
        "photos.saveMessagesPhoto"
      ],

      pollingGroupId,
      webhookPath: webhookPath || "/vkhook",
      webhookConfirmation
    });

    const { updates } = this.vk;

    updates.use(async (context, next) => {
      if (context.is("message") && context.isOutbox) {
        return;
      }

      try {
        await next();
      } catch (error) {
        console.error("Error:", error);
        debug("%O", error);
      }
    });
    updates.hear(/^\/start/i, this.cmdStart);
    updates.hear(/^\/token/i, this.cmdConnectionFromLeft);
    updates.hear(/^\/connect/i, this.cmdConnectionToRight);
    updates.hear(/^\/list/i, this.cmdList);
    updates.hear(/^\/disconnect/i, this.cmdDisconnect);
    updates.on("message_new", async ctx => {
      await this.event("incomingMessage", ctx);
    });

    if (isWebhook) {
      this.isWebhook = true;
      updates
        .startWebhook({
          port: webhookPort
        })
        .then(() => {
          debug("Webhook started...");
        });
    } else {
      this.isPooling = true;
      updates.startPolling().then(() => {
        debug("Polling started...");
      });
    }
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
      res = await this.vk.api.users.get({
        user_ids: unknownIds.join(","),
        name_case: "nom",
        fields: "domain"
      });
    } catch (e) {
      debug(e);
    }
    if (res) {
      res.forEach(user => {
        this.namesCache.set(user.id, {
          name: `${user.first_name} ${user.last_name}`.trim(),
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

  async getChatTitle(ctx, providerChatId) {
    if (this.titlesCache.peek(providerChatId)) {
      return this.titlesCache.get(providerChatId);
    }
    const resp = this.vk.api.messages.getConversationsById({
      peer_ids: providerChatId
    });

    if (resp && resp.items && resp.items[0]) {
      this.titlesCache.set(providerChatId, resp.items[0].chat_settings.title);
      return resp.items[0].chat_settings.title;
    } else {
      return `#${providerChatId}`;
    }
  }

  async extractProfile(id, userInfo) {
    if (!userInfo) {
      userInfo = await this.fetchUserInfo([id]);
    }

    if (!userInfo[id]) {
      return {
        fullname: null,
        username: null
      };
    }

    return {
      fullname: userInfo[id].name,
      profileUrl: `https://vk.com/id${id}`,
      username: userInfo[id].domain
    };
  }

  unwrapIds(fwdMessages, i = 0) {
    if (i > 30) return {};
    let ids = {};
    for (const msg of fwdMessages) {
      if (msg.fwd_messages) {
        const innerIds = this.unwrapIds(msg.fwd_messages, i + 1);
        Object.keys(innerIds).forEach(id => {
          ids[id] = true;
        });
      }
      ids[msg.from_id] = true;
    }
    return ids;
  }

  async unwrapForwarded(fwdMessages, userInfo = null, i = 0) {
    if (i === 0) {
      const ids = this.unwrapIds(fwdMessages);
      userInfo = await this.fetchUserInfo(Object.keys(ids));
    }
    if (i > 30) return [];
    let text = [];

    for (const msg of fwdMessages) {
      if (msg.fwd_messages) {
        const inner = (await this.unwrapForwarded(
          msg.fwd_messages,
          userInfo,
          i + 1
        )).map(r => `›${r}`);
        text = text.concat(inner);
      }
      if (msg.from_id > 0) {
        text.push(
          `› ${formatBadge(
            null,
            await this.extractProfile(msg.from_id, userInfo),
            msg.date
          )}${msg.text.length > 0 ? ":" : ""}`
        );
      }
      if (msg.text && msg.text.length > 0) {
        text = text.concat(msg.text.split("\n").map(r => `› ${r}`));
      }
    }
    return text;
  }

  async extractForwardedMessages(ctx) {
    const forwardedText = await this.unwrapForwarded(ctx.payload.fwd_messages);
    if (forwardedText.length > 0) {
      forwardedText.push("");
    }
    return forwardedText.join("\n");
  }

  async extractMessage(ctx, needChatTitle = false) {
    let text = await this.extractForwardedMessages(ctx);
    text += ctx.payload.text || "";

    return new Message({
      provider: "vk",
      providerChatId: ctx.$from.id,
      providerSenderId: ctx.$sender.id,
      ...(needChatTitle
        ? { chatTitle: await this.getChatTitle(ctx, ctx.$from.id) }
        : {}),
      profile: await this.extractProfile(ctx.$sender.id),
      text,
      attachments: await extractAttachments(ctx, ctx.payload),
      date: ctx.payload.date
    });
  }

  async sendMessage(chatId, msg) {
    if (msg instanceof Message) {
      if (!msg.attachments.length) {
        return this.vk.api.messages.send({
          peer_id: chatId,
          message: format(msg)
        });
      }
      return sendWithAttachments(chatId, msg, this.vk);
    }

    return this.vk.api.messages.send({
      peer_id: chatId,
      message: msg
    });
  }
}

module.exports = VK;
