
export default class BaseProvider {
  constructor () {
    this.eventListeners = {
      message: []
    }
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
}
