## ⚠️📦 Repo is archived

Please consider using [BridgeBotNext](https://github.com/maksimkurb/BridgeBotNext) instead

# MeBridgeBot
Make a bridge between VK and Telegram groups!

Add @MeBridgeBot to your conversations in [Telegram](https://t.me/MeBridgeBot) and [VK](https://vk.com/mebridgebot), allow them to read your messages (in VK you should make it in conversation settings, you must be Administrator to do this)

To connect chats, enter `/token` command in first chat to get a special command with secret key.
Enter this special command in another chat (it looks like `/connect $mbb1$1!9d8xxxxx00ca`) and your chats are connected now!

## Screenshot
![Screenshot](https://raw.githubusercontent.com/maksimkurb/MeBridgeBot/master/docs/screenshot.jpg)

## Environment variables
```
VK_TOKEN=b0****76 # VK token (required)
VK_POLLING_GROUP_ID=1******7 # VK polling group ID (required for community bot)
VK_PROXY=http://10.11.22.33:3128 # VK HTTP Proxy

TG_TOKEN=1***************Q # Telegram token (required)
TG_API_ROOT=https://tg.reverse-proxy.com # Telegram bot api root (nginx reverse proxy)
TG_PROXY=http://10.11.22.33:3128 # Telegram HTTP Proxy

DEBUG=bot*,vk-io*,telegraf* # (show debug information)
WELCOME_MESSAGE=Hello. This bot is sponsored by... # Welcome message. This will be sent to /start command after bot info
```
