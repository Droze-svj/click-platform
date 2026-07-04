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

  test('twitter/x, instagram, linkedin, facebook, and youtube are wired by default', () => {
    const p = supportedPlatforms();
    expect(p).toEqual(expect.arrayContaining(['twitter', 'x', 'instagram', 'linkedin', 'facebook', 'youtube']));
  });

  test('platforms with no reply API (tiktok/pinterest/threads) are NOT sendable', () => {
    // The responder /platforms route uses this to avoid offering dead send
    // options in the UI — anything draftable but unsendable must be excluded.
    const p = supportedPlatforms();
    for (const dead of ['tiktok', 'pinterest', 'threads']) {
      expect(p).not.toContain(dead);
    }
  });

  test('dispatches to the instagram, linkedin, facebook, and youtube adapters', async () => {
    const seen = [];
    const mk = (tag) => async (u, id) => { seen.push([tag, u, id]); return { ok: 1 }; };
    const adapters = { instagram: mk('ig'), linkedin: mk('li'), facebook: mk('fb'), youtube: mk('yt') };
    await sendReply('u', 'instagram', 'c1', 'hi', adapters);
    await sendReply('u', 'linkedin', 'urn:li:x', 'hi', adapters);
    await sendReply('u', 'facebook', 'fb1', 'hi', adapters);
    await sendReply('u', 'youtube', 'yt1', 'hi', adapters);
    expect(seen).toEqual([['ig', 'u', 'c1'], ['li', 'u', 'urn:li:x'], ['fb', 'u', 'fb1'], ['yt', 'u', 'yt1']]);
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
