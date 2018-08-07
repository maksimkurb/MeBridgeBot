
export default class BaseProvider {
  constructor () {
    this.eventListeners = {
      message: []
    }
    this.onMessage = this.onMessage.bind(this)
  }

  addEventListener (type, listener) {
    if (!this.eventListeners.hasOwnProperty(type)) {
      return
    }
    this.eventListeners[type].push(listener)
  }
  removeEventListener (type, listener) {
    if (this.eventListeners.hasOwnProperty(type)) {
      const idx = this.eventListeners[type].findIndex(listener)
      if (idx !== -1) {
        this.eventListeners[type].splice(idx, 1)
      }
    }
  }

  async onMessage (ctx) {
    const msg = await this.extractMessage(ctx)
    this.eventListeners.message.forEach(cb => {
      cb(this.PROVIDER, msg, ctx)
    })
  }
}
