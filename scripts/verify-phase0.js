#!/usr/bin/env node
/**
 * Phase 0 Verification — MongoDB + Redis connectivity
 * Run: npm run verify:phase0
 * Use: BASE_URL=https://click-platform.onrender.com node scripts/verify-phase0.js (for production)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

const API_URL = process.env.BASE_URL || process.env.API_URL || 'http://localhost:5001';
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/click';
const REDIS_URL = process.env.REDIS_URL?.trim();
const isProductionCheck = API_URL.includes('render.com') || API_URL.includes('onrender');

async function testMongoDB() {
  if (isProductionCheck) {
    console.log('\n📦 MongoDB... (skipped — production; API health implies DB)');
    return true;
  }
  console.log('\n📦 MongoDB...');
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log('   ✅ MongoDB connected successfully');
    await mongoose.disconnect();
    return true;
  } catch (err) {
    console.log('   ❌ MongoDB failed:', err.message);
    if (err.message?.includes('IP')) {
      console.log('   → Fix: MongoDB Atlas → Network Access → Add 0.0.0.0/0 (Allow from anywhere)');
    }
    return false;
  }
}

async function testRedis() {
  console.log('\n📦 Redis...');
  if (isProductionCheck) {
    console.log('   (skipped — production; check Render logs for worker status)');
    return null;
  }
  if (!REDIS_URL || REDIS_URL === '') {
    console.log('   ⚠️ REDIS_URL not set — workers will be disabled (OK for local dev)');
    return null;
  }
  if (REDIS_URL.includes('localhost') || REDIS_URL.includes('127.0.0.1')) {
    console.log('   ⚠️ REDIS_URL points to localhost — OK for local, required for production');
    try {
      const Redis = require('ioredis');
      const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
      await redis.connect();
      await redis.ping();
      redis.disconnect();
      console.log('   ✅ Redis (local) connected');
      return true;
    } catch (err) {
      console.log('   ❌ Redis failed:', err.message);
      return false;
    }
  }
  try {
    const Redis = require('ioredis');
    const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true, connectTimeout: 5000 });
    await redis.connect();
    await redis.ping();
    redis.disconnect();
    console.log('   ✅ Redis (cloud) connected');
    return true;
  } catch (err) {
    console.log('   ❌ Redis failed:', err.message);
    console.log('   → Fix: Render → Environment → Set REDIS_URL (no quotes, no spaces)');
    return false;
  }
}

async function testApiHealth() {
  console.log('\n📦 API Health...');
  try {
    const res = await axios.get(`${API_URL}/api/health`, { timeout: 10000, validateStatus: () => true });
    if (res.status >= 200 && res.status < 300) {
      console.log('   ✅ API responded:', res.status);
      return true;
    }
    console.log('   ❌ API returned:', res.status);
    return false;
  } catch (err) {
    console.log('   ❌ API unreachable:', err.message);
    return false;
  }
}

async function main() {
  console.log('🔍 Phase 0 Verification');
  console.log('========================');
  console.log('API_URL:', API_URL);
  console.log('MONGODB_URI:', MONGODB_URI ? MONGODB_URI.replace(/:[^:@]+@/, ':****@') : 'NOT SET');
  console.log('REDIS_URL:', REDIS_URL ? REDIS_URL.replace(/:[^:@]+@/, ':****@').substring(0, 50) + '...' : 'NOT SET');

  const mongoOk = await testMongoDB();
  const redisOk = await testRedis();
  const apiOk = await testApiHealth();

  console.log('\n📊 Summary');
  console.log('==========');
  console.log('  MongoDB:', mongoOk ? '✅' : '❌');
  console.log('  Redis:', redisOk === null ? '⚠️ not configured' : redisOk ? '✅' : '❌');
  console.log('  API:', apiOk ? '✅' : '❌');

  const critical = mongoOk && apiOk;
  if (!critical) {
    console.log('\n❌ Phase 0 incomplete. Fix MongoDB and/or API. See PHASE_0_FIX_GUIDE.md');
    process.exit(1);
  }
  if (!redisOk && redisOk !== null) {
    console.log('\n⚠️ Redis failed — workers disabled. See PHASE_0_FIX_GUIDE.md');
  } else {
    console.log('\n✅ Phase 0 OK — Click is ready for testing.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
