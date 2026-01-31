#!/usr/bin/env node

console.log('🔍 Server Diagnostics - WHOP AI V3');
console.log('=====================================');

// Check Node.js version and memory
console.log('\n📊 Node.js Information:');
console.log('Node Version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('Memory Usage:', {
  rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
  heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
  heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
  external: `${Math.round(process.memoryUsage().external / 1024 / 1024)}MB`
});

// Check environment variables
console.log('\n🔧 Environment Variables:');
const required = ['NODE_ENV', 'PORT', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const optional = ['REDIS_URL', 'MONGODB_URI', 'DATABASE_URL', 'SENDGRID_API_KEY'];

required.forEach(key => {
  const value = process.env[key];
  const status = value ? '✅' : '❌';
  console.log(`${status} ${key}: ${value ? 'SET' : 'NOT SET'}`);
});

optional.forEach(key => {
  const value = process.env[key];
  const status = value ? '✅' : '⚠️';
  console.log(`${status} ${key}: ${value ? 'SET' : 'NOT SET'}`);
});

// Check database connectivity
console.log('\n💾 Database Connections:');
async function testConnections() {
  // Test Supabase
  if (process.env.SUPABASE_URL) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY || 'dummy'
      );
      const { data, error } = await supabase.from('users').select('count').limit(1);
      console.log('✅ Supabase:', error ? 'Connection failed' : 'Connected');
    } catch (err) {
      console.log('❌ Supabase:', err.message);
    }
  } else {
    console.log('❌ Supabase: No URL configured');
  }

  // Test MongoDB if configured
  if (process.env.MONGODB_URI) {
    try {
      const mongoose = require('mongoose');
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      console.log('✅ MongoDB: Connected');
      await mongoose.disconnect();
    } catch (err) {
      console.log('❌ MongoDB:', err.message);
    }
  } else {
    console.log('⚠️ MongoDB: Not configured (using Supabase as primary)');
  }

  // Test Redis if configured
  if (process.env.REDIS_URL && !process.env.REDIS_URL.includes('localhost')) {
    try {
      const redis = require('redis');
      const client = redis.createClient({ url: process.env.REDIS_URL });
      await client.connect();
      await client.ping();
      console.log('✅ Redis: Connected');
      await client.disconnect();
    } catch (err) {
      console.log('❌ Redis:', err.message);
    }
  } else {
    console.log('⚠️ Redis: Not configured or using localhost (disabled in production)');
  }
}

// Check file permissions and existence
console.log('\n📁 File System Check:');
const fs = require('fs');
const path = require('path');

const criticalFiles = [
  'server/index.js',
  'package.json',
  '.env',
  'node_modules'
];

criticalFiles.forEach(file => {
  const exists = fs.existsSync(file);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${file}: ${exists ? 'Exists' : 'Missing'}`);

  if (exists && file !== 'node_modules') {
    try {
      const stats = fs.statSync(file);
      console.log(`   Permissions: ${stats.mode.toString(8)}`);
    } catch (err) {
      console.log(`   Cannot read permissions: ${err.message}`);
    }
  }
});

// Check port availability
console.log('\n🔌 Port Check:');
const net = require('net');

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close();
      resolve(true);
    });
    server.on('error', () => {
      resolve(false);
    });
  });
}

async function testPorts() {
  const ports = [5001, 3000, 6379, 27017];
  for (const port of ports) {
    const available = await checkPort(port);
    const status = available ? '✅' : '❌';
    console.log(`${status} Port ${port}: ${available ? 'Available' : 'In use'}`);
  }
}

// Run all checks
async function runDiagnostics() {
  await testConnections();
  await testPorts();

  console.log('\n🎯 Recommendations:');
  console.log('===================');

  if (!process.env.SUPABASE_URL) {
    console.log('❌ Set SUPABASE_URL environment variable');
  }

  if (!process.env.REDIS_URL || process.env.REDIS_URL.includes('localhost')) {
    console.log('⚠️ Consider using a cloud Redis service (Redis Labs, etc.)');
  }

  console.log('💡 For production:');
  console.log('   - Set NODE_ENV=production');
  console.log('   - Configure Redis URL');
  console.log('   - Set up monitoring alerts');
  console.log('   - Configure database backups');

  console.log('\n✨ Diagnostics complete!');
}

runDiagnostics().catch(console.error);





