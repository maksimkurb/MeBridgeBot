import HttpsProxyAgent from "https-proxy-agent";
import Raven from "raven";

import "./db";
import { getChat, findConnectionsForChatId } from "./utils";

import VK from "./providers/VK";
import Telegram from "./providers/Telegram";

export const BOT_NAME = process.env.BOT_NAME || "mbot";
export const services = {};
Raven.config(process.env.SENTRY_DSN || null).install();

Raven.context(() => {
  const vk = new VK(process.env.VK_TOKEN, process.env.VK_GROUP_ID);

  const telegram = new Telegram(process.env.TELEGRAM_TOKEN, {
    telegram: {
      apiRoot: process.env.TELEGRAM_API_ROOT || "https://api.telegram.org",
      ...(process.env.TELEGRAM_PROXY
        ? { agent: new HttpsProxyAgent(process.env.TELEGRAM_PROXY) }
        : {})
    }
  });

  const enabledServices = [vk, telegram];

  async function onMessage(provider, msg, ctx) {
    const chat = await getChat(provider, msg.originChatId);
    const connections = await findConnectionsForChatId(chat.id);

    connections.forEach(async con => {
      let resultChat;
      if (con.leftChatId === chat.id) {
        resultChat = await con.getRightChat();
      } else {
        resultChat = await con.getLeftChat();
      }

      services[resultChat.provider].sendMessage(resultChat.chatId, msg);
    });
  }

  enabledServices.forEach(svc => {
    services[svc.PROVIDER] = svc;
    svc.addEventListener("message", onMessage);
  });
});
