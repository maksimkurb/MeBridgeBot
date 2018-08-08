
class Message {
  constructor (props) {
    if (!props.provider) throw new Error('Provider is required for a message')
    this.provider = props.provider

    if (!props.originChatId) throw new Error('OriginChatId is required for a message')
    this.originChatId = props.originChatId

    if (!props.originSenderId) throw new Error('OriginSenderId is required for a message')
    this.originSenderId = props.originSenderId

    this.chatTitle = props.chatTitle || `#${this.originChatId}`
    this.fullname = props.fullname || null
    this.username = props.username || null
    this.url = props.url || null
    this.text = props.text || null
    this.attachments = props.attachments || []
    this.date = props.date || null
  }
}

export default Message
