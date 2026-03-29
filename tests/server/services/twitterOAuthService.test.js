// Unit tests for X (Twitter) OAuth service

const twitterOAuth = require('../../../server/services/twitterOAuthService');

describe('twitterOAuthService', () => {
  describe('isConfigured', () => {
    it('returns boolean', () => {
      expect(typeof twitterOAuth.isConfigured()).toBe('boolean');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('returns url and codeVerifier when configured', () => {
      if (!twitterOAuth.isConfigured()) {
        return; // skip when credentials not set
      }
      const state = 'test-state-123';
      const result = twitterOAuth.getAuthorizationUrl(state);
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('codeVerifier');
      expect(result.url).toContain('twitter.com');
      expect(result.url).toContain('oauth2/authorize');
      expect(result.url).toContain('state=' + state);
    });

  });

  describe('API surface', () => {
    it('exposes required methods', () => {
      expect(typeof twitterOAuth.isConfigured).toBe('function');
      expect(typeof twitterOAuth.getAuthorizationUrl).toBe('function');
      expect(typeof twitterOAuth.exchangeCodeForToken).toBe('function');
      expect(typeof twitterOAuth.getUserProfile).toBe('function');
      expect(typeof twitterOAuth.postTweet).toBe('function');
      expect(typeof twitterOAuth.refreshToken).toBe('function');
    });
  });
});
