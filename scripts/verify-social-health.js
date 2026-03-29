#!/usr/bin/env node

/**
 * Social Health Audit Tool
 * 
 * Audits all social media connections in the Mongoose database.
 * Identifies expired tokens, missing refresh tokens, and upcoming expirations.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../server/models/User');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/click';

const platforms = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'];

async function runAudit() {
  console.log('\n🔍 Starting Social Media Health Audit...');
  console.log('='.repeat(60));

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const users = await User.find({ 'oauth': { $exists: true } });
    console.log(`📊 Found ${users.length} users with social data\n`);

    const stats = {
      totalConnections: 0,
      expired: 0,
      expiringSoon: 0, // < 7 days
      healthy: 0,
      noRefresh: 0
    };

    const platformStats = {};
    platforms.forEach(p => platformStats[p] = { connected: 0, healthy: 0, expired: 0 });

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    users.forEach(user => {
      platforms.forEach(platform => {
        const data = user.oauth[platform];
        if (data && data.connected) {
          stats.totalConnections++;
          platformStats[platform].connected++;

          const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
          const hasRefresh = !!data.refreshToken;

          if (!hasRefresh && ['youtube', 'tiktok', 'linkedin'].includes(platform)) {
            stats.noRefresh++;
          }

          if (expiresAt) {
            if (expiresAt < now) {
              stats.expired++;
              platformStats[platform].expired++;
              console.log(`❌ [EXPIRED] User: ${user.email} | Platform: ${platform} | Expired: ${expiresAt.toLocaleDateString()}`);
            } else if (expiresAt < sevenDaysFromNow) {
              stats.expiringSoon++;
              console.log(`⚠️  [SOON]    User: ${user.email} | Platform: ${platform} | Expires: ${expiresAt.toLocaleDateString()}`);
            } else {
              stats.healthy++;
              platformStats[platform].healthy++;
            }
          } else {
            // Assume healthy if no expiration date (e.g. permanent tokens or undefined)
            stats.healthy++;
            platformStats[platform].healthy++;
          }
        }
      });
    });

    console.log('\n' + '='.repeat(60));
    console.log('📊 Global Statistics');
    console.log('='.repeat(60));
    console.log(`Total Connections:  ${stats.totalConnections}`);
    console.log(`Healthy:            ${stats.healthy} ✅`);
    console.log(`Expired:            ${stats.expired} ❌`);
    console.log(`Expiring (7 days):  ${stats.expiringSoon} ⏳`);
    console.log(`Missing Refresh:    ${stats.noRefresh} ⚠️ (Requires reconnection)`);

    console.log('\n' + '='.repeat(60));
    console.log('📱 Platform Breakdown');
    console.log('='.repeat(60));
    console.table(platformStats);

    console.log('\n✅ Audit complete!');
  } catch (error) {
    console.error('❌ Audit failed:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

runAudit();
