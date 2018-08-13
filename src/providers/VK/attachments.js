const FormData = require("form-data");
const fetch = require("node-fetch");
const mime = require("mime-types");
const { Attachment, AttachmentTypes } = require("../../message");
const { format } = require("../../format.js");
const { resolve } = require("url");

async function extractAttachments(ctx, msg) {
  const attachments = [];
  if (msg.geo) {
    attachments.push(
      new Attachment({
        type: AttachmentTypes.LOCATION,
        providerInfo: msg.geo,
        payload: {
          lat: msg.geo.coordinates.latitude,
          lon: msg.geo.coordinates.longitude
        }
      })
    );
  }

  msg.attachments.forEach(mAt => {
    switch (mAt.type) {
      case "photo":
        const sizes = mAt.photo.sizes.sort((a, b) => b.width - a.width);
        attachments.push(
          new Attachment({
            type: AttachmentTypes.PHOTO,
            providerInfo: mAt.photo,
            url: sizes[0].url,

            mimeType: "image/jpeg",
            payload: {
              text: mAt.photo.text
            },
            width: sizes[0].width,
            height: sizes[0].height
          })
        );
        break;
      case "video":
        attachments.push(
          new Attachment({
            type: AttachmentTypes.LINK,
            providerInfo: mAt.video,
            url: `https://vk.com/video${mAt.video.owner_id}_${mAt.video.id}`,

            payload: {
              title: `📹 ${mAt.video.title || "[video]"}`
            }
          })
        );
        break;
      case "audio":
        attachments.push(
          new Attachment({
            type: AttachmentTypes.LINK,
            providerInfo: mAt.audio,
            url: `https://vk.com/audio${mAt.audio.owner_id}_${mAt.audio.id}`,

            payload: {
              title: `🎵 ${mAt.audio.artist} - ${mAt.audio.title} (${Math.floor(
                mAt.audio.duration / 60
              )}:${mAt.audio.duration % 60})`
            }
          })
        );
        break;
      case "link":
        attachments.push(
          new Attachment({
            type: AttachmentTypes.LINK,
            providerInfo: mAt.link,
            url: mAt.link.url,

            payload: {
              title: mAt.link.title
            }
          })
        );
        break;
      case "doc":
        let title = mAt.doc.title;
        if (title.endsWith(`.${mAt.doc.ext}`)) {
          title = title
            .split(".")
            .slice(0, -1)
            .join(".");
        }
        attachments.push(
          new Attachment({
            type:
              mAt.doc.preview && mAt.doc.preview.audio_msg
                ? AttachmentTypes.VOICE
                : AttachmentTypes.DOCUMENT,
            providerInfo: mAt.doc,
            url: mAt.doc.url,

            size: mAt.doc.size,
            mimeType: mime.lookup(mAt.doc.ext),
            filename: `${title}.${mAt.doc.ext}`
          })
        );
        break;
      case "wall":
        attachments.push(
          new Attachment({
            type: AttachmentTypes.LINK,
            providerInfo: mAt.wall,
            url: `https://vk.com/wall${mAt.wall.owner_id}_${mAt.wall.id}`,
            payload: {
              text: `${mAt.wall.text.substr(0, 200)}...`
            }
          })
        );
        break;
      case "sticker":
        attachments.push(
          new Attachment({
            type: AttachmentTypes.STICKER,
            providerInfo: mAt.sticker,
            mimeType: "image/png",
            url: mAt.sticker.images[mAt.sticker.images.length - 1].url,
            width: mAt.sticker.images[mAt.sticker.images.length - 1].width,
            height: mAt.sticker.images[mAt.sticker.images.length - 1].height
          })
        );
        break;
      case "gift":
        attachments.push(
          new Attachment({
            type: AttachmentTypes.PHOTO,
            mimeType: "image/png",
            providerInfo: mAt.gift,
            url: mAt.gift.thumb_256 || mAt.gift.thumb_96 || mAt.gift.thumb_48
          })
        );
        break;
    }
  });
  return attachments;
}

