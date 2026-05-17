/**
 * Unified OAuth Service
 * Manages token storage, encryption, and refresh logic for social platforms
 */

const logger = require('../utils/logger');
const mongoose = require('mongoose');
const User = require('../models/User');
const crypto = require('crypto');
const OAuthStorage = require('../utils/oauthStorage');

// Supabase users have UUIDs that Mongoose can't cast to ObjectId. Route UUID
// users through OAuthStorage (Supabase social_links.oauth.<platform>); keep
// the encrypted Mongo path for legacy ObjectId users.
const isMongoUserId = (id) => mongoose.Types.ObjectId.isValid(String(id));

// Encryption key for tokens. In production, refuse to boot without one set —
// silently falling back to a hardcoded dev key in prod would make any deployed
// tokens un-decryptable after the env churns, looking like phantom "User not
// connected" failures. Dev still falls back so localhost works out of the box.
if (process.env.NODE_ENV === 'production' && !process.env.OAUTH_ENCRYPTION_KEY) {
  throw new Error(
    'OAUTH_ENCRYPTION_KEY is required in production. ' +
    'Set a stable 32+ char secret in the environment before starting the server.'
  );
}
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
 * Store or update social credentials for a user.
 *
 * Multi-account-aware: `credentials.extra.platformUserId` (or
 * `credentials.platformUserId`) is what identifies the account being
 * upserted. When present, the row is appended to `accounts[]` or
 * updated in place if a matching account already exists. Without an id
 * (legacy callers that only pass tokens), the primary account's tokens
 * are refreshed.
 */
async function saveSocialCredentials(userId, platform, credentials) {
  try {
    const platformKey = platform.toLowerCase();

    if (!isMongoUserId(userId)) {
      // Supabase user — persist via OAuthStorage. The new storage layer
      // appends to accounts[] when platformUserId is provided.
      const data = {
        accessToken: credentials.accessToken || null,
        refreshToken: credentials.refreshToken || null,
        lastRefreshed: new Date().toISOString(),
      };
      if (credentials.extra) Object.assign(data, credentials.extra);
      // Hoist `platformUserId` to the top of `data` if it lives in `extra`
      // — OAuthStorage looks at top-level fields for the upsert key.
      if (data.extra?.platformUserId && !data.platformUserId) {
        data.platformUserId = data.extra.platformUserId;
      }
      await OAuthStorage.saveTokens(userId, platformKey, data);
      logger.info(`Saved ${platform} credentials (Supabase)`, { userId, platformUserId: data.platformUserId || null });
      return true;
    }

    // Legacy Mongoose path. We encrypt tokens at-rest in this branch so
    // legacy ObjectId users keep their existing encryption-at-rest. The
    // accounts[] shape mirrors the Supabase one for consistency.
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    if (!user.oauth) user.oauth = {};
    if (!user.oauth[platformKey]) user.oauth[platformKey] = {};
    const platformRow = user.oauth[platformKey];

    const accountId = credentials.extra?.platformUserId
      || credentials.platformUserId
      || platformRow.platformUserId
      || 'primary';

    const accountUpdate = {
      accountId,
      platformUserId: accountId,
      accessToken: credentials.accessToken ? encrypt(credentials.accessToken) : null,
      refreshToken: credentials.refreshToken ? encrypt(credentials.refreshToken) : null,
      platformUsername: credentials.extra?.platformUsername || null,
      avatar: credentials.extra?.avatar || null,
      expiresAt: credentials.extra?.expiresAt || null,
      metadata: credentials.extra?.metadata || null,
      addedAt: new Date(),
      isPrimary: false,
    };

    const existingAccounts = Array.isArray(platformRow.accounts) ? platformRow.accounts.slice() : [];
    const idx = existingAccounts.findIndex((a) => a.accountId === accountId || a.platformUserId === accountId);
    if (idx >= 0) {
      existingAccounts[idx] = { ...existingAccounts[idx], ...accountUpdate };
    } else {
      accountUpdate.isPrimary = existingAccounts.length === 0;
      existingAccounts.push(accountUpdate);
    }
    const primary = existingAccounts.find((a) => a.isPrimary) || existingAccounts[0];

    user.oauth[platformKey] = {
      ...platformRow,
      ...accountUpdate,
      accounts: existingAccounts,
      activeAccountId: platformRow.activeAccountId || primary?.accountId,
      connected: true,
      connectedAt: platformRow.connectedAt || new Date(),
      lastRefreshed: new Date(),
    };

    user.markModified('oauth');
    await user.save();

    logger.info(`Saved ${platform} credentials for Mongo user`, { userId, accounts: existingAccounts.length });
    return true;
  } catch (error) {
    logger.error('Failed to save social credentials', { error: error.message, platform });
    throw error;
  }
}

/**
 * Get the active (or specified) account's credentials, decrypted for use.
 * Pass `accountId` to retrieve a non-active account.
 */
