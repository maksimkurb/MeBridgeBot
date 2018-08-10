import sharp from "sharp";
import mime from "mime-types";
import fetch from "node-fetch";

import { Attachment, AttachmentTypes } from "../../message";
import { format } from "../../format.js";

export async function extractAttachments(ctx, msg) {
  const attachments = [];

  if (msg.audio) {
    attachments.push(
      new Attachment({
        type: AttachmentTypes.AUDIO,
        originInfo: msg.audio,
        url: await ctx.telegram.getFileLink(msg.audio.file_id),

        size: msg.audio.file_size,
        mimeType: msg.audio.mime_type,
        duration: msg.audio.duration
      })
    );
  } else if (msg.animation) {
    attachments.push(
      new Attachment({
        type: AttachmentTypes.ANIMATION,
        originInfo: msg.animation,
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
        originInfo: msg.document,
        url: await ctx.telegram.getFileLink(msg.document.file_id),

        size: msg.document.file_size,
        filename: msg.document.file_name,
        mimeType: msg.document.mime_type
      })
    );
  } else if (msg.photo) {
    const photo = msg.photo[msg.photo.length - 1];
    attachments.push(
      new Attachment({
        type: AttachmentTypes.PHOTO,
        originInfo: photo,
        url: await ctx.telegram.getFileLink(photo.file_id),

        size: photo.file_size,
        width: photo.width,
        height: photo.height
      })
    );
  } else if (msg.sticker) {
    attachments.push(
      new Attachment({
        type: AttachmentTypes.STICKER,
        originInfo: msg.sticker,
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
        originInfo: msg.video,
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
        originInfo: {
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
        originInfo: msg.contact,
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
        originInfo: msg.venue,
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
        originInfo: msg.location,
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
        originInfo: msg.voice,
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

export async function sendWithAttachments(chatId, msg, tg) {
  return Promise.all(
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
            msg.provider === "tg" ? at.originInfo.file_id : at.url,
            { caption: format(msg).substr(0, 200) }
          );
        case AttachmentTypes.AUDIO:
          return tg.sendAudio(
            chatId,
            msg.provider === "tg" ? at.originInfo.file_id : at.url,
            { caption: format(msg).substr(0, 200) }
          );
        case AttachmentTypes.CONTACT:
          msg.icon = "☎️";
          return tg
            .sendMessage(chatId, format(msg), { disable_notification: true })
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
            document = at.originInfo.file_id;
          } else if (safeFileTypes.indexOf(at.mimeType) === -1) {
            document = {
              source: await downloadToBuffer(at.url),
              filename
            };
          }
          return tg.sendDocument(chatId, document, {
            caption: format(msg).substr(0, 200)
          });
        case AttachmentTypes.LINK:
          msg.icon = "🌐";
          msg.text = `${at.payload.title || ""} ${at.url}`;
          return tg.sendMessage(chatId, format(msg));
        case AttachmentTypes.LOCATION:
          msg.icon = "🌎";
          return tg
            .sendMessage(chatId, format(msg), { disable_notification: true })
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
            msg.provider === "tg" ? at.originInfo.file_id : at.url,
            { caption: format(msg).substr(0, 200) }
          );
        case AttachmentTypes.STICKER:
          const stickerPromise = new Promise(resolve => {
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
                        caption: format(msg).substr(0, 200)
                      }
                    )
                  )
              );
          });
          return stickerPromise
            .then(sticker => tg.sendSticker(chatId, sticker))
            .then(() =>
              tg.sendMessage(chatId, format(msg), {
                disable_notification: true
              })
            );

        case AttachmentTypes.VIDEO:
          if (msg.provider === "tg" && at.originInfo.isVideoNote) {
            return th.sendVideoNote(chatId, at.originInfo.file_id, {
              caption: format(msg).substr(0, 200)
            });
          } else {
            return tg.sendVideo(
              chatId,
              msg.provider === "tg" ? at.originInfo.file_id : at.url,
              { caption: format(msg).substr(0, 200) }
            );
          }
        case AttachmentTypes.VOICE:
          return tg.sendVoice(
            chatId,
            msg.provider === "tg" ? at.originInfo.file_id : at.url,
            { caption: format(msg).substr(0, 200) }
          );
        default:
          throw new Error(`Unsupported media type: ${at.type}`);
      }
    })
  );
}
