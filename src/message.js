export const AttachmentTypes = {
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

export class Attachment {
  constructor(props) {
    if (!AttachmentTypes[props.type]) throw new Error("Wrong attachment type");
    this.type = props.type;

    this.providerInfo = props.providerInfo;

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

export class Message {
  constructor(props) {
    if (!props.provider) throw new Error("Provider is required for a message");
    this.provider = props.provider;

    if (!props.hasOwnProperty("providerChatId"))
      throw new Error("ProviderChatId is required for a message");
    this.providerChatId = props.providerChatId;

    if (!props.hasOwnProperty("providerSenderId"))
      throw new Error("ProviderSenderId is required for a message");
    this.providerSenderId = props.providerSenderId;

    this.chatTitle = props.chatTitle || `#${this.providerChatId}`;
    this.icon = props.icon || null;
    this.meta = props.meta || null;
    this.profile = props.profile || null;
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
