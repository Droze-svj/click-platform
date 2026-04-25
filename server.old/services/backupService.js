// Content backup and recovery service - Enhanced

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const Script = require('../models/Script');
const User = require('../models/User');
const { uploadFileToS3, isCloudStorageEnabled } = require('./storageService');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);

/**
 * Create backup for a user (enhanced with encryption and incremental support)
 */
async function createUserBackup(userId, options = {}) {
  try {
    const {
      includeContent = true,
      includePosts = true,
      includeScripts = true,
      includeSettings = true,
      format = 'json',
      encrypt = false,
      password = null,
      incremental = false,
      lastBackupDate = null,
    } = options;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // For incremental backups, only get items modified since last backup
    const modifiedSince = incremental && lastBackupDate ? new Date(lastBackupDate) : null;

    const backup = {
      version: '2.0',
      createdAt: new Date().toISOString(),
      userId: userId.toString(),
      user: {
        email: user.email,
        name: user.name,
        subscription: user.subscription,
      },
      metadata: {
        incremental,
        encrypted: encrypt,
        format,
        includes: {
          content: includeContent,
          posts: includePosts,
          scripts: includeScripts,
          settings: includeSettings,
        },
      },
      data: {},
    };

    // Backup content
    if (includeContent) {
      const contentQuery = { userId };
      if (modifiedSince) {
        contentQuery.updatedAt = { $gte: modifiedSince };
      }
      const content = await Content.find(contentQuery).lean();
      backup.data.content = content.map(c => ({
        ...c,
        _id: c._id.toString(),
        userId: c.userId.toString(),
      }));
      backup.metadata.contentCount = content.length;
    }

    // Backup scheduled posts
    if (includePosts) {
      const postsQuery = { userId };
      if (modifiedSince) {
        postsQuery.updatedAt = { $gte: modifiedSince };
      }
      const posts = await ScheduledPost.find(postsQuery).lean();
      backup.data.posts = posts.map(p => ({
        ...p,
        _id: p._id.toString(),
        userId: p.userId.toString(),
      }));
      backup.metadata.postsCount = posts.length;
    }

    // Backup scripts
    if (includeScripts) {
      const scriptsQuery = { userId };
      if (modifiedSince) {
        scriptsQuery.updatedAt = { $gte: modifiedSince };
      }
      const scripts = await Script.find(scriptsQuery).lean();
      backup.data.scripts = scripts.map(s => ({
        ...s,
        _id: s._id.toString(),
        userId: s.userId.toString(),
      }));
      backup.metadata.scriptsCount = scripts.length;
    }

    // Backup user settings
    if (includeSettings) {
      backup.data.settings = {
        preferences: user.preferences || {},
        socialConnections: user.socialConnections || {},
      };
    }

    // Calculate backup size
    const backupString = JSON.stringify(backup, null, 2);
    backup.metadata.size = Buffer.byteLength(backupString, 'utf8');

    // Encrypt if requested
    let finalBackup = backupString;
    if (encrypt && password) {
      finalBackup = encryptBackup(backupString, password);
      backup.metadata.encrypted = true;
    }

    // Save backup
    const backupDir = path.join(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) {
      await mkdir(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupType = incremental ? 'incremental' : 'full';
    const filename = `backup-${userId}-${backupType}-${timestamp}.${format}`;
    const filepath = path.join(backupDir, filename);

    if (format === 'json') {
      await writeFile(filepath, finalBackup);
    } else if (format === 'csv') {
      const csv = convertToCSV(backup);
      await writeFile(filepath, csv);
    }

    // Generate backup hash for verification
    const hash = crypto.createHash('sha256').update(finalBackup).digest('hex');
    backup.metadata.hash = hash;

    // Upload to cloud storage if enabled
    let backupUrl = null;
    if (isCloudStorageEnabled()) {
      try {
        const fileBuffer = fs.readFileSync(filepath);
        backupUrl = await uploadFileToS3(
          fileBuffer,
          `backups/${filename}`,
          format === 'json' ? 'application/json' : 'text/csv',
          'backups'
        );
        logger.info('Backup uploaded to cloud storage', { userId, backupUrl });
      } catch (error) {
        logger.error('Failed to upload backup to cloud', { error: error.message });
      }
    }

    // Store backup metadata in database
    const backupMetadata = {
      userId,
      filename,
      filepath,
      url: backupUrl,
      size: fs.statSync(filepath).size,
      format,
      hash,
      encrypted: encrypt,
      incremental,
      createdAt: new Date(),
      includes: {
        content: includeContent,
        posts: includePosts,
        scripts: includeScripts,
        settings: includeSettings,
      },
      counts: {
        content: backup.metadata.contentCount || 0,
        posts: backup.metadata.postsCount || 0,
        scripts: backup.metadata.scriptsCount || 0,
      },
    };

    logger.info('User backup created', { userId, filename, size: backupMetadata.size, incremental });

    return {
      success: true,
      backup: backupMetadata,
      data: backup,
    };
  } catch (error) {
    logger.error('Create backup error', { error: error.message, userId });
    captureException(error, { tags: { service: 'backup', operation: 'create' } });
    throw error;
  }
}

/**
 * Encrypt backup
 */
function encryptBackup(data, password) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(password, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return JSON.stringify({
    encrypted,
    iv: iv.toString('hex'),
    algorithm,
  });
}

/**
 * Decrypt backup
 */
function decryptBackup(encryptedData, password) {
  try {
    const data = JSON.parse(encryptedData);
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = Buffer.from(data.iv, 'hex');
    const decipher = crypto.createDecipheriv(data.algorithm, key, iv);
    
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt backup: Invalid password or corrupted data');
  }
}

/**
 * Verify backup integrity
 */
async function verifyBackup(filepath, expectedHash) {
  try {
    const fileContent = await readFile(filepath);
    const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
    return hash === expectedHash;
  } catch (error) {
    logger.error('Verify backup error', { error: error.message, filepath });
    return false;
  }
}

/**
 * Convert backup to CSV format
 */
function convertToCSV(backup) {
  const lines = [];
  lines.push('Type,ID,Title,Status,CreatedAt');
  
  if (backup.data.content) {
    backup.data.content.forEach(item => {
      lines.push(`Content,${item._id},"${item.title || ''}",${item.status || ''},${item.createdAt || ''}`);
    });
  }
  
  if (backup.data.posts) {
    backup.data.posts.forEach(item => {
      lines.push(`Post,${item._id},"${item.content?.text || ''}",${item.status || ''},${item.createdAt || ''}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Restore from backup (enhanced with preview)
 */
async function restoreFromBackup(userId, backupData, options = {}) {
  try {
    const {
      restoreContent = true,
      restorePosts = true,
      restoreScripts = true,
      restoreSettings = true,
      overwrite = false,
      preview = false, // Preview mode - don't actually restore
    } = options;

    const results = {
      preview,
      restored: {
        content: 0,
        posts: 0,
        scripts: 0,
        settings: false,
      },
      skipped: {
        content: 0,
        posts: 0,
        scripts: 0,
      },
      errors: [],
    };

    // Restore content
    if (restoreContent && backupData.data.content) {
      for (const item of backupData.data.content) {
        try {
          if (preview) {
            const exists = await Content.findById(item._id);
            results.restored.content++;
            if (exists) {
              results.skipped.content++;
            }
          } else {
            if (overwrite) {
              await Content.findOneAndUpdate(
                { _id: item._id, userId },
                { ...item, userId },
                { upsert: true }
              );
            } else {
              const exists = await Content.findById(item._id);
              if (!exists) {
                await Content.create({ ...item, userId });
              } else {
                results.skipped.content++;
              }
            }
            results.restored.content++;
          }
        } catch (error) {
          results.errors.push({ type: 'content', id: item._id, error: error.message });
        }
      }
    }

    // Restore posts
    if (restorePosts && backupData.data.posts) {
      for (const item of backupData.data.posts) {
        try {
          if (preview) {
            const exists = await ScheduledPost.findById(item._id);
            results.restored.posts++;
            if (exists) {
              results.skipped.posts++;
            }
          } else {
            if (overwrite) {
              await ScheduledPost.findOneAndUpdate(
                { _id: item._id, userId },
                { ...item, userId },
                { upsert: true }
              );
            } else {
              const exists = await ScheduledPost.findById(item._id);
              if (!exists) {
                await ScheduledPost.create({ ...item, userId });
              } else {
                results.skipped.posts++;
              }
            }
            results.restored.posts++;
          }
        } catch (error) {
          results.errors.push({ type: 'post', id: item._id, error: error.message });
        }
      }
    }

    // Restore scripts
    if (restoreScripts && backupData.data.scripts) {
      for (const item of backupData.data.scripts) {
        try {
          if (preview) {
            const exists = await Script.findById(item._id);
            results.restored.scripts++;
            if (exists) {
              results.skipped.scripts++;
            }
          } else {
            if (overwrite) {
              await Script.findOneAndUpdate(
                { _id: item._id, userId },
                { ...item, userId },
                { upsert: true }
              );
            } else {
              const exists = await Script.findById(item._id);
              if (!exists) {
                await Script.create({ ...item, userId });
              } else {
                results.skipped.scripts++;
              }
            }
            results.restored.scripts++;
          }
        } catch (error) {
          results.errors.push({ type: 'script', id: item._id, error: error.message });
        }
      }
    }

    // Restore settings
    if (restoreSettings && backupData.data.settings) {
      try {
        if (!preview) {
          await User.findByIdAndUpdate(userId, {
            $set: {
              preferences: backupData.data.settings.preferences,
              socialConnections: backupData.data.settings.socialConnections,
            },
          });
        }
        results.restored.settings = true;
      } catch (error) {
        results.errors.push({ type: 'settings', error: error.message });
      }
    }

    logger.info('Backup restored', { userId, results, preview });
    return results;
  } catch (error) {
    logger.error('Restore backup error', { error: error.message, userId });
    captureException(error, { tags: { service: 'backup', operation: 'restore' } });
    throw error;
  }
}

/**
 * Get user backup list
 */
async function getUserBackups(userId) {
  try {
    const backupDir = path.join(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) {
      return [];
    }

    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith(`backup-${userId}-`))
      .map(file => {
        const filepath = path.join(backupDir, file);
        const stats = fs.statSync(filepath);
        const isIncremental = file.includes('incremental');
        return {
          filename: file,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          filepath,
          type: isIncremental ? 'incremental' : 'full',
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    return files;
  } catch (error) {
    logger.error('Get backups error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Delete backup
 */
async function deleteBackup(userId, filename) {
  try {
    const backupDir = path.join(__dirname, '../../backups');
    const filepath = path.join(backupDir, filename);

    if (!filepath.startsWith(backupDir) || !filename.startsWith(`backup-${userId}-`)) {
      throw new Error('Invalid backup file');
    }

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      logger.info('Backup deleted', { userId, filename });
      return true;
    }

    throw new Error('Backup file not found');
  } catch (error) {
    logger.error('Delete backup error', { error: error.message, userId, filename });
    throw error;
  }
}

/**
 * Export user data (GDPR compliance)
 */
async function exportUserData(userId) {
  try {
    return await createUserBackup(userId, {
      includeContent: true,
      includePosts: true,
      includeScripts: true,
      includeSettings: true,
      format: 'json',
      encrypt: false,
    });
  } catch (error) {
    logger.error('Export user data error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get backup statistics
 */
async function getBackupStats(userId) {
  try {
    const backups = await getUserBackups(userId);
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    const fullBackups = backups.filter(b => b.type === 'full').length;
    const incrementalBackups = backups.filter(b => b.type === 'incremental').length;
    const oldestBackup = backups.length > 0 ? backups[backups.length - 1].createdAt : null;
    const newestBackup = backups.length > 0 ? backups[0].createdAt : null;

    return {
      totalBackups: backups.length,
      fullBackups,
      incrementalBackups,
      totalSize,
      oldestBackup,
      newestBackup,
    };
  } catch (error) {
    logger.error('Get backup stats error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  createUserBackup,
  restoreFromBackup,
  getUserBackups,
  deleteBackup,
  exportUserData,
  verifyBackup,
  decryptBackup,
  getBackupStats,
};