async function uploadPhoto({ vk, providerChatId, payload }) {
  const savedPhoto = await vk.upload.messagePhoto({
    source: payload,
    peer_id: providerChatId
  });
  return savedPhoto.toString();
}
async function uploadDoc({
  vk,
  providerChatId,
  filename,
  title,
  mimeType,
  payload,
  type = "doc"
}) {
  const savedDoc = await vk.upload.messageDocument({
    peer_id: providerChatId,
    source: {
      value: payload,
      filename,
      contentType: mimeType
    },
    type,
    title
  });
  return savedDoc.toString();
}

async function sendWithAttachments(providerChatId, msg, vk) {
  const allowedAttachment = [
    AttachmentTypes.ANIMATION,
    AttachmentTypes.AUDIO,
    AttachmentTypes.DOCUMENT,
    AttachmentTypes.PHOTO,
    AttachmentTypes.VIDEO,
    AttachmentTypes.STICKER,
    AttachmentTypes.VOICE
  ];
  const attachments = await Promise.all(
    msg.attachments
      .filter(({ type }) => allowedAttachment.indexOf(type) !== -1)
      .map(async at => {
        let filename =
          at.filename ||
          (at.mimeType
            ? `${at.type}.${mime.extension(at.mimeType)}`
            : "file.dat");
        if (filename.indexOf(".") === -1) filename += ".dat";
        switch (at.type) {
          case AttachmentTypes.ANIMATION:
          case AttachmentTypes.DOCUMENT:
          case AttachmentTypes.VIDEO: // Uploading videos with community token is not implemented yet
            return uploadDoc({
              vk,
              providerChatId,
              filename: filename,
              title: filename,
              mimeType: at.mimeType || "text/plain",
              payload: at.url
            });

          case AttachmentTypes.AUDIO:
            return uploadDoc({
              vk,
              providerChatId,
              filename: "audio.txt",
              title: `${at.payload.artist} - ${at.payload.title}`,
              mimeType: at.mimeType || "text/plain",
              payload: at.url
            });

          case AttachmentTypes.STICKER:
          case AttachmentTypes.PHOTO:
            return uploadPhoto({ vk, providerChatId, payload: at.url });

          case AttachmentTypes.VOICE:
            return uploadDoc({
              vk,
              providerChatId,
              filename: filename || "voice.ogg",
              mimeType: at.mimeType,
              payload: at.url,
              type: "audio_message"
            });
            break;
          default:
            throw new Error(`Unsupported media type: ${at.type}`);
        }
      })
  );
  const additionalProps = {};

  await Promise.all(
    msg.attachments
      .filter(({ type }) => allowedAttachment.indexOf(type) === -1)
      .map(async at => {
        msg.text = msg.text || "";
        switch (at.type) {
          case AttachmentTypes.CONTACT:
            msg.text = `${at.payload.firstName} ${at.payload.lastName || ""} (${
              at.payload.phone
            })\n${msg.text}`;
            if (at.payload.vcard) {
              const doc = await uploadDoc({
                vk,
                providerChatId,
                filename: "contact.vcf",
                mimeType: "text/vcard",
                payload: Buffer.from(at.payload.vcard)
              });
              attachments.push(doc);
            }
            break;
          case AttachmentTypes.LINK:
            msg.text = `${at.payload.title || ""}  ${at.url}\n${msg.text}`;
            break;
          case AttachmentTypes.LOCATION:
            msg.text = `${at.payload.title || ""}\n${at.payload.address ||
              ""}\n${msg.text}`;
            additionalProps.lat = at.payload.lat;
            additionalProps.long = at.payload.lon;
            break;
        }
      })
  );
  return vk.api.messages.send({
    peer_id: providerChatId,
    attachment: attachments.join(","),
    message: format(msg),
    ...additionalProps
  });
}

module.exports = {
  extractAttachments,
  sendWithAttachments
};
