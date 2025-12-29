#!/usr/bin/env node

/**
 * Comprehensive OAuth Verification Script
 * 
 * Tests OAuth integrations for all platforms end-to-end
 * Usage: node scripts/verify-oauth-comprehensive.js [--platform=twitter] [--env=staging]
 */

const axios = require('axios');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Load environment variables
const env = process.argv.find(arg => arg.startsWith('--env='))?.split('=')[1] || 'development';
const envFile = env === 'production' ? '.env.production' : env === 'staging' ? '.env.staging' : '.env';

if (fs.existsSync(envFile)) {
  require('dotenv').config({ path: envFile });
} else {
  require('dotenv').config();
}

const API_URL = process.env.API_URL || (env === 'staging' ? 'http://localhost:5002/api' : 'http://localhost:5001/api');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const platforms = {
  twitter: {
    name: 'Twitter/X',
    service: 'twitterOAuthService',
    requiredVars: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET', 'TWITTER_CALLBACK_URL'],
    endpoints: {
      authorize: '/oauth/twitter/authorize',
      callback: '/oauth/twitter/callback',
      status: '/oauth/twitter/status',
      post: '/oauth/twitter/post'
    }
  },
  linkedin: {
    name: 'LinkedIn',
    service: 'linkedinOAuthService',
    requiredVars: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_CALLBACK_URL'],
    endpoints: {
      authorize: '/oauth/linkedin/authorize',
      callback: '/oauth/linkedin/callback',
      status: '/oauth/linkedin/status',
      post: '/oauth/linkedin/post'
    }
  },
  facebook: {
    name: 'Facebook',
    service: 'facebookOAuthService',
    requiredVars: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'FACEBOOK_CALLBACK_URL'],
    endpoints: {
      authorize: '/oauth/facebook/authorize',
      callback: '/oauth/facebook/callback',
      status: '/oauth/facebook/status',
      post: '/oauth/facebook/post'
    }
  },
  instagram: {
    name: 'Instagram',
    service: 'instagramOAuthService',
    requiredVars: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'FACEBOOK_CALLBACK_URL'],
    endpoints: {
      authorize: '/oauth/instagram/authorize',
      callback: '/oauth/instagram/callback',
      status: '/oauth/instagram/status',
      accounts: '/oauth/instagram/accounts',
      post: '/oauth/instagram/post'
    },
    requires: 'facebook'
  },
  youtube: {
    name: 'YouTube',
    service: 'youtubeOAuthService',
    requiredVars: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_CALLBACK_URL'],
    endpoints: {
      authorize: '/oauth/youtube/authorize',
      callback: '/oauth/youtube/callback',
      status: '/oauth/youtube/status',
      post: '/oauth/youtube/post'
    }
  },
  tiktok: {
    name: 'TikTok',
    service: 'tiktokOAuthService',
    requiredVars: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_CALLBACK_URL'],
    endpoints: {
      authorize: '/oauth/tiktok/authorize',
      callback: '/oauth/tiktok/callback',
      status: '/oauth/tiktok/status',
      post: '/oauth/tiktok/post'
    }
  }
};

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m'
  };
  const icons = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  };
  console.log(`${colors[type]}${icons[type]} ${message}${colors.reset}`);
}

async function checkHealth() {
  try {
    const response = await axios.get(`${API_URL.replace('/api', '')}/api/health`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function checkEnvironmentVariables(platform) {
  const config = platforms[platform];
  const missing = [];
  const warnings = [];

  // Check required variables
  config.requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    } else if (process.env[varName].includes('your-') || process.env[varName].includes('YOUR-')) {
      warnings.push(`${varName} contains placeholder value`);
    }
  });

  // Check prerequisites
  if (config.requires) {
    const requiredPlatform = platforms[config.requires];
    const hasRequired = requiredPlatform.requiredVars.every(v => process.env[v]);
    if (!hasRequired) {
      warnings.push(`${config.name} requires ${requiredPlatform.name} to be configured first`);
    }
  }

  return { missing, warnings, configured: missing.length === 0 };
}

