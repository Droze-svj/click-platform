// aiRouter truncation guard — OpenAI/Anthropic signal a cut-off completion via
// finish_reason 'length' / stop_reason 'max_tokens'. Without a retry, a JSON
// caller parses the partial object to its fallback and silently loses the real
// answer. These tests prove the one-shot retry-at-larger-budget fires.

const mockCreate = jest.fn();
const mockMessagesCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  }));
});

describe('aiRouter truncation retry', () => {
  let aiCall;

  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      ({ aiCall } = require('../../server/utils/aiRouter'));
    });
  });

  beforeEach(() => {
    mockCreate.mockReset();
    mockMessagesCreate.mockReset();
  });

  it('OpenAI: retries once at a larger budget when finish_reason is length, returns the full text', async () => {
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: '{"partial":' }, finish_reason: 'length' }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: '{"full":true}' }, finish_reason: 'stop' }] });

    const res = await aiCall('do it', { preferredProvider: 'openai', maxTokens: 1024 });

    expect(res.text).toBe('{"full":true}');
    expect(res.provider).toBe('openai');
    expect(mockCreate).toHaveBeenCalledTimes(2);
    // Second call bumped the budget past the first.
    expect(mockCreate.mock.calls[0][0].max_tokens).toBe(1024);
    expect(mockCreate.mock.calls[1][0].max_tokens).toBe(2048);
  });

  it('OpenAI: does NOT retry when the first completion finishes cleanly', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: '{"ok":1}' }, finish_reason: 'stop' }] });

    const res = await aiCall('do it', { preferredProvider: 'openai', maxTokens: 1024 });

    expect(res.text).toBe('{"ok":1}');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('OpenAI: keeps the usable first response when the truncation RETRY throws', async () => {
    // First call: truncated but non-empty. Retry (bigger budget) 429s.
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'a usable partial' }, finish_reason: 'length' }] })
      .mockRejectedValueOnce(Object.assign(new Error('rate_limit'), { status: 429 }));

    const res = await aiCall('do it', { preferredProvider: 'openai', maxTokens: 1024 });

    // The good first response survives — a short answer beats a provider failure.
    expect(res.text).toBe('a usable partial');
    expect(res.provider).toBe('openai');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('Anthropic: retries once at a larger budget when stop_reason is max_tokens', async () => {
    mockMessagesCreate
      .mockResolvedValueOnce({ content: [{ text: '{"partial":' }], stop_reason: 'max_tokens' })
      .mockResolvedValueOnce({ content: [{ text: '{"full":true}' }], stop_reason: 'end_turn' });

    const res = await aiCall('do it', { preferredProvider: 'anthropic', maxTokens: 512 });

    expect(res.text).toBe('{"full":true}');
    expect(res.provider).toBe('anthropic');
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
    expect(mockMessagesCreate.mock.calls[0][0].max_tokens).toBe(512);
    expect(mockMessagesCreate.mock.calls[1][0].max_tokens).toBe(1024);
  });
});
