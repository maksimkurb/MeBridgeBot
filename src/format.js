function timestampToTime(timestamp) {
  return new Date(timestamp * 1000).toTimeString().split(" ")[0];
}

export function format(message) {
  const username = message.username ? ` #${message.username}` : "";
  return `💬[${message.provider}][${
    message.fullname
  }${username}] [${timestampToTime(message.date)}]:\n${message.text}`;
}
