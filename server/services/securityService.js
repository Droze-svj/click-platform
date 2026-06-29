// Advanced Security Service
// 2FA, IP whitelisting, device management, security monitoring

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');
const redisCache = require('../utils/redisCache');

// ── Shared per-user security state (events / devices / IP whitelist) ─────────
// Was in-memory-only Maps, so on a multi-instance deploy each instance saw a
// DIFFERENT view (a device revoked on instance A still appeared on B, the
// security event log was split, etc.). Now read-through / write-through Redis
// (via redisCache, JSON blobs with TTL) so every instance shares one view, with
// the in-memory Maps kept as the fallback when Redis is absent (single-instance
// dev, or Redis down). Blob read-modify-write is best-effort (audit/UX state,
// not auth-critical), which is acceptable for these categories.
const securityEvents = new Map(); // userId -> [events]   (fallback cache)
const blockedIPs = new Set();      // global; NOT shared (no enforcement consumers)
const whitelistedIPs = new Map();  // userId -> [ips]      (fallback cache)
const deviceSessions = new Map();  // userId -> [devices]  (fallback cache)

const STATE_TTL_SECONDS = 30 * 24 * 3600; // 30 days
const stateKey = {
  events: (u) => `sec:events:${u}`,
  devices: (u) => `sec:devices:${u}`,
  whitelist: (u) => `sec:wl:${u}`,
};

/** Read a per-user array from Redis (shared) or the in-memory fallback. */
async function readState(key, memMap, memKey) {
  if (redisCache.isConnected) {
    try {
      const v = await redisCache.get(key);
      if (Array.isArray(v)) { memMap.set(memKey, v); return v; } // refresh fallback
    } catch (_) { /* fall through to memory */ }
  }
  const m = memMap.get(memKey);
  return Array.isArray(m) ? m : [];
}

/** Write a per-user array to Redis (shared) AND the in-memory fallback. */
async function writeState(key, arr, memMap, memKey) {
  // Bound the in-memory fallback (FIFO) so it can't grow unbounded when Redis is
  // absent and many distinct users are active over the process lifetime.
  if (!memMap.has(memKey) && memMap.size >= 10000) {
    const oldest = memMap.keys().next().value;
    if (oldest !== undefined) memMap.delete(oldest);
  }
  memMap.set(memKey, arr);
  if (redisCache.isConnected) {
    try { await redisCache.set(key, arr, STATE_TTL_SECONDS); } catch (_) { /* best-effort */ }
  }
}

/**
 * Generate 2FA secret for user
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {Promise<Object>} 2FA setup data
 */
async function generate2FASecret(userId, email) {
  try {
    const secret = speakeasy.generateSecret({
      name: `Click Platform (${email})`,
      issuer: 'Click Platform',
      length: 32,
    });

    // Store secret temporarily (user needs to verify before saving)
    const tempSecret = {
      secret: secret.base32,
      userId,
      createdAt: new Date(),
    };

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    logger.info('2FA secret generated', { userId });

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32,
    };
  } catch (error) {
    logger.error('Error generating 2FA secret', { error: error.message, userId });
    throw error;
  }
}

/**
 * Verify 2FA token
 * @param {string} userId - User ID
 * @param {string} token - 2FA token
 * @returns {Promise<boolean>} Is valid
 */
async function verify2FAToken(userId, token) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.twoFactorSecret) {
      return false;
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2, // Allow 2 time steps (60 seconds) of tolerance
    });

    if (verified) {
      logger.info('2FA token verified', { userId });
    } else {
      logger.warn('2FA token verification failed', { userId });
      trackSecurityEvent(userId, '2fa_failed', { token });
    }

    return verified;
  } catch (error) {
    logger.error('Error verifying 2FA token', { error: error.message, userId });
    return false;
  }
}

/**
 * Enable 2FA for user
 * @param {string} userId - User ID
 * @param {string} token - Verification token
 * @param {string} secret - 2FA secret
 * @returns {Promise<boolean>} Success
 */
