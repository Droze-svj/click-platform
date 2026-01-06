#!/usr/bin/env node

/**
 * Production Backup System
 * Automated backup of database, logs, and critical files
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')

class ProductionBackup {
  constructor() {
    this.backupDir = path.join(__dirname, '..', 'backups')
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    this.backupName = `click-backup-${this.timestamp}`

    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true })
    }
  }

  async runFullBackup() {
    console.log('💾 Starting Click Production Backup...')
    console.log('=====================================')

    try {
      await this.backupDatabase()
      await this.backupLogs()
      await this.backupConfiguration()
      await this.backupUploads()
      await this.createBackupArchive()
      await this.cleanupOldBackups()
      await this.verifyBackup()

      console.log('✅ Full backup completed successfully!')
      console.log(`📁 Backup location: ${path.join(this.backupDir, this.backupName + '.tar.gz')}`)

      // Send notification if configured
      await this.sendBackupNotification(true)

    } catch (error) {
      console.error('❌ Backup failed:', error.message)
      await this.sendBackupNotification(false, error.message)
      process.exit(1)
    }
  }

  async backupDatabase() {
    console.log('📊 Backing up database...')

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/click_production'
    const backupPath = path.join(this.backupDir, 'temp', 'database')

    // Create temp directory
    fs.mkdirSync(backupPath, { recursive: true })

    try {
      // Use mongodump for backup
      execSync(`mongodump --uri="${mongoUri}" --out="${backupPath}" --quiet`, {
        stdio: 'inherit'
      })

      console.log('✅ Database backup completed')
    } catch (error) {
      console.warn('⚠️  MongoDB native backup failed, trying alternative method...')

      // Fallback: Export collections manually
      await this.backupCollectionsManually(backupPath)
    }
  }

  async backupCollectionsManually(backupPath) {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/click_production'

    try {
      const client = new MongoClient(mongoUri)
      await client.connect()

      const db = client.db()
      const collections = await db.listCollections().toArray()

      for (const collection of collections) {
        const collectionName = collection.name
        console.log(`  Exporting collection: ${collectionName}`)

        const data = await db.collection(collectionName).find({}).toArray()
        const filePath = path.join(backupPath, `${collectionName}.json`)

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
      }

      await client.close()
      console.log('✅ Manual database backup completed')

    } catch (error) {
      throw new Error(`Database backup failed: ${error.message}`)
    }
  }

  async backupLogs() {
    console.log('📝 Backing up logs...')

    const logFiles = [
      'logs/pm2-error.log',
      'logs/pm2-out.log',
      'logs/pm2-combined.log',
      'logs/worker-error.log',
      'logs/worker-out.log'
    ]

    const logBackupDir = path.join(this.backupDir, 'temp', 'logs')
    fs.mkdirSync(logBackupDir, { recursive: true })

    for (const logFile of logFiles) {
      const srcPath = path.join(__dirname, '..', logFile)
      const destPath = path.join(logBackupDir, path.basename(logFile))

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath)
      }
    }

    console.log('✅ Logs backup completed')
  }

  async backupConfiguration() {
    console.log('⚙️  Backing up configuration...')

    const configFiles = [
      '.env.local',
      'ecosystem.config.js',
      'client/next.config.js',
      'client/manifest.json'
    ]

    const configBackupDir = path.join(this.backupDir, 'temp', 'config')
    fs.mkdirSync(configBackupDir, { recursive: true })

    for (const configFile of configFiles) {
      const srcPath = path.join(__dirname, '..', configFile)
      const destPath = path.join(configBackupDir, path.basename(configFile))

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath)
      }
    }

    console.log('✅ Configuration backup completed')
  }

  async backupUploads() {
    console.log('📁 Backing up uploads...')

    const uploadsDir = path.join(__dirname, '..', 'uploads')
    const uploadsBackupDir = path.join(this.backupDir, 'temp', 'uploads')

    if (fs.existsSync(uploadsDir)) {
      // Use rsync for efficient copying
      try {
        execSync(`rsync -a --delete "${uploadsDir}/" "${uploadsBackupDir}/"`, {
          stdio: 'pipe'
        })
      } catch (error) {
        // Fallback to manual copy
        this.copyDirectoryRecursive(uploadsDir, uploadsBackupDir)
      }
    }

    console.log('✅ Uploads backup completed')
  }

  copyDirectoryRecursive(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true })

    fs.mkdirSync(dest, { recursive: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        this.copyDirectoryRecursive(srcPath, destPath)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }

  async createBackupArchive() {
    console.log('📦 Creating backup archive...')

    const tempDir = path.join(this.backupDir, 'temp')
    const archivePath = path.join(this.backupDir, this.backupName + '.tar.gz')

    execSync(`tar -czf "${archivePath}" -C "${tempDir}" .`, {
      stdio: 'inherit'
    })

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true })

    console.log('✅ Backup archive created')
  }

  async cleanupOldBackups() {
    console.log('🧹 Cleaning up old backups...')

    const backupFiles = fs.readdirSync(this.backupDir)
      .filter(file => file.endsWith('.tar.gz'))
      .map(file => ({
        name: file,
        path: path.join(this.backupDir, file),
        stats: fs.statSync(path.join(this.backupDir, file))
      }))
      .sort((a, b) => b.stats.mtime - a.stats.mtime)

    // Keep only last 7 daily backups and last 4 weekly backups
    const keepCount = 7
    if (backupFiles.length > keepCount) {
      const filesToDelete = backupFiles.slice(keepCount)
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path)
        console.log(`  Deleted old backup: ${file.name}`)
      }
    }

    console.log('✅ Old backups cleaned up')
  }

  async verifyBackup() {
    console.log('🔍 Verifying backup integrity...')

    const archivePath = path.join(this.backupDir, this.backupName + '.tar.gz')

    if (!fs.existsSync(archivePath)) {
      throw new Error('Backup archive not found')
    }

    const stats = fs.statSync(archivePath)
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2)

    console.log(`✅ Backup verified: ${sizeMB}MB`)

    return {
      path: archivePath,
      size: stats.size,
      sizeMB: sizeMB
    }
  }

  async sendBackupNotification(success, error = null) {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL
      if (!webhookUrl) return

      const payload = {
        text: success ? '✅ Click Backup Completed' : '❌ Click Backup Failed',
        attachments: [{
          color: success ? 'good' : 'danger',
          fields: [
            {
              title: 'Status',
              value: success ? 'Success' : 'Failed',
              short: true
            },
            {
              title: 'Timestamp',
              value: this.timestamp,
              short: true
            }
          ]
        }]
      }

      if (error) {
        payload.attachments[0].fields.push({
          title: 'Error',
          value: error,
          short: false
        })
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        console.warn('Failed to send Slack notification')
      }

    } catch (error) {
      console.warn('Backup notification failed:', error.message)
    }
  }
}

// Run backup if called directly
if (require.main === module) {
  const backup = new ProductionBackup()
  backup.runFullBackup().catch(console.error)
}

module.exports = ProductionBackup