async function checkStatus(platform, token) {
  try {
    const endpoint = platforms[platform].endpoints.status;
    const response = await axios.get(`${API_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      status: error.response?.status
    };
  }
}

async function getAuthUrl(platform, token) {
  try {
    const endpoint = platforms[platform].endpoints.authorize;
    const response = await axios.get(`${API_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      status: error.response?.status
    };
  }
}

async function testPlatform(platform, token) {
  const config = platforms[platform];
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📱 Testing ${config.name}`);
  console.log('='.repeat(60));

  // 1. Check environment variables
  log(`Checking environment variables...`, 'info');
  const envCheck = checkEnvironmentVariables(platform);
  
  if (envCheck.missing.length > 0) {
    log(`Missing required variables: ${envCheck.missing.join(', ')}`, 'error');
    return { platform, status: 'not_configured', issues: envCheck.missing };
  }

  if (envCheck.warnings.length > 0) {
    envCheck.warnings.forEach(warning => log(warning, 'warning'));
  }

  log(`Environment variables configured`, 'success');

  // 2. Check connection status
  log(`Checking connection status...`, 'info');
  const status = await checkStatus(platform, token);
  
  if (!status.success) {
    if (status.status === 401) {
      log(`Authentication failed. Please provide a valid token.`, 'error');
      return { platform, status: 'auth_failed', issues: ['Invalid token'] };
    }
    log(`Status check failed: ${status.error}`, 'error');
    return { platform, status: 'error', issues: [status.error] };
  }

  const isConnected = status.data?.data?.connected || status.data?.connected;
  const isConfigured = status.data?.data?.configured || status.data?.configured;

  if (isConnected) {
    log(`Already connected`, 'success');
    if (status.data?.data?.connectedAt) {
      log(`Connected at: ${status.data.data.connectedAt}`, 'info');
    }
    return { platform, status: 'connected', data: status.data };
  }

  if (!isConfigured) {
    log(`OAuth not configured on server`, 'error');
    return { platform, status: 'not_configured', issues: ['Server configuration missing'] };
  }

  // 3. Get authorization URL
  log(`Getting authorization URL...`, 'info');
  const authUrl = await getAuthUrl(platform, token);
  
  if (!authUrl.success) {
    log(`Failed to get auth URL: ${authUrl.error}`, 'error');
    return { platform, status: 'error', issues: [authUrl.error] };
  }

  log(`Authorization URL generated`, 'success');
  const url = authUrl.data?.data?.url || authUrl.data?.url;
  const state = authUrl.data?.data?.state || authUrl.data?.state;
  
  console.log(`\n   🔗 URL: ${url.substring(0, 80)}...`);
  console.log(`   📝 State: ${state}`);
  console.log(`\n   ⚠️  Manual testing required:`);
  console.log(`   1. Open the URL above in a browser`);
  console.log(`   2. Complete the OAuth flow`);
  console.log(`   3. Verify the callback is handled correctly`);

  return {
    platform,
    status: 'ready',
    authUrl: url,
    state: state,
    needsManualTest: true
  };
}

async function generateReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    environment: env,
    apiUrl: API_URL,
    results: results,
    summary: {
      total: results.length,
      connected: results.filter(r => r.status === 'connected').length,
      ready: results.filter(r => r.status === 'ready').length,
      notConfigured: results.filter(r => r.status === 'not_configured').length,
      errors: results.filter(r => r.status === 'error' || r.status === 'auth_failed').length
    }
  };

  // Save report
  const reportPath = path.join(process.cwd(), 'oauth-verification-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`Report saved to: ${reportPath}`, 'info');

  return report;
}

async function main() {
  console.log('\n🔐 Comprehensive OAuth Verification Script\n');
  console.log('='.repeat(60));
  console.log(`Environment: ${env}`);
  console.log(`API URL: ${API_URL}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log('='.repeat(60));

  // Check API health
  log(`Checking API health...`, 'info');
  const health = await checkHealth();
  if (!health.success) {
    log(`API is not reachable. Make sure the server is running.`, 'error');
    process.exit(1);
  }
  log(`API is healthy`, 'success');

  // Get token
  let token = process.env.TEST_TOKEN;
  if (!token) {
    // Check if we're in an interactive terminal
    if (process.stdin.isTTY && rl && !rl.closed) {
      token = await question('\nEnter your JWT token (or set TEST_TOKEN env var): ');
    } else {
      log(`Token is required for testing`, 'error');
      console.log('\nTo get a token:');
      console.log('  1. Register/login via API');
      console.log('  2. Copy the JWT token from response');
      console.log('  3. Set TEST_TOKEN env var: export TEST_TOKEN="your-token"');
      console.log('\nRunning structure-only check (no token required)...');
      // Run structure check instead
      const { verifyOAuthStructure } = require('./verify-oauth-structure');
      verifyOAuthStructure();
      process.exit(0);
    }
  }

  if (!token || token.trim() === '') {
    log(`Token is required for testing`, 'error');
    console.log('\nTo get a token:');
    console.log('  1. Register/login via API');
    console.log('  2. Copy the JWT token from response');
    console.log('  3. Set TEST_TOKEN env var or provide when prompted');
    process.exit(1);
  }

  // Get platforms to test
  const platformArg = process.argv.find(arg => arg.startsWith('--platform='))?.split('=')[1];
  const platformsToTest = platformArg 
    ? [platformArg.toLowerCase()]
    : Object.keys(platforms);

  // Validate platforms
  const invalidPlatforms = platformsToTest.filter(p => !platforms[p]);
  if (invalidPlatforms.length > 0) {
    log(`Invalid platforms: ${invalidPlatforms.join(', ')}`, 'error');
    console.log(`Valid platforms: ${Object.keys(platforms).join(', ')}`);
    process.exit(1);
  }

  // Test each platform
  const results = [];
  for (const platform of platformsToTest) {
    const result = await testPlatform(platform, token);
    results.push(result);
  }

  // Generate report
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Verification Summary');
  console.log('='.repeat(60));
  
  const report = await generateReport(results);
  
  console.log(`\nTotal Platforms: ${report.summary.total}`);
  console.log(`✅ Connected: ${report.summary.connected}`);
  console.log(`🔗 Ready for Testing: ${report.summary.ready}`);
  console.log(`⚠️  Not Configured: ${report.summary.notConfigured}`);
  console.log(`❌ Errors: ${report.summary.errors}`);

  // Show next steps
  if (report.summary.ready > 0) {
    console.log(`\n📋 Next Steps:`);
    console.log(`   1. Complete manual OAuth flows for ready platforms`);
    console.log(`   2. Test posting functionality`);
    console.log(`   3. Verify token refresh mechanisms`);
  }

  if (report.summary.notConfigured > 0) {
    console.log(`\n⚠️  Action Required:`);
    console.log(`   Configure missing OAuth credentials in ${envFile}`);
  }

  console.log(`\n✅ Verification complete!\n`);

  rl.close();
}

main().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});


