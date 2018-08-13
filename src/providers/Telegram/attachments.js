const sharp = require("sharp");
const mime = require("mime-types");
const fetch = require("node-fetch");

const { Attachment, AttachmentTypes } = require("../../message");
const { format } = require("../../format.js");

async function extractAttachments(ctx, msg) {
  const attachments = [];

  if (msg.audio) {
    attachments.push(
      new Attachment({
        type: AttachmentTypes.AUDIO,
        providerInfo: msg.audio,
        url: await ctx.telegram.getFileLink(msg.audio.file_id),
        payload: {
          artist: msg.audio.performer,
          title: msg.audio.title
        },

        size: msg.audio.file_size,
        mimeType: msg.audio.mime_type,
        duration: msg.audio.duration
      })
    );
  } else if (msg.animation) {
    attachments.push(
      new Attachment({
        type: AttachmentTypes.ANIMATION,
        providerInfo: msg.animation,
        url: await ctx.telegram.getFileLink(msg.animation.file_id),

        size: msg.animation.file_size,
        filename: msg.animation.file_name,
        mimeType: msg.animation.mime_type,
        duration: msg.animation.duration,
        width: msg.animation.width,
        height: msg.animation.height
      })
    );
  } else if (msg.document) {
    attachments.push(
      new Attachment({
        type: AttachmentTypes.DOCUMENT,
        providerInfo: msg.document,
        url: await ctx.telegram.getFileLink(msg.document.file_id),

        size: msg.document.file_size,
        filename: msg.document.file_name,
        mimeType: msg.document.mime_type
      })
    );
  } else if (msg.photo) {
    const photo = msg.photo[msg.photo.length - 1];
    const url = await ctx.telegram.getFileLink(photo.file_id);
    attachments.push(
      new Attachment({
        type: AttachmentTypes.PHOTO,
        providerInfo: photo,
        url,

        size: photo.file_size,
        mimeType: mime.lookup(url),
        width: photo.width,
        height: photo.height
      })
    );
  } else if (msg.sticker) {
    attachments.push(
      new Attachment({
        type: AttachmentTypes.STICKER,
        providerInfo: msg.sticker,
        url: await ctx.telegram.getFileLink(msg.sticker.file_id),

        mimeType: "image/webp",
        size: msg.sticker.file_size,
        width: msg.sticker.width,
        height: msg.sticker.height
      })
    );
  } else if (msg.video) {
    attachments.push(
      new Attachment({
        type: AttachmentTypes.VIDEO,
        providerInfo: msg.video,
        url: await ctx.telegram.getFileLink(msg.video.file_id),

        size: msg.video.file_size,
        mimeType: msg.video.mime_type,
        duration: msg.video.duration,
        width: msg.video.width,
        height: msg.video.height
      })
    );
  } else if (msg.video_note) {
    attachments.push(
      new Attachment({
        type: AttachmentTypes.VIDEO,
        providerInfo: {
          ...msg.video_note,
          isVideoNote: true
        },
        url: await ctx.telegram.getFileLink(msg.video_note.file_id),

        size: msg.video_note.file_size,
        mimeType: msg.video_note.mime_type,
        duration: msg.video_note.duration,
        width: msg.video_note.length,
        height: msg.video_note.length
      })
    );
  } else if (msg.contact) {
    attachments.push(
      new Attachment({
        type: AttachmentTypes.CONTACT,
        providerInfo: msg.contact,
        mimeType: "text/x-vcard",
        payload: {
          vcard: msg.contact.vcard,
          firstName: msg.contact.first_name,
          lastName: msg.contact.last_name,
          phone: msg.contact.phone_number
        }
      })
    );
  } else if (msg.venue) {
    attachments.push(
      new Attachment({
        type: AttachmentTypes.LOCATION,
        providerInfo: msg.venue,
        payload: {
          lon: msg.venue.location.longitude,
          lat: msg.venue.location.latitude,
          title: msg.venue.title,
          address: msg.venue.address
        }
      })
    );
  } else if (msg.location) {
    attachments.push(
      new Attachment({
        type: AttachmentTypes.LOCATION,
        providerInfo: msg.location,
        payload: {
          lon: msg.location.longitude,
          lat: msg.location.latitude
        }
      })
    );
  } else if (msg.voice) {
    attachments.push(
      new Attachment({
        type: AttachmentTypes.VOICE,
        providerInfo: msg.voice,
        url: await ctx.telegram.getFileLink(msg.voice.file_id),

        size: msg.voice.file_size,
        mimeType: msg.voice.mime_type,
        duration: msg.voice.duration
      })
    );
  }

  return attachments;
}

