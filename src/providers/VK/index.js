import { VK as VKApi } from "vk-io";
import createDebug from "debug";
import LRU from "lru";
import { LRU_CACHE_MAXAGE } from "../../utils";

import BaseProvider from "../BaseProvider.js";
import { Message } from "../../message";
import { format, formatBadge } from "../../format.js";
import { extractAttachments, sendWithAttachments } from "./attachments";
import {
  unwrapForwardedUserIds,
  unwrapForwardedMessages
} from "./forwardedMessages";

const debug = createDebug("bot:provider:vk");

export default class VK extends BaseProvider {
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
    updates.on("message", async ctx => {
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

  async extractForwardedMessages(ctx) {
    const userIds = unwrapForwardedUserIds(ctx.payload.fwd_messages);
    const userInfo = await this.fetchUserInfo(userIds);

    const forwardedText = await unwrapForwardedMessages(
      ctx.payload.fwd_messages,
      async msg =>
        formatBadge(
          null,
          await this.extractProfile(msg.from_id, userInfo),
          msg.date
        )
    );
    console.log(forwardedText);
    return forwardedText;
  }

  async extractMessage(ctx, needChatTitle = false) {
    let text = await this.extractForwardedMessages(ctx);
    if (text.length > 0) {
      text += "\n";
    }

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
