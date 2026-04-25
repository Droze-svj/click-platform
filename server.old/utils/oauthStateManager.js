// OAuth state management for secure state verification

const crypto = require('crypto');
const logger = require('./logger');

// In-memory store for OAuth states (in production, use Redis)
const stateStore = new Map();

/**
 * Generate and store OAuth state
 */
function generateState(userId, platform) {
  const state = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  stateStore.set(state, {
    userId: userId.toString(),
    platform: platform.toLowerCase(),
    expiresAt,
    createdAt: Date.now(),
  });

  // Clean up expired states periodically
  if (stateStore.size > 1000) {
    cleanupExpiredStates();
  }

  return state;
}

/**
 * Verify and consume OAuth state
 */
function verifyState(state, userId, platform) {
  const stateData = stateStore.get(state);

  if (!stateData) {
    logger.warn('OAuth state not found', { state });
    return false;
  }

  // Check expiration
  if (Date.now() > stateData.expiresAt) {
    logger.warn('OAuth state expired', { state, expiresAt: stateData.expiresAt });
    stateStore.delete(state);
    return false;
  }

  // Verify user and platform match
  if (stateData.userId !== userId.toString() || stateData.platform !== platform.toLowerCase()) {
    logger.warn('OAuth state mismatch', {
      state,
      expectedUserId: stateData.userId,
      actualUserId: userId,
      expectedPlatform: stateData.platform,
      actualPlatform: platform,
    });
    stateStore.delete(state);
    return false;
  }

  // Consume state (one-time use)
  stateStore.delete(state);
  return true;
}

/**
 * Clean up expired states
 */
function cleanupExpiredStates() {
  const now = Date.now();
  let cleaned = 0;

  for (const [state, data] of stateStore.entries()) {
    if (now > data.expiresAt) {
      stateStore.delete(state);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info('Cleaned up expired OAuth states', { count: cleaned });
  }
}

/**
 * Get state info (for debugging)
 */
function getStateInfo(state) {
  return stateStore.get(state);
}

module.exports = {
  generateState,
  verifyState,
  cleanupExpiredStates,
  getStateInfo,
};