const safeFileTypes = ["application/pdf", "application/zip", "image/gif"];
async function downloadToBuffer(url) {
  return fetch(url).then(res => res.buffer());
}

async function sendWithAttachments(chatId, msg, tg) {
  await Promise.all(
    msg.attachments.map(async at => {
      const filename =
        at.filename ||
        (at.mimeType
          ? `${at.type}.${mime.extension(at.mimeType)}`
          : `${at.type}.dat`);

      switch (at.type) {
        case AttachmentTypes.ANIMATION:
          return tg.sendAnimation(
            chatId,
            msg.provider === "tg" ? at.providerInfo.file_id : at.url,
            { caption: format(msg, { text: false }).substr(0, 200) }
          );
        case AttachmentTypes.AUDIO:
          return tg.sendAudio(
            chatId,
            msg.provider === "tg" ? at.providerInfo.file_id : at.url,
            { caption: format(msg, { text: false }).substr(0, 200) }
          );
        case AttachmentTypes.CONTACT:
          msg.icon = "☎️";
          return tg
            .sendMessage(chatId, format(msg, { text: false }), {
              disable_notification: true
            })
            .then(() =>
              tg.sendContact(chatId, at.payload.phone, at.payload.firstName, {
                last_name: at.payload.lastName,
                vcard: at.payload.vcard
              })
            );
        case AttachmentTypes.DOCUMENT:
          // In sendDocument, sending by URL will currently only work for gif, pdf and zip files.
          let document = at.url;
          if (msg.provider === "tg") {
            document = at.providerInfo.file_id;
          } else if (safeFileTypes.indexOf(at.mimeType) === -1) {
            document = {
              source: await downloadToBuffer(at.url),
              filename
            };
          }
          return tg.sendDocument(chatId, document, {
            caption: format(msg, { text: false }).substr(0, 200)
          });
        case AttachmentTypes.LINK:
          const linkMsg = msg.clone();
          linkMsg.icon = "🔗";
          linkMsg.text = `${at.payload.title || ""} ${at.url}`;
          return tg.sendMessage(chatId, format(linkMsg));
        case AttachmentTypes.LOCATION:
          msg.icon = "🌎";
          return tg
            .sendMessage(chatId, format(msg, { text: false }), {
              disable_notification: true
            })
            .then(() => {
              if (at.payload.title) {
                return tg.sendVenue(
                  chatId,
                  at.payload.lat,
                  at.payload.lon,
                  at.payload.title,
                  at.payload.address
                );
              } else {
                return tg.sendLocation(chatId, at.payload.lat, at.payload.lon);
              }
            });
        case AttachmentTypes.PHOTO:
          return tg.sendPhoto(
            chatId,
            msg.provider === "tg" ? at.providerInfo.file_id : at.url,
            { caption: format(msg, { text: false }).substr(0, 200) }
          );
        case AttachmentTypes.STICKER:
          const stickerPromise = new Promise(() => {
            if (at.url.endsWith(".webp")) {
              return at.url;
            }
            return fetch(at.url)
              .then(resp => resp.buffer())
              .then(buf =>
                sharp(buf)
                  .webp()
                  .toBuffer()
              )
              .then(imageBuf =>
                tg
                  .sendMessage(chatId, format(msg), {
                    disable_notification: true
                  })
                  .then(() =>
                    tg.sendSticker(
                      chatId,
                      { source: imageBuf },
                      {
                        caption: format(msg, { text: false }).substr(0, 200)
                      }
                    )
                  )
              );
          });
          return stickerPromise
            .then(sticker => tg.sendSticker(chatId, sticker))
            .then(() =>
              tg.sendMessage(chatId, format(msg, { text: false }), {
                disable_notification: true
              })
            );

        case AttachmentTypes.VIDEO:
          if (msg.provider === "tg" && at.providerInfo.isVideoNote) {
            return th.sendVideoNote(chatId, at.providerInfo.file_id, {
              caption: format(msg, { text: false }).substr(0, 200)
            });
          } else {
            return tg.sendVideo(
              chatId,
              msg.provider === "tg" ? at.providerInfo.file_id : at.url,
              { caption: format(msg, { text: false }).substr(0, 200) }
            );
          }
        case AttachmentTypes.VOICE:
          return tg.sendVoice(
            chatId,
            msg.provider === "tg" ? at.providerInfo.file_id : at.url,
            { caption: format(msg, { text: false }).substr(0, 200) }
          );
        default:
          throw new Error(`Unsupported media type: ${at.type}`);
      }
    })
  );

  if (msg.text !== null) {
    await tg.sendMessage(chatId, format(msg));
  }
}

module.exports = {
  extractAttachments,
  sendWithAttachments
};
