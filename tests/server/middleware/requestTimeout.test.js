// Request timeout middleware unit tests

const {
  getTimeoutForRoute,
  getRouteTypeFromPath,
  timeoutConfig,
  requestTimeout,
  routeTimeout,
} = require('../../../server/middleware/requestTimeout');

describe('requestTimeout middleware', () => {
  describe('getTimeoutForRoute', () => {
    it('returns default timeout for unknown route type', () => {
      expect(getTimeoutForRoute('default')).toBe(30000);
      expect(getTimeoutForRoute('unknown')).toBe(30000);
    });
    it('returns upload timeout for upload type', () => {
      expect(getTimeoutForRoute('upload')).toBe(300000);
    });
    it('returns processing timeout for processing type', () => {
      expect(getTimeoutForRoute('processing')).toBe(600000);
    });
    it('returns auth timeout for auth type', () => {
      expect(getTimeoutForRoute('auth')).toBe(10000);
    });
  });

  describe('getRouteTypeFromPath', () => {
    it('returns upload for video upload paths', () => {
      expect(getRouteTypeFromPath('/api/video/upload')).toBe('upload');
      expect(getRouteTypeFromPath('/api/video/something/upload')).toBe('upload');
    });
    it('returns processing for video and export paths', () => {
      expect(getRouteTypeFromPath('/api/video/123')).toBe('processing');
      expect(getRouteTypeFromPath('/api/export/xyz')).toBe('processing');
      expect(getRouteTypeFromPath('/api/something/render')).toBe('processing');
    });
    it('returns analytics for analytics paths', () => {
      expect(getRouteTypeFromPath('/api/analytics')).toBe('analytics');
      expect(getRouteTypeFromPath('/api/report/123')).toBe('analytics');
    });
    it('returns auth for auth paths', () => {
      expect(getRouteTypeFromPath('/api/auth/login')).toBe('auth');
      expect(getRouteTypeFromPath('/api/oauth/callback')).toBe('auth');
    });
    it('returns default for other paths', () => {
      expect(getRouteTypeFromPath('/api/content')).toBe('default');
      expect(getRouteTypeFromPath('/')).toBe('default');
    });
  });

  describe('timeoutConfig', () => {
    it('has expected keys and positive values', () => {
      expect(timeoutConfig.default).toBeGreaterThan(0);
      expect(timeoutConfig.upload).toBeGreaterThan(timeoutConfig.default);
      expect(timeoutConfig.processing).toBeGreaterThan(timeoutConfig.upload);
    });
  });

  describe('requestTimeout', () => {
    it('returns a function', () => {
      const mw = requestTimeout(5000);
      expect(typeof mw).toBe('function');
      expect(mw.length).toBe(3);
    });
  });

  describe('routeTimeout', () => {
    it('returns a function', () => {
      const mw = routeTimeout(5000);
      expect(typeof mw).toBe('function');
      expect(mw.length).toBe(3);
    });
  });
});
