const { maskUrl } = require('../../server/middleware/requestLogger');

describe('requestLogger.maskUrl — secret redaction in logged URLs', () => {
  it('masks OAuth code/state', () => {
    expect(maskUrl('/api/oauth/google/callback?code=SECRET123&state=xyz&foo=bar'))
      .toBe('/api/oauth/google/callback?code=***&state=***&foo=bar');
  });
  it('masks signed-media sig (keeps exp)', () => {
    expect(maskUrl('/uploads/v.mp4?exp=123&sig=deadbeef')).toBe('/uploads/v.mp4?exp=123&sig=***');
  });
  it('masks token/secret/password/apiKey', () => {
    expect(maskUrl('/x?token=a&secret=b&password=c&apiKey=d'))
      .toBe('/x?token=***&secret=***&password=***&apiKey=***');
  });
  it('leaves non-sensitive params untouched', () => {
    expect(maskUrl('/x?page=2&limit=20&sort=createdAt')).toBe('/x?page=2&limit=20&sort=createdAt');
  });
  it('handles no query string / empty', () => {
    expect(maskUrl('/api/health')).toBe('/api/health');
    expect(maskUrl('')).toBe('');
    expect(maskUrl(undefined)).toBe('');
  });
});
