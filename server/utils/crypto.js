const crypto = require('crypto');

const SECRET = process.env.AUDIT_LOG_SECRET || 'neural-glass-governance-2026-sovereign-vault';

/**
 * Generate HMAC signature for a log entry
 */
function generateSignature(data) {
  const serialized = JSON.stringify(data);
  return crypto.createHmac('sha256', SECRET).update(serialized).digest('hex');
}

/**
 * Verify HMAC signature for a log entry
 */
function verifySignature(data, signature) {
  const generated = generateSignature(data);
  return generated === signature;
}

module.exports = {
  generateSignature,
  verifySignature
};
