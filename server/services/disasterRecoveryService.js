// Disaster Recovery & Backup Service
//
// The six helpers that used to live here — backupDatabase/backupFiles/
// backupConfiguration and their restore counterparts — are gone with the paths
// that called them. Every one of them logged a step and returned
// { status: 'completed' } / { success: true } without moving any data:
// mongodump, mongorestore and the directory copies were all comments. Whoever
// implements this for real should build it around the chosen dump/replication
// tooling rather than resurrect those stubs.

const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Create a platform-wide disaster-recovery backup.
 *
 * NOT IMPLEMENTED — and it now says so instead of writing an empty directory
 * and calling it a completed backup.
 *
 * What this used to do: create backups/<id>/, then call three helpers that took
 * no data whatsoever. backupDatabase() wrote an info.json literally saying
 * `{ method: 'mongodump', status: 'completed' }` without ever running mongodump.
 * backupFiles() mkdir'd a destination for each uploads directory with the
 * `await copyDirectory(...)` commented out, and returned status 'completed'.
 * The manifest was then stamped `status: 'completed'` and a size computed over
 * the empty tree.
 *
 * So an admin could take a backup, be told it succeeded, see it listed, and
 * discover it was empty only while trying to recover from an outage — the one
 * moment when finding out is most expensive. An honest failure is strictly
 * better than a backup that lies, so this refuses until mongodump/file
 * replication is actually wired up.
 *
 * What DOES work today: POST /api/backup/create — a real per-user export of
 * content, posts, scripts and settings (services/backupService), with optional
 * encryption and verification.
 */
async function createDRBackup() {
  const err = new Error(
    'Platform disaster-recovery backups are not implemented — no database dump or ' +
    'file replication is performed, so a "backup" would be empty. Use ' +
    'POST /api/backup/create for a real per-user data export.'
  );
  err.statusCode = 501;
  throw err;
}

/**
 * Restore from a disaster-recovery backup.
 *
 * NOT IMPLEMENTED. restoreDatabase(), restoreFiles() and restoreConfiguration()
 * each logged "restore initiated" and returned { success: true } without
 * touching a single byte — mongorestore and the file copy were comments. A
 * restore that reports success while changing nothing is the most dangerous
 * shape this can take, because it is trusted precisely when something has
 * already gone wrong.
 */
async function restoreFromBackup() {
  const err = new Error(
    'Platform disaster-recovery restore is not implemented — nothing would be restored.'
  );
  err.statusCode = 501;
  throw err;
}

/**
 * List backups
 */
async function listBackups() {
  try {
    const backupsDir = path.join(process.cwd(), 'backups');

    try {
      const entries = await fs.readdir(backupsDir, { withFileTypes: true });
      const backups = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const manifestPath = path.join(backupsDir, entry.name, 'manifest.json');
          try {
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
            backups.push({
              id: manifest.id,
              type: manifest.type,
              createdAt: manifest.createdAt,
              status: manifest.status,
              // MEASURED, not read from the manifest. Any manifest already on
              // disk was written by the old create path, which stamped
              // status:'completed' over a backup containing no data — so its
              // recorded size cannot be trusted either. Walking the directory
              // reports what is actually there, which for those is ~0 bytes.
              size: await calculateBackupSize(path.join(backupsDir, entry.name)),
            });
          } catch (error) {
            // Skip invalid backups
          }
        }
      }

      return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      // Backups directory doesn't exist
      return [];
    }
  } catch (error) {
    logger.error('List backups error', { error: error.message });
    return [];
  }
}

/**
 * Delete backup
 */
async function deleteBackup(backupId) {
  try {
    const backupDir = path.join(process.cwd(), 'backups', backupId);
    await fs.rm(backupDir, { recursive: true, force: true });

    logger.info('Backup deleted', { backupId });
    return { success: true };
  } catch (error) {
    logger.error('Delete backup error', { error: error.message, backupId });
    throw error;
  }
}

/**
 * Total size in bytes of everything written under a backup directory.
 *
 * Walks the tree rather than stat-ing the directory itself (a directory's own
 * st_size is the size of its entry table, not its contents). Returns whatever
 * it managed to sum if part of the tree is unreadable — a size is reporting
 * metadata, so it must never be the reason a completed backup is marked failed.
 *
 * @param {string} backupDir absolute path to the backup root
 * @returns {Promise<number>} total bytes
 */
async function calculateBackupSize(backupDir) {
  let total = 0;

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      logger.warn('Could not read backup directory while sizing', { dir, error: error.message });
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        try {
          const { size } = await fs.stat(full);
          total += size;
        } catch (error) {
          // File vanished mid-walk (rotation/cleanup) — skip it.
          logger.debug('Skipping unreadable backup file while sizing', { full, error: error.message });
        }
      }
      // Symlinks are intentionally not followed: a link into uploads/ would
      // double-count real data and could walk out of the backup tree.
    }
  }

  await walk(backupDir);
  return total;
}

/**
 * Setup automated backups
 */
async function setupAutomatedBackups(schedule) {
  try {
    const { scheduleRecurringJob } = require('./jobSchedulerService');

    // Schedule daily backups
    await scheduleRecurringJob(
      'dr-backup',
      {
        type: 'incremental',
        includeDatabase: true,
        includeFiles: true,
      },
      schedule || '0 2 * * *' // Daily at 2 AM
    );

    logger.info('Automated backups scheduled', { schedule });
    return { success: true };
  } catch (error) {
    logger.error('Setup automated backups error', { error: error.message });
    throw error;
  }
}

/**
 * Test disaster recovery
 */
async function testDisasterRecovery() {
  try {
    // Create test backup
    const backup = await createDRBackup({
      backupType: 'full',
      includeDatabase: true,
      includeFiles: true,
      includeConfig: true,
    });

    // Verify backup
    const manifestPath = path.join(process.cwd(), 'backups', backup.id, 'manifest.json');
    await fs.access(manifestPath);

    logger.info('DR test completed', { backupId: backup.id });
    return {
      success: true,
      backupId: backup.id,
      message: 'Disaster recovery test passed',
    };
  } catch (error) {
    logger.error('DR test error', { error: error.message });
    throw error;
  }
}

module.exports = {
  createDRBackup,
  restoreFromBackup,
  listBackups,
  deleteBackup,
  setupAutomatedBackups,
  testDisasterRecovery,
};






