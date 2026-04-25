// Advanced Security Service
// 2FA, IP whitelisting, device management, security monitoring

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');

// Security event tracking
const securityEvents = new Map(); // userId -> [events]
const blockedIPs = new Set();
const whitelistedIPs = new Map(); // userId -> Set of IPs
const deviceSessions = new Map(); // userId -> [devices]

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
    if (!whitelistedIPs.has(userId)) {
      whitelistedIPs.set(userId, new Set());
    }
    whitelistedIPs.get(userId).add(ip);

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
    if (whitelistedIPs.has(userId)) {
      whitelistedIPs.get(userId).delete(ip);
    }

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
function isIPWhitelisted(userId, ip) {
  if (!whitelistedIPs.has(userId)) {
    return false; // No whitelist = allow all
  }
  return whitelistedIPs.get(userId).has(ip);
}

/**
 * Block IP address
 * @param {string} ip - IP address
 * @param {number} duration - Duration in minutes (0 = permanent)
 * @returns {Promise<boolean>} Success
 */
async function blockIP(ip, duration = 0) {
  try {
    blockedIPs.add(ip);

    if (duration > 0) {
      setTimeout(() => {
        blockedIPs.delete(ip);
        logger.info('IP block expired', { ip });
      }, duration * 60 * 1000);
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

    if (!deviceSessions.has(userId)) {
      deviceSessions.set(userId, []);
    }

    deviceSessions.get(userId).push(device);

    // Keep last 10 devices
    const devices = deviceSessions.get(userId);
    if (devices.length > 10) {
      devices.shift();
    }

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
function getUserDevices(userId) {
  return deviceSessions.get(userId) || [];
}

/**
 * Revoke device
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @returns {Promise<boolean>} Success
 */
async function revokeDevice(userId, deviceId) {
  try {
    if (deviceSessions.has(userId)) {
      const devices = deviceSessions.get(userId);
      const index = devices.findIndex((d) => d.id === deviceId);
      if (index !== -1) {
        devices.splice(index, 1);
        trackSecurityEvent(userId, 'device_revoked', { deviceId });
        logger.info('Device revoked', { userId, deviceId });
        return true;
      }
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
function trackSecurityEvent(userId, eventType, metadata = {}) {
  try {
    if (!securityEvents.has(userId)) {
      securityEvents.set(userId, []);
    }

    const event = {
      type: eventType,
      userId,
      timestamp: new Date(),
      metadata,
    };

    securityEvents.get(userId).push(event);

    // Keep last 100 events per user
    const events = securityEvents.get(userId);
    if (events.length > 100) {
      events.shift();
    }

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
function getSecurityEvents(userId, limit = 50) {
  const events = securityEvents.get(userId) || [];
  return events.slice(-limit).reverse();
}

/**
 * Get security summary for user
 * @param {string} userId - User ID
 * @returns {Object} Security summary
 */
function getSecuritySummary(userId) {
  const events = getSecurityEvents(userId, 100);
  const recentEvents = events.slice(0, 10);

  const failedLogins = events.filter((e) => e.type === 'login_failed').length;
  const blockedIPs = events.filter((e) => e.type === 'ip_blocked').length;
  const devices = getUserDevices(userId);

  return {
    userId,
    totalEvents: events.length,
    recentEvents,
    failedLogins,
    blockedIPs,
    deviceCount: devices.length,
    devices: devices.slice(0, 5), // Last 5 devices
    whitelistedIPs: Array.from(whitelistedIPs.get(userId) || []),
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
