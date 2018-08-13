const { VK } = jest.genMockFromModule("vk-io");

const promiseFn = () => jest.fn((...args) => Promise.resolve(...args));

VK.mockImplementation(() => ({
  updates: {
    use: jest.fn(),
    hear: jest.fn(),
    on: jest.fn(),
    startPolling: promiseFn()
  },
  api: {
    messages: {
      send: promiseFn()
    }
  }
}));

module.exports = VK;
module.exports.VK = VK;
