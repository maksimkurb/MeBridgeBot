import HttpsProxyAgent from "https-proxy-agent";
import Raven from "raven";

import "./db";
import { getChat, findConnectionsForChatId } from "./utils";

import VK from "./providers/VK";
import Telegram from "./providers/Telegram";

export const BOT_NAME = process.env.BOT_NAME || "MeBridgeBot";
export const services = {};
Raven.config(process.env.SENTRY_DSN || null).install();

Raven.context(() => {
  const vk = new VK(process.env.VK_TOKEN, process.env.VK_GROUP_ID);

  const telegram = new Telegram(process.env.TELEGRAM_TOKEN, {
    username: BOT_NAME,
    telegram: {
      apiRoot: process.env.TELEGRAM_API_ROOT || "https://api.telegram.org",
      ...(process.env.TELEGRAM_PROXY
        ? { agent: new HttpsProxyAgent(process.env.TELEGRAM_PROXY) }
        : {})
    }
  });

  const enabledServices = [vk, telegram];

  async function onMessage(provider, msg) {
    try {
      const chat = await getChat(provider, msg.originChatId);
      const connections = await findConnectionsForChatId(chat.id);
      Raven.captureBreadcrumb({
        data: {
          fromProvider: provider,
          fromChatId: msg.originChatId,
          hasAttachments: msg.attachments.length > 0
        },
        message: "Received message",
        category: "events",
        level: "debug"
      });
      await Promise.all(
        connections.forEach(async con => {
          const message = msg.clone();
          let resultChat;
          if (con.leftChatId === chat.id) {
            resultChat = await con.getRightChat();
          } else {
            resultChat = await con.getLeftChat();
          }

          await services[resultChat.provider].sendMessage(
            resultChat.chatId,
            message
          );
        })
      );
    } catch (e) {
      Raven.captureException(e);
    }
  }

  enabledServices.forEach(svc => {
    services[svc.PROVIDER] = svc;
    svc.addEventListener("message", onMessage);
  });
});
