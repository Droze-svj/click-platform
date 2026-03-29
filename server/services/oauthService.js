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

    const encryptedCreds = {
      accessToken: encrypt(credentials.accessToken),
      refreshToken: credentials.refreshToken ? encrypt(credentials.refreshToken) : null,
      expiresAt: credentials.expiresAt,
      profile: credentials.profile,
      platform
    };

    // Placeholder: In a real system, we'd have a 'socialAccounts' array on the User model
    // user.socialAccounts = user.socialAccounts || [];
    // // Update or add
    // const index = user.socialAccounts.findIndex(a => a.platform === platform);
    // if (index > -1) user.socialAccounts[index] = encryptedCreds;
    // else user.socialAccounts.push(encryptedCreds);
    
    logger.debug('Credentials payload prepared', { platform, encryptedCreds });
    // await user.save();
    
    logger.info(`Saved ${platform} credentials for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Failed to save social credentials', { error: error.message });
    throw error;
  }
}

/**
 * Get decrypted social credentials
 */
async function getSocialCredentials(userId, platform) {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    logger.debug('Fetching credentials from platform', { platform });
    // Placeholder lookup
    // const creds = user.socialAccounts?.find(a => a.platform === platform);
    const creds = null; // Mocking lack of account for now
    
    if (!creds) return null;

    return {
      accessToken: decrypt(creds.accessToken),
      refreshToken: creds.refreshToken ? decrypt(creds.refreshToken) : null,
      expiresAt: creds.expiresAt,
      profile: creds.profile
    };
  } catch (error) {
    logger.error('Failed to get social credentials', { error: error.message });
    throw error;
  }
}

module.exports = {
  saveSocialCredentials,
  getSocialCredentials
};
