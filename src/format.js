const { AttachmentTypes } = require("./message");

function timestampToTime(timestamp) {
  return new Date(timestamp * 1000).toTimeString().split(" ")[0];
}

function getMessageIcon(msg) {
  if (msg.icon) {
    return msg.icon;
  }
  const icons = {};
  msg.attachments.forEach(at => {
    switch (at.type) {
      case AttachmentTypes.ANIMATION:
        icons["🏄"] = true;
        break;
      case AttachmentTypes.AUDIO:
        icons["🎵"] = true;
        break;
      case AttachmentTypes.CONTACT:
        icons["☎️"] = true;
        break;
      case AttachmentTypes.DOCUMENT:
        icons["📁"] = true;
        break;
      case AttachmentTypes.LINK:
        icons["🔗"] = true;
        break;
      case AttachmentTypes.LOCATION:
        icons["🌎"] = true;
        break;
      case AttachmentTypes.PHOTO:
        icons["🖼"] = true;
        break;
      case AttachmentTypes.STICKER:
        icons["🗯"] = true;
        break;
      case AttachmentTypes.VIDEO:
        icons["🎬"] = true;
        break;
      case AttachmentTypes.VOICE:
        icons["🎤"] = true;
        break;
    }
  });
  if (Object.keys(icons).length > 0) {
    return Object.keys(icons).join("");
  }
  return "💬";
}

function formatBadge(provider, fullname, username, date) {
  let badge = "";
  if (provider) {
    badge += `${provider}┊`;
  }
  badge += fullname;
  if (username) {
    badge += `┊${username}`;
  }
  if (date) {
    badge += `┊${timestampToTime(date)}`;
  }
  return `〈 ${badge} 〉`;
}

function format(msg, options) {
  const opts = Object.assign(
    {},
    {
      text: true,
      badge: true
    },
    options
  );
  let message = "";

  if (opts.badge) {
    message = `${getMessageIcon(msg)}${formatBadge(
      msg.provider,
      msg.fullname,
      msg.username,
      msg.date
    )}`;
    if (opts.text) {
      message += `:\n${msg.text}`;
    }
  } else if (opts.text) {
    message = msg.text;
  }
  return message;
}

module.exports = {
  getMessageIcon,
  formatBadge,
  format
};