async function enable2FA(userId, token, secret) {
  try {
    // Verify token first
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2,
    });

    if (!verified) {
      throw new Error('Invalid 2FA token');
    }

    // Save to user
    await User.findByIdAndUpdate(userId, {
      twoFactorSecret: secret,
      twoFactorEnabled: true,
    });

    trackSecurityEvent(userId, '2fa_enabled', {});
    logger.info('2FA enabled', { userId });

    return true;
  } catch (error) {
    logger.error('Error enabling 2FA', { error: error.message, userId });
    throw error;
  }
}

/**
 * Disable 2FA for user
 * @param {string} userId - User ID
 * @param {string} password - User password (for verification)
 * @returns {Promise<boolean>} Success
 */
async function disable2FA(userId, password) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify password (would use proper password verification)
    // For now, just check if user exists

    await User.findByIdAndUpdate(userId, {
      twoFactorSecret: null,
      twoFactorEnabled: false,
    });

    trackSecurityEvent(userId, '2fa_disabled', {});
    logger.info('2FA disabled', { userId });

    return true;
  } catch (error) {
    logger.error('Error disabling 2FA', { error: error.message, userId });
    throw error;
  }
}

/**
 * Add IP to whitelist
 * @param {string} userId - User ID
 * @param {string} ip - IP address
 * @returns {Promise<boolean>} Success
 */
async function whitelistIP(userId, ip) {
  try {
    const ips = await readState(stateKey.whitelist(userId), whitelistedIPs, userId);
    if (!ips.includes(ip)) ips.push(ip);
    await writeState(stateKey.whitelist(userId), ips, whitelistedIPs, userId);

    trackSecurityEvent(userId, 'ip_whitelisted', { ip });
    logger.info('IP whitelisted', { userId, ip });

    return true;
  } catch (error) {
    logger.error('Error whitelisting IP', { error: error.message, userId, ip });
    throw error;
  }
}

/**
 * Remove IP from whitelist
 * @param {string} userId - User ID
 * @param {string} ip - IP address
 * @returns {Promise<boolean>} Success
 */
async function removeWhitelistedIP(userId, ip) {
  try {
    const ips = (await readState(stateKey.whitelist(userId), whitelistedIPs, userId)).filter((x) => x !== ip);
    await writeState(stateKey.whitelist(userId), ips, whitelistedIPs, userId);

    trackSecurityEvent(userId, 'ip_removed', { ip });
    logger.info('IP removed from whitelist', { userId, ip });

    return true;
  } catch (error) {
    logger.error('Error removing whitelisted IP', { error: error.message, userId, ip });
    throw error;
  }
}

/**
 * Check if IP is whitelisted
 * @param {string} userId - User ID
 * @param {string} ip - IP address
 * @returns {boolean} Is whitelisted
 */
async function isIPWhitelisted(userId, ip) {
  const ips = await readState(stateKey.whitelist(userId), whitelistedIPs, userId);
  if (!ips.length) return false; // No whitelist = allow all
  return ips.includes(ip);
}

/**
 * Block IP address
 * @param {string} ip - IP address
 * @param {number} duration - Duration in minutes (0 = permanent)
 * @returns {Promise<boolean>} Success
 */
async function blockIP(ip, duration = 0) {
  try {
    // Bound the in-memory block list (FIFO) so permanent blocks (duration 0)
    // can't grow it unbounded over the process lifetime.
    if (!blockedIPs.has(ip) && blockedIPs.size >= 50000) {
      const oldest = blockedIPs.values().next().value;
      if (oldest !== undefined) blockedIPs.delete(oldest);
    }
    blockedIPs.add(ip);

    if (duration > 0) {
      const expiry = setTimeout(() => {
        blockedIPs.delete(ip);
        logger.info('IP block expired', { ip });
      }, duration * 60 * 1000);
      if (typeof expiry.unref === 'function') expiry.unref();
    }

    logger.warn('IP blocked', { ip, duration });
    return true;
  } catch (error) {
    logger.error('Error blocking IP', { error: error.message, ip });
    throw error;
  }
}

/**
 * Check if IP is blocked
 * @param {string} ip - IP address
 * @returns {boolean} Is blocked
 */
function isIPBlocked(ip) {
  return blockedIPs.has(ip);
}

/**
 * Track device session
 * @param {string} userId - User ID
 * @param {Object} deviceInfo - Device information
 * @returns {Promise<Object>} Device session
 */
