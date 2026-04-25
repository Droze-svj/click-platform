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
  if (!key) {
    logger.warn('ENCRYPTION_KEY not set, using default (not secure for production)');
    return crypto.scryptSync('default-key-change-in-production', 'salt', KEY_LENGTH);
  }
  return Buffer.from(key, 'hex');
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
  hashSensitiveData,
  verifyHash,
  encryptPII,
  maskSensitiveData,
};





