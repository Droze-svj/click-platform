/**
 * Single source of truth for the JWT signing secret.
 *
 * Rules:
 *  - In production (NODE_ENV=production): throws at startup if JWT_SECRET is
 *    not set so the server never runs with a weak secret.
 *  - In development: falls back to a clearly-labelled insecure default and
 *    emits a startup warning so devs know they need to set JWT_SECRET before
 *    going to production.
 */

const DEV_FALLBACK = 'click-dev-fallback-NOT-FOR-PRODUCTION';

let _secret = null;

function getJwtSecret() {
  if (_secret) return _secret;

  const raw = process.env.JWT_SECRET;

  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: JWT_SECRET environment variable is required in production. ' +
        'Set it to a cryptographically random 64-character hex string.'
      );
    }
    // Dev-only warning — only logged once thanks to the cache above.
    const logger = require('./logger');
    logger.warn(
      '⚠️  JWT_SECRET not set — using insecure dev fallback. ' +
      'This WILL break in production. Set JWT_SECRET in your .env file.'
    );
    _secret = DEV_FALLBACK;
  } else {
    _secret = raw;
  }

  return _secret;
}

module.exports = { getJwtSecret };
