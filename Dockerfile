FROM node:10.8.0-alpine

RUN npm install -g me-bridge-bot
ENV DB_FILE=/data/meBridgeBot.db

VOLUME /data

CMD ["meBridgeBot"]