/**
 * Error reports go to a third party (Sentry) and error logs to Render.
 * Neither may carry a user's password, tokens, IP, email, query string or
 * the text they send to the AI.
 */

const { scrubEvent, scrubBreadcrumb, redactForLog, stripQueriesInText } = require('../../../server/utils/sentryScrub');

describe('sentryScrub', () => {
  test('error event keeps the error and route, drops personal data and secrets', () => {
    const event = {
      message: 'boom',
      exception: { values: [{ type: 'TypeError', value: 'x is undefined' }] },
      request: {
        url: 'https://click.example/api/media/a.mp4?exp=1&sig=abc',
        method: 'POST',
        query_string: 'exp=1&sig=abc',
        cookies: { sid: 'secret' },
        data: { email: 'a@b.c', password: 'hunter2' },
        headers: { authorization: 'Bearer t', cookie: 'sid=1', 'user-agent': 'UA', 'x-forwarded-for': '1.2.3.4' },
      },
      user: { id: 'u1', email: 'a@b.c', ip_address: '1.2.3.4', username: 'alice' },
      extra: { query: { code: 'oauth-code', page: 2 }, statusCode: 500 },
      tags: { route: '/api/media' },
    };
    const out = scrubEvent(event);
    expect(out.exception.values[0].value).toBe('x is undefined');
    expect(out.request.url).toBe('https://click.example/api/media/a.mp4');
    expect(out.request.method).toBe('POST');
    expect(out.request).not.toHaveProperty('query_string');
    expect(out.request).not.toHaveProperty('cookies');
    expect(out.request).not.toHaveProperty('data');
    expect(out.request.headers).toEqual({ 'user-agent': 'UA' });
    expect(out.user).toEqual({ id: 'u1' });
    expect(out.extra.query.code).toBe('[REDACTED]');
    expect(out.extra.query.page).toBe(2);
    expect(out.extra.statusCode).toBe(500);
    expect(JSON.stringify(out)).not.toMatch(/hunter2|a@b\.c|1\.2\.3\.4|oauth-code|sig=abc/);
  });

  test('AI spans lose prompt and reply text but keep token counts', () => {
    const tx = {
      type: 'transaction',
      transaction: 'GET /api/ai/x?token=abc',
      contexts: { trace: { data: { 'http.url': '/api/ai/x?token=abc', 'http.query': 'token=abc' } } },
      spans: [{
        op: 'gen_ai.request',
        description: 'request gemini',
        data: {
          'gen_ai.request.messages': '[{"role":"user","content":"my private script"}]',
          'gen_ai.response.text': '["reply text"]',
          'gen_ai.usage.input_tokens': 12,
          'gen_ai.request.max_tokens': 1024,
          'gen_ai.request.prompt_chars': 17,
        },
      }],
    };
    const out = scrubEvent(tx);
    expect(out.transaction).toBe('GET /api/ai/x');
    expect(out.contexts.trace.data['http.url']).toBe('/api/ai/x');
    expect(out.contexts.trace.data).not.toHaveProperty('http.query');
    expect(out.spans[0].data).toEqual({
      'gen_ai.usage.input_tokens': 12,
      'gen_ai.request.max_tokens': 1024,
      'gen_ai.request.prompt_chars': 17,
    });
    expect(JSON.stringify(out)).not.toMatch(/private script|reply text|token=abc/);
  });

  test('breadcrumbs lose query strings and secret fields', () => {
    const crumb = scrubBreadcrumb({
      category: 'http',
      message: 'GET /api/oauth/callback?code=xyz failed',
      data: { url: '/api/oauth/callback?code=xyz', method: 'GET', password: 'p' },
    });
    expect(crumb.message).toBe('GET /api/oauth/callback failed');
    expect(crumb.data).toEqual({ url: '/api/oauth/callback', method: 'GET', password: '[REDACTED]' });
  });

  test('redactForLog hides secrets at any depth and bounds size', () => {
    const body = {
      email: 'a@b.c',
      currentPassword: 'old',
      newPassword: 'new',
      profile: { name: 'A', apiKey: 'k', author: 'me' },
      twoFactor: { otp: '123456' },
      refresh_token: 'r',
      long: 'x'.repeat(2000),
      list: Array.from({ length: 30 }, (_, i) => i),
    };
    const out = redactForLog(body);
    expect(out.currentPassword).toBe('[REDACTED]');
    expect(out.newPassword).toBe('[REDACTED]');
    expect(out.profile).toEqual({ name: 'A', apiKey: '[REDACTED]', author: 'me' });
    expect(out.twoFactor.otp).toBe('[REDACTED]');
    expect(out.refresh_token).toBe('[REDACTED]');
    expect(out.long.length).toBeLessThan(600);
    expect(out.list).toHaveLength(21);
    expect(body.currentPassword).toBe('old'); // input not mutated
  });

  test('plain text keeps question marks that are not part of a URL', () => {
    expect(stripQueriesInText('Why did it fail? GET /a?b=1')).toBe('Why did it fail? GET /a');
  });

  test('an event that cannot be cleaned is dropped, not sent raw', () => {
    const evil = { request: {} };
    Object.defineProperty(evil.request, 'headers', { get() { throw new Error('nope'); }, set() { throw new Error('nope'); } });
    expect(scrubEvent(evil)).toBeNull();
  });
});
