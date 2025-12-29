#!/usr/bin/env node

/**
 * Database Backup Script
 * Creates backups of MongoDB database
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.production') });

const logger = require('../server/utils/logger');

async function backupDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not set');
    }

    // Extract database name from URI
    const dbName = mongoUri.split('/').pop().split('?')[0];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../backups');
    const backupFile = path.join(backupDir, `backup-${timestamp}.gz`);

    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log('🔄 Creating database backup...');
    console.log(`  Database: ${dbName}`);
    console.log(`  Backup file: ${backupFile}`);

    // Create backup using mongodump
    const command = `mongodump --uri="${mongoUri}" --archive="${backupFile}" --gzip`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Backup failed:', error);
        logger.error('Database backup error', { error: error.message });
        process.exit(1);
      }

      console.log('✅ Backup created successfully');
      console.log(`  Size: ${(fs.statSync(backupFile).size / 1024 / 1024).toFixed(2)} MB`);

      // Clean up old backups (keep last 7 days)
      cleanupOldBackups(backupDir);

      logger.info('Database backup completed', { backupFile });
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Backup error:', error);
    logger.error('Database backup error', { error: error.message });
    process.exit(1);
  }
}

function cleanupOldBackups(backupDir) {
  const files = fs.readdirSync(backupDir)
    .map(file => ({
      name: file,
      path: path.join(backupDir, file),
      time: fs.statSync(path.join(backupDir, file)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  // Keep last 7 days of backups
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const toDelete = files.filter(file => file.time < sevenDaysAgo);

  toDelete.forEach(file => {
    console.log(`  🗑️  Deleting old backup: ${file.name}`);
    fs.unlinkSync(file.path);
  });

  if (toDelete.length > 0) {
    console.log(`  ✅ Cleaned up ${toDelete.length} old backup(s)`);
  }
}

backupDatabase();



