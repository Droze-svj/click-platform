// Data Encryption Utility

const crypto = require('crypto');
const logger = require('./logger');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment or generate
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  const isProd = process.env.NODE_ENV === 'production';
  if (!key) {
    // Fail CLOSED in production: a world-known default key would make every
    // token-at-rest trivially decryptable. Dev still derives a usable key.
    if (isProd) {
      throw new Error('ENCRYPTION_KEY is required in production (64 hex chars / 32 bytes) for token-at-rest encryption.');
    }
    logger.warn('ENCRYPTION_KEY not set, using an insecure dev default (NOT for production)');
    return crypto.scryptSync('default-key-change-in-production', 'salt', KEY_LENGTH);
  }
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== KEY_LENGTH) {
    // A malformed key silently yields the wrong length → createCipheriv throws →
    // encryptToken's catch would store the token in PLAINTEXT. Reject loudly in
    // prod; derive a stable dev key from the provided value otherwise.
    if (isProd) {
      throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex chars (${KEY_LENGTH} bytes); got ${buf.length} bytes.`);
    }
    logger.warn(`ENCRYPTION_KEY is ${buf.length} bytes (expected ${KEY_LENGTH}); deriving a dev key from it.`);
    return crypto.scryptSync(key, 'salt', KEY_LENGTH);
  }
  return buf;
}

/**
 * Encrypt data
 */
function encrypt(data) {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  } catch (error) {
    logger.error('Encryption error', { error: error.message });
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt data
 */
function decrypt(encryptedData) {
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    logger.error('Decryption error', { error: error.message });
    throw new Error('Decryption failed');
  }
}

// ── Field-level token encryption (transparent, backward-compatible) ─────────
// Storage format for an encrypted token string:  enc:v1:<base64(JSON)>
// where JSON is the object returned by encrypt() ({ encrypted, iv, tag }).
// Legacy plaintext tokens have NO prefix and are passed through unchanged on
// read. This lets a DB full of plaintext tokens keep authenticating while all
// new/refreshed tokens are stored encrypted going forward.
const ENC_PREFIX = 'enc:v1:';

/**
 * Encrypt a single token string into the storable `enc:v1:<payload>` form.
 * - Non-string / empty / null / undefined values are returned unchanged so
 *   optional fields (e.g. refreshToken) and "no token" stay as-is.
 * - If it's already in the encrypted form, it's returned unchanged (idempotent).
 * - On any encryption failure, returns the original value (never throws) so a
 *   write path can never be broken by encryption.
 */
function encryptToken(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }
  if (value.startsWith(ENC_PREFIX)) {
    return value; // already encrypted
  }
  try {
    const payload = encrypt(value);
    return ENC_PREFIX + Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  } catch (error) {
    // In production, refuse to silently store a token in plaintext — fail the
    // write instead (with a valid ENCRYPTION_KEY this path never fires). In dev
    // we keep working so localhost isn't blocked by a missing key.
    if (process.env.NODE_ENV === 'production') {
      logger.error('Token encryption failed; refusing to store plaintext', { error: error.message });
      throw new Error('Token encryption failed');
    }
    logger.error('Token encryption failed; storing value unchanged (dev only)', { error: error.message });
    return value;
  }
}

/**
 * Decrypt a stored token value back to plaintext.
 * - If it's NOT in the encrypted form (legacy plaintext), it's returned
 *   unchanged (backward-compat).
 * - If decryption fails for any reason (bad key, corrupt blob, garbage),
 *   the raw stored value is returned unchanged — never throws, never returns a
 *   broken blob. Token-read paths therefore always yield a usable value.
 */
function decryptToken(value) {
  if (typeof value !== 'string' || !value.startsWith(ENC_PREFIX)) {
    return value;
  }
  try {
    const json = Buffer.from(value.slice(ENC_PREFIX.length), 'base64').toString('utf8');
    const payload = JSON.parse(json);
    if (!payload || !payload.iv || !payload.tag || payload.encrypted == null) {
      return value;
    }
    return decrypt(payload);
  } catch (error) {
    logger.error('Token decryption failed; returning stored value unchanged', { error: error.message });
    return value;
  }
}

/**
 * True if a stored value is in the encrypted token form.
 */
function isEncryptedToken(value) {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

/**
 * Hash sensitive data (one-way)
 */
function hashSensitiveData(data, salt = null) {
  const generatedSalt = salt || crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = crypto.pbkdf2Sync(
    data,
    generatedSalt,
    ITERATIONS,
    KEY_LENGTH,
    'sha512'
  ).toString('hex');

  return {
    hash,
    salt: generatedSalt,
  };
}

/**
 * Verify hashed data
 */
function verifyHash(data, hash, salt) {
  const newHash = crypto.pbkdf2Sync(
    data,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    'sha512'
  ).toString('hex');

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(newHash));
}

/**
 * Encrypt PII (Personally Identifiable Information)
 */
function encryptPII(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const piiFields = ['email', 'phone', 'ssn', 'creditCard', 'address', 'ip'];
  const encrypted = { ...data };

  for (const field of piiFields) {
    if (encrypted[field]) {
      encrypted[field] = encrypt(encrypted[field]);
    }
  }

  return encrypted;
}

/**
 * Mask sensitive data for logging
 */
function maskSensitiveData(data, fields = ['password', 'token', 'apiKey', 'secret']) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const masked = { ...data };

  for (const field of fields) {
    if (masked[field]) {
      const value = String(masked[field]);
      if (value.length > 4) {
        masked[field] = value.substring(0, 2) + '***' + value.substring(value.length - 2);
      } else {
        masked[field] = '***';
      }
    }
  }

  return masked;
}

module.exports = {
  encrypt,
  decrypt,
  encryptToken,
  decryptToken,
  isEncryptedToken,
  hashSensitiveData,
  verifyHash,
  encryptPII,
  maskSensitiveData,
};





