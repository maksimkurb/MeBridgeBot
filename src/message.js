
class Message {
  constructor (props) {
    if (!props.provider) throw new Error('Provider is required for a message')
    this.provider = props.provider

    if (!props.originChatId) throw new Error('OriginChatId is required for a message')
    this.originChatId = props.originChatId

    if (!props.originSenderId) throw new Error('OriginSenderId is required for a message')
    this.originSenderId = props.originSenderId

    this.fullname = props.fullname
    this.url = props.url
    this.text = props.text
    this.attachments = props.attachments
    this.date = props.date
  }
}

export default Message
