FROM node:10.8.0-alpine

RUN npm install -g my-bridge-bot

VOLUME myBridgeBot.db

CMD ["myBridgeBot"]