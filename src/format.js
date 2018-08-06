function timestampToTime (timestamp) {
  return new Date(timestamp * 1000).toTimeString().split(' ')[0]
}

export function formatForVk (message) {
  const url = message.url ? ` ${message.url}` : ''
  return `👤[${message.fullname}${url}] [${timestampToTime(message.date)}]:\n${message.text}`
}
export function formatForTelegram (message) {
  const userBadge = message.url ? `<a href="${message.url}">${message.fullname}</a>` : message.fullname
  return `👤[${userBadge}] [${timestampToTime(message.date)}]:\n${message.text}`
}
