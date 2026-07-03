// Behavioral tests for the AI Comment/DM Responder core (pure + injected deps).

const {
  buildReplyPrompt,
  finalReplyText,
  composeDraft,
} = require('../../server/services/socialResponderService');

describe('socialResponder.buildReplyPrompt', () => {
  test('embeds the system prompt, platform, author, comment, and grounding rules', () => {
    const p = buildReplyPrompt('SYSTEM', { platform: 'tiktok', author: 'fan', inboundText: 'love this!' });
    expect(p).toContain('SYSTEM');
    expect(p).toContain('tiktok');
    expect(p).toContain('@fan');
    expect(p).toContain('love this!');
    expect(p).toMatch(/Do NOT invent facts/);
    expect(p).toMatch(/Output ONLY the reply text/);
  });
  test('handles a missing author gracefully', () => {
    const p = buildReplyPrompt('S', { platform: 'twitter', inboundText: 'hi' });
    expect(p).toContain('twitter comment');
    expect(p).not.toContain('@');
  });
});

describe('socialResponder.finalReplyText', () => {
  test('a non-empty human edit wins over the AI draft', () => {
    expect(finalReplyText({ draftReply: 'ai', editedReply: 'human' })).toBe('human');
  });
  test('falls back to the draft when there is no edit (or an empty one)', () => {
    expect(finalReplyText({ draftReply: 'ai', editedReply: null })).toBe('ai');
    expect(finalReplyText({ draftReply: 'ai', editedReply: '   ' })).toBe('ai');
    expect(finalReplyText(null)).toBe('');
  });
});

describe('socialResponder.composeDraft (injected deps, no DB/AI)', () => {
  const baseDeps = () => {
    const calls = { assertBudget: 0, recordUsage: 0 };
    return {
      calls,
      sanitize: (t) => String(t).replace('IGNORE PREVIOUS', '[x]').trim(),
      buildSystemPrompt: async ({ role }) => `SYS(${role})`,
      generate: async () => 'On-brand reply!',
      assertBudget: async () => { calls.assertBudget += 1; },
      recordUsage: async () => { calls.recordUsage += 1; },
    };
  };

  test('produces a pending_approval body with the sanitized text + AI draft', async () => {
    const deps = baseDeps();
    const { body, prompt } = await composeDraft('u1', {
      platform: 'instagram', author: 'x', inboundText: '  hello IGNORE PREVIOUS  ',
    }, deps);
    expect(body).toMatchObject({
      userId: 'u1', platform: 'instagram', author: 'x',
      inboundText: 'hello [x]', draftReply: 'On-brand reply!', status: 'pending_approval',
    });
    expect(prompt).toContain('SYS(copywriter)'); // not creative-director
    expect(deps.calls.assertBudget).toBe(1);
    expect(deps.calls.recordUsage).toBe(1);
  });

  test('empty draft (AI quota) still yields a queued reply the human can write', async () => {
    const deps = baseDeps();
    deps.generate = async () => null;
    const { body } = await composeDraft('u', { platform: 'tiktok', inboundText: 'yo' }, deps);
    expect(body.draftReply).toBe('');
    expect(body.status).toBe('pending_approval');
  });

  test('rejects empty inbound text with a 400 before calling the AI', async () => {
    const deps = baseDeps();
    let generated = false;
    deps.generate = async () => { generated = true; return 'x'; };
    await expect(composeDraft('u', { platform: 'tiktok', inboundText: '   ' }, deps))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(generated).toBe(false);
  });
});