async function trackDevice(userId, deviceInfo) {
  try {
    const device = {
      id: crypto.randomBytes(16).toString('hex'),
      userId,
      ...deviceInfo,
      firstSeen: new Date(),
      lastSeen: new Date(),
      trusted: false,
    };

    const devices = await readState(stateKey.devices(userId), deviceSessions, userId);
    devices.push(device);
    // Keep last 10 devices
    while (devices.length > 10) devices.shift();
    await writeState(stateKey.devices(userId), devices, deviceSessions, userId);

    trackSecurityEvent(userId, 'device_registered', { deviceId: device.id });
    logger.info('Device tracked', { userId, deviceId: device.id });

    return device;
  } catch (error) {
    logger.error('Error tracking device', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get user devices
 * @param {string} userId - User ID
 * @returns {Array} User devices
 */
async function getUserDevices(userId) {
  return readState(stateKey.devices(userId), deviceSessions, userId);
}

/**
 * Revoke device
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @returns {Promise<boolean>} Success
 */
async function revokeDevice(userId, deviceId) {
  try {
    const devices = await readState(stateKey.devices(userId), deviceSessions, userId);
    const index = devices.findIndex((d) => d.id === deviceId);
    if (index !== -1) {
      devices.splice(index, 1);
      await writeState(stateKey.devices(userId), devices, deviceSessions, userId);
      trackSecurityEvent(userId, 'device_revoked', { deviceId });
      logger.info('Device revoked', { userId, deviceId });
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error revoking device', { error: error.message, userId, deviceId });
    throw error;
  }
}

/**
 * Track security event
 * @param {string} userId - User ID
 * @param {string} eventType - Event type
 * @param {Object} metadata - Event metadata
 */
// Async (Redis-backed) but safe to call fire-and-forget: it self-handles errors
// and never rejects, so callers that don't await it won't see an unhandled
// rejection. Audit events are best-effort.
async function trackSecurityEvent(userId, eventType, metadata = {}) {
  try {
    const event = {
      type: eventType,
      userId,
      timestamp: new Date(),
      metadata,
    };

    const events = await readState(stateKey.events(userId), securityEvents, userId);
    events.push(event);
    // Keep last 100 events per user
    while (events.length > 100) events.shift();
    await writeState(stateKey.events(userId), events, securityEvents, userId);

    // Log security events
    if (eventType.includes('failed') || eventType.includes('blocked')) {
      logger.warn('Security event', { userId, eventType, metadata });
    }
  } catch (error) {
    logger.error('Error tracking security event', { error: error.message });
  }
}

/**
 * Get security events for user
 * @param {string} userId - User ID
 * @param {number} limit - Limit results
 * @returns {Array} Security events
 */
async function getSecurityEvents(userId, limit = 50) {
  const events = await readState(stateKey.events(userId), securityEvents, userId);
  return events.slice(-limit).reverse();
}

/**
 * Get security summary for user
 * @param {string} userId - User ID
 * @returns {Object} Security summary
 */
async function getSecuritySummary(userId) {
  const events = await getSecurityEvents(userId, 100);
  const recentEvents = events.slice(0, 10);

  const failedLogins = events.filter((e) => e.type === 'login_failed').length;
  const blockedCount = events.filter((e) => e.type === 'ip_blocked').length;
  const devices = await getUserDevices(userId);
  const whitelist = await readState(stateKey.whitelist(userId), whitelistedIPs, userId);

  return {
    userId,
    totalEvents: events.length,
    recentEvents,
    failedLogins,
    blockedIPs: blockedCount,
    deviceCount: devices.length,
    devices: devices.slice(0, 5), // Last 5 devices
    whitelistedIPs: whitelist,
  };
}

module.exports = {
  generate2FASecret,
  verify2FAToken,
  enable2FA,
  disable2FA,
  whitelistIP,
  removeWhitelistedIP,
  isIPWhitelisted,
  blockIP,
  isIPBlocked,
  trackDevice,
  getUserDevices,
  revokeDevice,
  trackSecurityEvent,
  getSecurityEvents,
  getSecuritySummary,
};
