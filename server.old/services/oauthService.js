/**
 * Unified OAuth Service
 * Manages token storage, encryption, and refresh logic for social platforms
 */

const logger = require('../utils/logger');
const User = require('../models/User');
const crypto = require('crypto');

// Encryption key for tokens (should be in .env)
const ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY || 'development-secret-key-32-chars-!!';
const IV_LENGTH = 16;

/**
 * Encrypt a token before storing in DB
 */
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt a token for API use
 */
function decrypt(text) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32)), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

/**
 * Store or update social credentials for a user
 */
async function saveSocialCredentials(userId, platform, credentials) {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const platformKey = platform.toLowerCase();
    
    // Ensure the oauth structure exists on the user model
    if (!user.oauth) user.oauth = {};
    if (!user.oauth[platformKey]) user.oauth[platformKey] = {};

    // Encrypt sensitive tokens
    const encryptedData = {
      accessToken: credentials.accessToken ? encrypt(credentials.accessToken) : null,
      refreshToken: credentials.refreshToken ? encrypt(credentials.refreshToken) : null,
      connected: true,
      connectedAt: new Date(),
      lastRefreshed: new Date()
    };

    // Merge in extra metadata if provided (expiresAt, platformUserId, etc.)
    if (credentials.extra) {
      Object.assign(encryptedData, credentials.extra);
    }

    // Update the specific platform object
    user.oauth[platformKey] = {
      ...user.oauth[platformKey],
      ...encryptedData
    };

    user.markModified('oauth');
    await user.save();
    
    logger.info(`Successfully saved ${platform} credentials for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Failed to save social credentials', { error: error.message, platform });
    throw error;
  }
}

/**
 * Get decrypted social credentials
 */
async function getSocialCredentials(userId, platform) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.oauth) return null;

    const platformKey = platform.toLowerCase();
    const creds = user.oauth[platformKey];
    
    if (!creds || !creds.connected) return null;

    // Return decrypted tokens along with all metadata
    return {
      ...creds,
      accessToken: creds.accessToken ? decrypt(creds.accessToken) : null,
      refreshToken: creds.refreshToken ? decrypt(creds.refreshToken) : null
    };
  } catch (error) {
    logger.error('Failed to get social credentials', { error: error.message, platform });
    throw error;
  }
}

module.exports = {
  encrypt,
  decrypt,
  saveSocialCredentials,
  getSocialCredentials
};
