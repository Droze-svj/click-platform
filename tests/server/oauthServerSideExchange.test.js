// Tests for the feature-flagged server-side OAuth exchange helper. The most
// important property is that the flag defaults OFF (so google/fb/linkedin keep
// their current behavior until staging validation flips it on). Plus: the
// signed state round-trips userId + the inner nonce, and tampering is rejected.

const ssx = require('../../server/utils/oauthServerSideExchange');

const ORIG = process.env.OAUTH_SERVER_SIDE_EXCHANGE;
afterEach(() => {
  if (ORIG === undefined) delete process.env.OAUTH_SERVER_SIDE_EXCHANGE;
  else process.env.OAUTH_SERVER_SIDE_EXCHANGE = ORIG;
});

describe('oauthServerSideExchange', () => {
  test('flag defaults OFF; only an explicit "true" enables it', () => {
    delete process.env.OAUTH_SERVER_SIDE_EXCHANGE;
    expect(ssx.serverSideExchangeEnabled()).toBe(false);
    process.env.OAUTH_SERVER_SIDE_EXCHANGE = 'false';
    expect(ssx.serverSideExchangeEnabled()).toBe(false);
    process.env.OAUTH_SERVER_SIDE_EXCHANGE = 'TRUE';
    expect(ssx.serverSideExchangeEnabled()).toBe(true);
  });

  test('wrap → unwrap round-trips userId + inner state nonce, preserving other params', () => {
    const provider = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=nonce-abc&scope=y';
    const wrapped = ssx.wrapAuthorizeUrl(provider, 'user-123', 'google');
    const outerState = new URL(wrapped).searchParams.get('state');
    expect(outerState).not.toBe('nonce-abc'); // swapped for the signed blob
    expect(new URL(wrapped).searchParams.get('client_id')).toBe('x');
    expect(new URL(wrapped).searchParams.get('scope')).toBe('y');
    expect(ssx.unwrapCallbackState(outerState)).toEqual({ userId: 'user-123', innerState: 'nonce-abc' });
  });

  test('rejects tampered / garbage / empty / non-ssx state', () => {
    const wrapped = ssx.wrapAuthorizeUrl('https://p/auth?state=n', 'u1', 'google');
    const outer = new URL(wrapped).searchParams.get('state');
    expect(ssx.unwrapCallbackState(outer + 'x')).toBeNull(); // broken HMAC
    expect(ssx.unwrapCallbackState('garbage')).toBeNull();
    expect(ssx.unwrapCallbackState('')).toBeNull();
    expect(ssx.unwrapCallbackState(null)).toBeNull();
  });
});
