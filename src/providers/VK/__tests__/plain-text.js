const { VK } = require("vk-io");
const VKProvider = require("../index");
const { Message } = require("../../../message");

if (!process.env.VK_TEST_USER_ID) {
  throw new Error(
    "VK_TEST_USER_ID is required. Bot will chat to this user during test"
  );
}
const peerId = process.env.VK_TEST_USER_ID;

let provider;
beforeEach(() => {
  VK.mockClear();
  provider = new VKProvider({
    token: process.env.VK_TOKEN,
    lang: "en",
    pollingGroupId: process.env.VK_POLLING_GROUP_ID
  });
});

afterEach(() => {
  provider = null;
});

describe("plain text messages", () => {
  it("should send plain text message", async () => {
    await provider.sendMessage(peerId, "Hello");
    expect(provider.vk.api.messages.send).toHaveBeenCalledTimes(1);
    expect(provider.vk.api.messages.send).toHaveBeenCalledWith({
      peer_id: peerId,
      message: "Hello"
    });
  });
  it("should send informative text message", async () => {
    const msg = new Message({
      provider: "na",
      providerChatId: 0,
      providerSenderId: 0,
      text: "Hello, world!"
    });

    await provider.sendMessage(peerId, msg);
    expect(provider.vk.api.messages.send).toHaveBeenCalledTimes(1);
    expect(provider.vk.api.messages.send).toHaveBeenCalledWith({
      peer_id: peerId,
      message: "💬〈 na 〉:\nHello, world!"
    });
  });
  it("should send informative text message with profile", async () => {
    const msg = new Message({
      provider: "na",
      providerChatId: 0,
      providerSenderId: 0,
      profile: {
        fullname: "John Doe",
        username: "johndoe123"
      },
      text: "Hello, world!"
    });

    await provider.sendMessage(peerId, msg);
    expect(provider.vk.api.messages.send).toHaveBeenCalledTimes(1);
    expect(provider.vk.api.messages.send).toHaveBeenCalledWith({
      peer_id: peerId,
      message: "💬〈 na┊John Doe┊johndoe123 〉:\nHello, world!"
    });
  });
});
