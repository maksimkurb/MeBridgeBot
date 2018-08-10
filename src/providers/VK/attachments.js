import FormData from "form-data";
import fetch from "node-fetch";
import mime from "mime-types";
import { Attachment, AttachmentTypes } from "../../message";
import { format } from "../../format.js";
import { resolve } from "url";

export async function extractAttachments(ctx, msg) {
  const attachments = [];
  if (msg.geo) {
    attachments.push(
      new Attachment({
        type: AttachmentTypes.LOCATION,
        originInfo: msg.geo,
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
            originInfo: mAt.photo,
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
            originInfo: mAt.video,
            url: `https://vk.com/video${mAt.video.owner_id}_${mAt.video.id}`,

            payload: {
              title: mAt.video.title
            }
          })
        );
        break;
      case "audio":
        attachments.push(
          new Attachment({
            type: AttachmentTypes.LINK,
            originInfo: mAt.audio,
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
        console.log(mAt.link);
        attachments.push(
          new Attachment({
            type: AttachmentTypes.LINK,
            originInfo: mAt.link,
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
            originInfo: mAt.doc,
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
            originInfo: mAt.wall,
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
            originInfo: mAt.sticker,
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
            originInfo: mAt.gift,
            url: mAt.gift.thumb_256 || mAt.gift.thumb_96 || mAt.gift.thumb_48
          })
        );
        break;
    }
  });
  return attachments;
}

async function uploadFile(uploadUrl, field, filename, urlOrBuffer) {
  if (!(urlOrBuffer instanceof Buffer)) {
    urlOrBuffer = await fetch(urlOrBuffer).then(res => res.buffer());
  }
  const form = new FormData();
  form.append(field, urlOrBuffer, { filename });
  return fetch(uploadUrl, { method: "POST", body: form }).then(res =>
    res.json()
  );
}

async function uploadPhoto(vk, chatId, filename, urlOrBuffer) {
  const uploadServer = await vk.execute("photos.getMessagesUploadServer", {
    peer_id: chatId
  });
  const uploadedFile = await uploadFile(
    uploadServer.upload_url,
    "photo",
    filename,
    urlOrBuffer
  );
  const savedPhoto = await vk.execute("photos.saveMessagesPhoto", {
    server: uploadedFile.server,
    photo: uploadedFile.photo,
    hash: uploadedFile.hash
  });
  return `photo${savedPhoto[0].owner_id}_${savedPhoto[0].id}`;
}
async function uploadDoc(vk, chatId, filename, urlOrBuffer, type = "doc") {
  const uploadServer = await vk.execute("docs.getMessagesUploadServer", {
    peer_id: chatId,
    type
  });
  const uploadedFile = await uploadFile(
    uploadServer.upload_url,
    "file",
    filename,
    urlOrBuffer
  );
  const savedDoc = await vk.execute("docs.save", {
    file: uploadedFile.file,
    title: filename
  });
  return `doc${savedDoc[0].owner_id}_${savedDoc[0].id}`;
}

export async function sendWithAttachments(chatId, msg, vk) {
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
        const filename =
          at.filename ||
          (at.mimeType
            ? `${at.type}.${mime.extension(at.mimeType)}`
            : `${at.type}.dat`);
        switch (at.type) {
          case AttachmentTypes.ANIMATION:
          case AttachmentTypes.DOCUMENT:
          case AttachmentTypes.VIDEO: // Uploading videos with community token is not implemented yet
            return uploadDoc(vk, chatId, filename, at.url);

          case AttachmentTypes.AUDIO:
            return uploadDoc(vk, chatId, `${filename}.txt`, at.url);

          case AttachmentTypes.STICKER:
          case AttachmentTypes.PHOTO:
            return uploadPhoto(vk, chatId, filename, at.url);

          case AttachmentTypes.VOICE:
            return uploadDoc(vk, chatId, filename, at.url, "audio_message");
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
              const doc = await uploadDoc(
                vk,
                chatId,
                "contact.vcf",
                Buffer.from(at.payload.vcard)
              );
              attachments.push(doc);
            }
            break;
          case AttachmentTypes.LINK:
            msg.text = `${at.payload.title || ""}  ${at.url}\n${msg.text}`;
            break;
          case AttachmentTypes.LOCATION:
            msg.text = `${at.payload.title || "[Location]"}\n${at.payload
              .address || ""}\n${msg.text}`;
            additionalProps.lat = at.payload.lat;
            additionalProps.long = at.payload.lon;
            break;
        }
      })
  );
  return vk.execute("messages.send", {
    peer_id: chatId,
    attachment: attachments.join(","),
    message: format(msg),
    ...additionalProps
  });
}
