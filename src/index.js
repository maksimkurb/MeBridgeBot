const HttpsProxyAgent = require("https-proxy-agent");

const { dbSync } = require("./db");
const { getChat, findConnectionsForChatId } = require("./utils");

const VK = require("./providers/VK");
const Telegram = require("./providers/Telegram");

const BOT_NAME = process.env.BOT_NAME || "MeBridgeBot";
const services = {};
module.exports = {
  BOT_NAME,
  services
};

function getHTTPSAgent(proxy) {
  if (proxy) {
    return {
      agent: new HttpsProxyAgent(proxy)
    };
  }
  return {};
}

dbSync().then(() => {
  const vkOpts = {
    token: process.env.VK_TOKEN,
    lang: process.env.VK_LANG,
    ...getHTTPSAgent(process.env.VK_PROXY)
  };
  if (process.env.VK_MODE === "webhook") {
    vkOpts.isWebhook = true;
    vkOpts.webhookPath = process.env.VK_WEBHOOK_PATH;
    vkOpts.webhookPort = process.env.VK_WEBHOOK_PORT;
    vkOpts.webhookConfirmation = process.env.VK_WEBHOOK_CONFIRMATION;
  } else {
    vkOpts.pollingGroupId = process.env.VK_POLLING_GROUP_ID;
  }
  const vk = new VK(vkOpts);

  const telegram = new Telegram(process.env.TG_TOKEN, {
    username: BOT_NAME,
    telegram: {
      apiRoot: process.env.TG_API_ROOT || "https://api.telegram.org",
      ...getHTTPSAgent(process.env.TG_PROXY)
    }
  });

  const enabledServices = [vk, telegram];
  console.log("Bot is running...");

  async function onMessage(provider, msg) {
    const chat = await getChat(provider, msg.providerChatId);
    const connections = await findConnectionsForChatId(chat.id);
    await Promise.all(
      connections.map(async con => {
        const message = msg.clone();
        let resultChat;
        if (con.leftChatId === chat.id) {
          resultChat = await con.getRightChat();
        } else {
          resultChat = await con.getLeftChat();
        }

        await services[resultChat.provider].sendMessage(
          resultChat.providerChatId,
          message
        );
      })
    );
  }

  enabledServices.forEach(svc => {
    services[svc.PROVIDER] = svc;
    svc.addEventListener("incomingMessage", onMessage);
  });
});
