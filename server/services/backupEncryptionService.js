// Backup Encryption Service

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * Encrypt backup file
 */
async function encryptBackup(backupPath, encryptionKey) {
  try {
    const algorithm = 'aes-256-gcm';
    const key = encryptionKey || process.env.BACKUP_ENCRYPTION_KEY || generateKey();

    if (!key) {
      throw new Error('Encryption key required');
    }

    const keyBuffer = crypto.scryptSync(key, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);

    const input = await fs.readFile(backupPath);
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Save encrypted file
    const encryptedPath = `${backupPath}.encrypted`;
    await fs.writeFile(encryptedPath, JSON.stringify({
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      algorithm,
    }));

    logger.info('Backup encrypted', { backupPath, encryptedPath });
    return { encryptedPath, algorithm };
  } catch (error) {
    logger.error('Encrypt backup error', { error: error.message, backupPath });
    throw error;
  }
}

/**
 * Decrypt backup file
 */
async function decryptBackup(encryptedPath, encryptionKey) {
  try {
    const key = encryptionKey || process.env.BACKUP_ENCRYPTION_KEY;

    if (!key) {
      throw new Error('Encryption key required');
    }

    const keyBuffer = crypto.scryptSync(key, 'salt', 32);
    const encryptedData = JSON.parse(await fs.readFile(encryptedPath, 'utf8'));

    const decipher = crypto.createDecipheriv(
      encryptedData.algorithm,
      keyBuffer,
      Buffer.from(encryptedData.iv, 'base64')
    );

    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedData.encrypted, 'base64')),
      decipher.final(),
    ]);

    const decryptedPath = encryptedPath.replace('.encrypted', '.decrypted');
    await fs.writeFile(decryptedPath, decrypted);

    logger.info('Backup decrypted', { encryptedPath, decryptedPath });
    return { decryptedPath };
  } catch (error) {
    logger.error('Decrypt backup error', { error: error.message, encryptedPath });
    throw error;
  }
}

/**
 * Compress backup
 */
async function compressBackup(backupPath) {
  try {
    const zlib = require('zlib');
    const { pipeline } = require('stream/promises');

    const input = await fs.readFile(backupPath);
    const compressed = zlib.gzipSync(input);

    const compressedPath = `${backupPath}.gz`;
    await fs.writeFile(compressedPath, compressed);

    const originalSize = (await fs.stat(backupPath)).size;
    const compressedSize = (await fs.stat(compressedPath)).size;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(2);

    logger.info('Backup compressed', {
      backupPath,
      compressedPath,
      originalSize,
      compressedSize,
      compressionRatio: `${compressionRatio}%`,
    });

    return {
      compressedPath,
      originalSize,
      compressedSize,
      compressionRatio: parseFloat(compressionRatio),
    };
  } catch (error) {
    logger.error('Compress backup error', { error: error.message, backupPath });
    throw error;
  }
}

/**
 * Verify backup integrity
 */
async function verifyBackup(backupPath) {
  try {
    const file = await fs.readFile(backupPath);
    const hash = crypto.createHash('sha256').update(file).digest('hex');

    // Store hash for verification
    const hashPath = `${backupPath}.sha256`;
    await fs.writeFile(hashPath, hash);

    logger.info('Backup verified', { backupPath, hash: hash.substring(0, 16) + '...' });
    return { hash, verified: true };
  } catch (error) {
    logger.error('Verify backup error', { error: error.message, backupPath });
    throw error;
  }
}

/**
 * Verify backup hash
 */
async function verifyBackupHash(backupPath) {
  try {
    const hashPath = `${backupPath}.sha256`;
    
    try {
      await fs.access(hashPath);
    } catch (error) {
      return { verified: false, error: 'Hash file not found' };
    }

    const expectedHash = await fs.readFile(hashPath, 'utf8');
    const file = await fs.readFile(backupPath);
    const actualHash = crypto.createHash('sha256').update(file).digest('hex');

    const verified = expectedHash.trim() === actualHash;

    logger.info('Backup hash verified', {
      backupPath,
      verified,
    });

    return { verified, expectedHash, actualHash };
  } catch (error) {
    logger.error('Verify backup hash error', { error: error.message, backupPath });
    return { verified: false, error: error.message };
  }
}

/**
 * Generate encryption key
 */
function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  encryptBackup,
  decryptBackup,
  compressBackup,
  verifyBackup,
  verifyBackupHash,
  generateKey,
};






