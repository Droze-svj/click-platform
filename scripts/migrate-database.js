#!/usr/bin/env node

/**
 * Database Migration Script
 * Run database migrations for production deployment
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.production') });

const logger = require('../server/utils/logger');

async function runMigrations() {
  try {
    console.log('🔄 Starting database migrations...');
    
    // Connect to database
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not set');
    }

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to database');

    // Run migrations
    const migrations = [
      {
        name: 'add_oauth_fields',
        run: async () => {
          const User = require('../server/models/User');
          const result = await User.updateMany(
            { 'oauth': { $exists: false } },
            { $set: { 'oauth': {} } }
          );
          console.log(`  ✅ Added OAuth fields to ${result.modifiedCount} users`);
        },
      },
      {
        name: 'add_privacy_fields',
        run: async () => {
          const User = require('../server/models/User');
          const result = await User.updateMany(
            { 'privacy': { $exists: false } },
            { $set: { 'privacy': { dataConsent: false, analyticsConsent: true } } }
          );
          console.log(`  ✅ Added privacy fields to ${result.modifiedCount} users`);
        },
      },
      {
        name: 'add_indexes',
        run: async () => {
          const User = require('../server/models/User');
          const Content = require('../server/models/Content');
          
          // Create indexes if they don't exist
          await User.collection.createIndex({ email: 1 }, { unique: true, sparse: true });
          await User.collection.createIndex({ 'subscription.status': 1, 'subscription.endDate': 1 });
          await Content.collection.createIndex({ userId: 1, createdAt: -1 });
          await Content.collection.createIndex({ status: 1 });
          
          console.log('  ✅ Created database indexes');
        },
      },
    ];

    // Track completed migrations
    const Migration = mongoose.model('Migration', new mongoose.Schema({
      name: String,
      completedAt: Date,
    }));

    for (const migration of migrations) {
      const existing = await Migration.findOne({ name: migration.name });
      
      if (existing) {
        console.log(`  ⏭️  Skipping ${migration.name} (already completed)`);
        continue;
      }

      console.log(`  🔄 Running ${migration.name}...`);
      await migration.run();
      
      await Migration.create({
        name: migration.name,
        completedAt: new Date(),
      });
      
      console.log(`  ✅ Completed ${migration.name}`);
    }

    console.log('✅ All migrations completed successfully');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    logger.error('Database migration error', { error: error.message });
    await mongoose.connection.close();
    process.exit(1);
  }
}

runMigrations();