async function getSocialCredentials(userId, platform, accountId = null) {
  try {
    const platformKey = platform.toLowerCase();

    if (!isMongoUserId(userId)) {
      // Supabase path — pull the chosen account from accounts[] (or the
      // active one if no id given). Falls back to the legacy single-row
      // shape transparently via OAuthStorage._normalisePlatformRow.
      const row = await OAuthStorage.loadTokens(userId, platformKey);
      if (!row || !row.connected) return null;
      const account = await OAuthStorage.getAccount(userId, platformKey, accountId);
      if (account) {
        return {
          ...row,
          ...account, // accessToken/refreshToken come from the picked account
        };
      }
      return row;
    }

    const user = await User.findById(userId);
    if (!user || !user.oauth) return null;
    const row = user.oauth[platformKey];
    if (!row || !row.connected) return null;

    // Multi-account: pick the right entry, decrypt, return.
    const accounts = Array.isArray(row.accounts) && row.accounts.length > 0
      ? row.accounts
      : [{ accountId: row.platformUserId || 'primary', platformUserId: row.platformUserId, accessToken: row.accessToken, refreshToken: row.refreshToken, isPrimary: true }];

    let account;
    if (accountId) {
      account = accounts.find((a) => a.accountId === accountId || a.platformUserId === accountId);
    } else if (row.activeAccountId) {
      account = accounts.find((a) => a.accountId === row.activeAccountId);
    }
    if (!account) account = accounts.find((a) => a.isPrimary) || accounts[0];
    if (!account) return null;

    return {
      ...row,
      accessToken: account.accessToken ? decrypt(account.accessToken) : null,
      refreshToken: account.refreshToken ? decrypt(account.refreshToken) : null,
      platformUserId: account.platformUserId,
      platformUsername: account.platformUsername || row.platformUsername || null,
      accountId: account.accountId,
    };
  } catch (error) {
    logger.error('Failed to get social credentials', { error: error.message, platform });
    throw error;
  }
}

/**
 * List every connected account for a user+platform. Returns an array of
 * { accountId, platformUserId, platformUsername, avatar, isPrimary,
 *   isActive, addedAt }. Tokens are NOT included — call
 * getSocialCredentials(userId, platform, accountId) to read them.
 */
async function listSocialAccounts(userId, platform) {
  const platformKey = platform.toLowerCase();
  if (!isMongoUserId(userId)) {
    const row = await OAuthStorage.loadTokens(userId, platformKey);
    if (!row || !Array.isArray(row.accounts)) return [];
    return row.accounts.map((a) => ({
      accountId: a.accountId,
      platformUserId: a.platformUserId,
      platformUsername: a.platformUsername || null,
      avatar: a.avatar || null,
      isPrimary: !!a.isPrimary,
      isActive: row.activeAccountId === a.accountId,
      addedAt: a.addedAt || null,
    }));
  }
  const user = await User.findById(userId);
  if (!user?.oauth?.[platformKey]?.accounts) {
    // Fall back to the legacy single-row shape.
    const legacy = user?.oauth?.[platformKey];
    if (legacy?.connected && legacy.platformUserId) {
      return [{
        accountId: legacy.platformUserId,
        platformUserId: legacy.platformUserId,
        platformUsername: legacy.platformUsername || null,
        avatar: legacy.avatar || null,
        isPrimary: true,
        isActive: true,
        addedAt: legacy.connectedAt || null,
      }];
    }
    return [];
  }
  const row = user.oauth[platformKey];
  return row.accounts.map((a) => ({
    accountId: a.accountId,
    platformUserId: a.platformUserId,
    platformUsername: a.platformUsername || null,
    avatar: a.avatar || null,
    isPrimary: !!a.isPrimary,
    isActive: row.activeAccountId === a.accountId,
    addedAt: a.addedAt || null,
  }));
}

/** Remove one account by id. If no id is given, disconnects all. */
async function removeSocialAccount(userId, platform, accountId = null) {
  const platformKey = platform.toLowerCase();
  if (!isMongoUserId(userId)) {
    return OAuthStorage.removeAccount(userId, platformKey, accountId);
  }
  const user = await User.findById(userId);
  if (!user?.oauth?.[platformKey]) return 0;
  if (!accountId) {
    user.oauth[platformKey] = { connected: false, accounts: [] };
    user.markModified('oauth');
    await user.save();
    return 0;
  }
  const row = user.oauth[platformKey];
  const remaining = (row.accounts || []).filter((a) => a.accountId !== accountId && a.platformUserId !== accountId);
  if (remaining.length === 0) {
    user.oauth[platformKey] = { connected: false, accounts: [] };
  } else {
    if (!remaining.some((a) => a.isPrimary)) remaining[0].isPrimary = true;
    const primary = remaining.find((a) => a.isPrimary) || remaining[0];
    user.oauth[platformKey] = {
      ...row,
      accounts: remaining,
      activeAccountId: primary.accountId,
      accessToken: primary.accessToken,
      refreshToken: primary.refreshToken,
      platformUserId: primary.platformUserId,
      platformUsername: primary.platformUsername || null,
    };
  }
  user.markModified('oauth');
  await user.save();
  return remaining.length;
}

/** Switch the active account for one-account UI surfaces. */
async function setActiveSocialAccount(userId, platform, accountId) {
  const platformKey = platform.toLowerCase();
  if (!isMongoUserId(userId)) {
    return OAuthStorage.setActiveAccount(userId, platformKey, accountId);
  }
  const user = await User.findById(userId);
  if (!user?.oauth?.[platformKey]?.accounts) return false;
  const row = user.oauth[platformKey];
  const target = row.accounts.find((a) => a.accountId === accountId);
  if (!target) return false;
  user.oauth[platformKey] = {
    ...row,
    activeAccountId: accountId,
    accessToken: target.accessToken,
    refreshToken: target.refreshToken,
    platformUserId: target.platformUserId,
    platformUsername: target.platformUsername || null,
  };
  user.markModified('oauth');
  await user.save();
  return true;
}

module.exports = {
  encrypt,
  decrypt,
  saveSocialCredentials,
  getSocialCredentials,
  listSocialAccounts,
  removeSocialAccount,
  setActiveSocialAccount,
};
