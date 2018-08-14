const MAX_DEPTH = 30;

export function unwrapForwardedUserIds(fwdMessages) {
  function process(messages, iteration = 0) {
    if (iteration > MAX_DEPTH) return {};
    let ids = {};
    for (const msg of messages) {
      if (msg.fwd_messages) {
        const innerIds = process(msg.fwd_messages, iteration + 1);
        Object.keys(innerIds).forEach(id => {
          ids[id] = true;
        });
      }
      ids[msg.from_id] = true;
    }
    return ids;
  }
  return Object.keys(process(fwdMessages));
}

export async function unwrapForwardedMessages(fwdMessages, formatBadgeFn) {
  async function process(messages, iteration = 0) {
    if (iteration > MAX_DEPTH) return [];
    let text = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.fwd_messages) {
        text = text.concat(
          (await process(msg.fwd_messages, iteration + 1)).map(r => `›${r}`)
        );
      }

      if (
        msg.from_id > 0 &&
        (i === 0 ||
          msg.from_id !== messages[i - 1].from_id ||
          msg.date - messages[i - 1].date > 300)
      ) {
        text.push(
          `› ${await formatBadgeFn(msg)}${msg.text.length > 0 ? ":" : ""}`
        );
      }
      if (msg.text && msg.text.length > 0) {
        text = text.concat(msg.text.split("\n").map(r => `› ${r}`));
      }
    }

    return text;
  }
  return (await process(fwdMessages)).join("\n");
}
