FROM node:10.8.0-alpine

RUN mkdir /data && \
    chown node:node /data && \
    mkdir /root/.npm-global

ENV PATH=/root/.npm-global/bin:$PATH
ENV NPM_CONFIG_PREFIX=/root/.npm-global

RUN apk add --repository http://dl-3.alpinelinux.org/alpine/edge/testing \
    vips-tools vips-dev fftw-dev make gcc g++ python && \
    npm install -g me-bridge-bot && \
    apk del vips-dev fftw-dev make gcc g++ && \
    rm -rf /var/cache/apk/*

USER node
ENV DB_FILE=/data/meBridgeBot.db

VOLUME /data

CMD ["meBridgeBot"]