const AttachmentTypes = {
  ANIMATION: "ANIMATION",
  AUDIO: "AUDIO",
  CONTACT: "CONTACT",
  DOCUMENT: "DOCUMENT",
  LINK: "LINK",
  LOCATION: "LOCATION",
  PHOTO: "PHOTO",
  STICKER: "STICKER",
  VIDEO: "VIDEO",
  VOICE: "VOICE"
};

class Attachment {
  constructor(props) {
    if (!AttachmentTypes[props.type]) throw new Error("Wrong attachment type");
    this.type = props.type;

    this.originInfo = props.originInfo;

    if (!props.url && !props.payload)
      throw new Error("Attachment URL or payload is required");
    this.url = props.url;
    this.payload = props.payload;
    this.size = props.size || null;
    this.filename = props.filename || null;
    this.mimeType = props.mimeType || null;
    this.duration = props.duration || null;
    this.height = props.height || null;
    this.width = props.width || null;
  }
}

class Message {
  constructor(props) {
    if (!props.provider) throw new Error("Provider is required for a message");
    this.provider = props.provider;

    if (!props.originChatId)
      throw new Error("OriginChatId is required for a message");
    this.originChatId = props.originChatId;

    if (!props.originSenderId)
      throw new Error("OriginSenderId is required for a message");
    this.originSenderId = props.originSenderId;

    this.chatTitle = props.chatTitle || `#${this.originChatId}`;
    this.icon = props.icon || null;
    this.meta = props.meta || null;
    this.fullname = props.fullname || null;
    this.username = props.username || null;
    this.url = props.url || null;
    this.text = props.text || null;
    this.attachments = props.attachments || [];
    this.date = props.date || null;
  }

  clone() {
    const clone = Object.assign({}, this);
    Object.setPrototypeOf(clone, Message.prototype);
    return clone;
  }
}

module.exports = {
  Message,
  Attachment,
  AttachmentTypes
};
