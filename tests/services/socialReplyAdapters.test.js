// Tests for the social reply adapter registry (dispatch logic, injectable).

const {
  sendReply,
  supportedPlatforms,
} = require('../../server/services/socialReplyAdapters');

describe('socialReplyAdapters.sendReply', () => {
  test('dispatches to the matching platform adapter with the right args', async () => {
    const calls = [];
    const adapters = {
      twitter: async (userId, id, text) => { calls.push([userId, id, text]); return { ok: true }; },
    };
    const out = await sendReply('u1', 'twitter', 'tweet123', 'hi there', adapters);
    expect(out).toEqual({ ok: true });
    expect(calls[0]).toEqual(['u1', 'tweet123', 'hi there']);
  });

  test('throws 501 for an unsupported platform', async () => {
    await expect(sendReply('u', 'youtube', 'c1', 'x', {}))
      .rejects.toMatchObject({ statusCode: 501 });
  });

  test('throws 400 when the target comment id is missing', async () => {
    const adapters = { twitter: async () => ({ ok: true }) };
    await expect(sendReply('u', 'twitter', '', 'x', adapters))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('twitter and x are wired by default', () => {
    const p = supportedPlatforms();
    expect(p).toContain('twitter');
    expect(p).toContain('x');
  });
});

describe('socialResponder.defaultSender → adapter dispatch', () => {
  test('sendApprovedReply stays hard-gated behind SOCIAL_REPLY_SEND', async () => {
    const responder = require('../../server/services/socialResponderService');
    const prev = process.env.SOCIAL_REPLY_SEND;
    delete process.env.SOCIAL_REPLY_SEND;
    // Flag off → 501 before any DB/adapter work, regardless of platform support.
    await expect(responder.sendApprovedReply('u', 'someid'))
      .rejects.toMatchObject({ statusCode: 501 });
    if (prev !== undefined) process.env.SOCIAL_REPLY_SEND = prev;
  });
});
