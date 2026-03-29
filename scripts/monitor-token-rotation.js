#!/usr/bin/env node

/**
 * Neural Rotation Monitor
 * 
 * Monitors the database for upcoming token expirations and 
 * provides a simulation mode to verify background refresh logic.
 * 
 * Usage: 
 *   node scripts/monitor-token-rotation.js --email=admin@example.com (Watch)
 *   node scripts/monitor-token-rotation.js --email=admin@example.com --test=youtube (Simulate)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../server/models/User');
const OAuthService = require('../server/services/OAuthService');

const platforms = ['tiktok', 'youtube', 'linkedin', 'facebook', 'instagram', 'twitter'];

async function runMonitor() {
  const email = process.argv.find(a => a.startsWith('--email='))?.split('=')[1];
  const testPlatform = process.argv.find(a => a.startsWith('--test='))?.split('=')[1];

  if (!email) {
    console.error('❌ Usage: node scripts/monitor-token-rotation.js --email=your@email.com');
    process.exit(1);
  }

  try {
    console.log('\n📡 Neural Rotation Monitor Active');
    console.log('='.repeat(60));
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/click');
    const user = await User.findOne({ email });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    console.log(`👤 Monitoring User: ${user.name}`);

    // Simulation Mode
    if (testPlatform && platforms.includes(testPlatform)) {
      console.log(`\n🧪 SIMULATION: Forcing ${testPlatform} refresh...`);
      
      const creds = user.oauth?.[testPlatform];
      if (!creds?.connected) {
        console.error(`❌ ${testPlatform} is not connected for this user.`);
        process.exit(1);
      }

      // Artificially expire the token (set to 2 mins ago to trigger refresh)
      console.log(`   ⏳ Setting ${testPlatform} expiresAt to past...`);
      user.oauth[testPlatform].expiresAt = new Date(Date.now() - 120000); 
      user.markModified('oauth');
      await user.save();

      console.log(`   🔄 Triggering OAuthService.ensureValidToken...`);
      try {
        const newToken = await OAuthService.ensureValidToken(user._id, testPlatform);
        console.log(`   ✅ SUCCESS: Token refreshed automatically.`);
        console.log(`   🔑 New Token Start: ${newToken.substring(0, 10)}...`);
        
        // Final verification
        const verifiedUser = await User.findById(user._id);
        const newExpires = verifiedUser.oauth[testPlatform].expiresAt;
        console.log(`   📅 New Expiration: ${newExpires.toLocaleString()}`);
      } catch (err) {
        console.error(`   ❌ FAIL: Background refresh failed: ${err.message}`);
      }
      
      process.exit(0);
    }

    // Standard Monitor Mode
    console.log('\n📊 Connection Lifetimes:');
    platforms.forEach(p => {
      const data = user.oauth?.[p];
      if (data?.connected) {
        const expiresAt = data.expiresAt ? new Date(data.expiresAt) : 'Permanent/Unknown';
        const isExpiring = data.expiresAt && (new Date(data.expiresAt) < new Date(Date.now() + 3600000));
        const status = isExpiring ? '⚠️  EXPIRING SOON' : '✅ HEALTHY';
        console.log(`   - ${p.padEnd(10)} | ${status} | Expires: ${expiresAt.toLocaleString()}`);
      }
    });

    console.log('\n⏲️  Tailing logs for refresh events (Ctrl+C to stop)...');
    
    // Simple polling loop to watch for changes in database
    let lastExpirations = JSON.stringify(platforms.map(p => user.oauth?.[p]?.expiresAt));
    
    while (true) {
      const updatedUser = await User.findById(user._id);
      const currentExpirations = JSON.stringify(platforms.map(p => updatedUser.oauth?.[p]?.expiresAt));
      
      if (currentExpirations !== lastExpirations) {
        console.log(`\n🔔 [${new Date().toLocaleTimeString()}] REFRESH DETECTED! Database updated with new tokens.`);
        lastExpirations = currentExpirations;
        
        platforms.forEach(p => {
          const data = updatedUser.oauth?.[p];
          if (data?.connected) {
             console.log(`   - ${p.padEnd(10)} | New Expiry: ${data.expiresAt?.toLocaleString()}`);
          }
        });
      }
      
      await new Promise(r => setTimeout(r, 5000));
    }

  } catch (error) {
    console.error('❌ Monitor error:', error);
  } finally {
    // We don't close connection in monitor mode because of the loop
  }
}

runMonitor();
