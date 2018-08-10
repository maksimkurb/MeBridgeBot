function timestampToTime(timestamp) {
  return new Date(timestamp * 1000).toTimeString().split(" ")[0];
}

export function format(msg) {
  const username = msg.username
    ? `${msg.fullname} #${msg.username}`
    : msg.fullname;
  const badge = `[${msg.provider}][${username}][${timestampToTime(msg.date)}]${
    msg.icon ? ` ${msg.icon}` : ""
  }`;
  const text = msg.text !== null ? `:\n${msg.text}` : "";
  return `💬${badge}${text}`;
}
