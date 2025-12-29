#!/usr/bin/env node

/**
 * OAuth Integration Test Script
 * 
 * Tests OAuth endpoints for all platforms
 * Usage: node scripts/test-oauth.js [platform]
 */

const axios = require('axios');
const readline = require('readline');

const API_URL = process.env.API_URL || 'http://localhost:5001/api';
const TEST_TOKEN = process.env.TEST_TOKEN; // Set this to a valid JWT token

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const platforms = ['twitter', 'linkedin', 'facebook', 'instagram'];

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function checkStatus(platform, token) {
  try {
    const response = await axios.get(`${API_URL}/oauth/${platform}/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

async function getAuthUrl(platform, token) {
  try {
    const response = await axios.get(`${API_URL}/oauth/${platform}/authorize`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

async function checkHealth(token) {
  try {
    const response = await axios.get(`${API_URL}/oauth/health`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

async function testPlatform(platform, token) {
  console.log(`\n📋 Testing ${platform.toUpperCase()}...`);
  console.log('─'.repeat(50));

  // Check status
  console.log('1. Checking connection status...');
  const status = await checkStatus(platform, token);
  if (status.success) {
    console.log(`   ✅ Connected: ${status.data.connected}`);
    console.log(`   ✅ Configured: ${status.data.configured}`);
    if (status.data.connectedAt) {
      console.log(`   ✅ Connected at: ${status.data.connectedAt}`);
    }
  } else {
    console.log(`   ❌ Error: ${status.error}`);
  }

  // Check if configured
  if (status.success && !status.data.configured) {
    console.log(`   ⚠️  ${platform} OAuth is not configured`);
    return;
  }

  // Get auth URL (if not connected)
  if (status.success && !status.data.connected) {
    console.log('\n2. Getting authorization URL...');
    const authUrl = await getAuthUrl(platform, token);
    if (authUrl.success) {
      console.log(`   ✅ Auth URL generated`);
      console.log(`   🔗 URL: ${authUrl.data.url.substring(0, 80)}...`);
      console.log(`   📝 State: ${authUrl.data.state}`);
    } else {
      console.log(`   ❌ Error: ${authUrl.error}`);
    }
  }
}

async function main() {
  console.log('🔐 OAuth Integration Test Script\n');
  console.log('='.repeat(50));

  // Get token
  let token = TEST_TOKEN;
  if (!token) {
    token = await question('Enter your JWT token (or set TEST_TOKEN env var): ');
  }

  if (!token) {
    console.error('❌ Token is required');
    process.exit(1);
  }

  // Get platform to test
  const platformArg = process.argv[2];
  const platformsToTest = platformArg 
    ? [platformArg.toLowerCase()] 
    : platforms;

  // Validate platforms
  for (const platform of platformsToTest) {
    if (!platforms.includes(platform)) {
      console.error(`❌ Invalid platform: ${platform}`);
      console.error(`   Valid platforms: ${platforms.join(', ')}`);
      process.exit(1);
    }
  }

  // Test health check
  console.log('\n🏥 Testing OAuth Health Check...');
  const health = await checkHealth(token);
  if (health.success) {
    console.log('   ✅ Health check passed');
    console.log(`   📊 Summary:`, health.data.summary);
  } else {
    console.log(`   ❌ Error: ${health.error}`);
  }

  // Test each platform
  for (const platform of platformsToTest) {
    await testPlatform(platform, token);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Testing complete!\n');

  rl.close();
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});



