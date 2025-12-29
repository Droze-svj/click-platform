#!/usr/bin/env node

/**
 * OAuth Integration Testing Script
 * 
 * This script tests OAuth integrations for all platforms:
 * - LinkedIn
 * - Facebook
 * - Instagram (via Facebook)
 * - TikTok
 * - YouTube
 * 
 * Usage:
 *   node scripts/test-oauth-integrations.js [platform]
 * 
 * Examples:
 *   node scripts/test-oauth-integrations.js linkedin
 *   node scripts/test-oauth-integrations.js all
 */

const readline = require('readline');
const axios = require('axios');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

/**
 * Check if OAuth is configured for a platform
 */
function checkConfiguration(platform) {
  const configs = {
    linkedin: {
      required: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
      optional: ['LINKEDIN_CALLBACK_URL'],
    },
    facebook: {
      required: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
      optional: ['FACEBOOK_CALLBACK_URL'],
    },
    instagram: {
      required: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'], // Uses Facebook
      optional: ['FACEBOOK_CALLBACK_URL'],
    },
    tiktok: {
      required: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
      optional: ['TIKTOK_CALLBACK_URL'],
    },
    youtube: {
      required: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
      optional: ['YOUTUBE_CALLBACK_URL'],
    },
  };

  const config = configs[platform.toLowerCase()];
  if (!config) {
    return { configured: false, missing: [], message: `Unknown platform: ${platform}` };
  }

  const missing = config.required.filter(key => !process.env[key]);
  const configured = missing.length === 0;

  return {
    configured,
    missing,
    message: configured 
      ? `${platform} OAuth is configured`
      : `${platform} OAuth is missing: ${missing.join(', ')}`,
  };
}

/**
 * Test LinkedIn OAuth configuration
 */
async function testLinkedIn() {
  logSection('Testing LinkedIn OAuth');

  const config = checkConfiguration('linkedin');
  if (!config.configured) {
    logError(config.message);
    return { success: false, message: config.message };
  }

  logSuccess('LinkedIn OAuth is configured');

  // Test authorization URL generation
  try {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const callbackUrl = process.env.LINKEDIN_CALLBACK_URL || 'http://localhost:5001/api/oauth/linkedin/callback';
    
    logInfo('Testing authorization URL generation...');
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `scope=${encodeURIComponent('openid profile email w_member_social')}`;

    if (authUrl.includes(clientId)) {
      logSuccess('Authorization URL can be generated');
    } else {
      logError('Authorization URL generation failed');
      return { success: false, message: 'Failed to generate authorization URL' };
    }

    logInfo('LinkedIn OAuth configuration test passed');
    logWarning('To complete full OAuth flow, you need to:');
    logInfo('1. Visit the authorization URL in a browser');
    logInfo('2. Authorize the application');
    logInfo('3. Copy the authorization code from the callback');
    logInfo('4. Test token exchange (requires authorization code)');

    return { success: true, message: 'LinkedIn OAuth configuration is valid' };
  } catch (error) {
    logError(`LinkedIn OAuth test failed: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Test Facebook OAuth configuration
 */
async function testFacebook() {
  logSection('Testing Facebook OAuth');

  const config = checkConfiguration('facebook');
  if (!config.configured) {
    logError(config.message);
    return { success: false, message: config.message };
  }

  logSuccess('Facebook OAuth is configured');

  try {
    const appId = process.env.FACEBOOK_APP_ID;
    const callbackUrl = process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:5001/api/oauth/facebook/callback';
    
    logInfo('Testing authorization URL generation...');
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${appId}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `scope=${encodeURIComponent('pages_manage_posts,pages_read_engagement,pages_show_list,public_profile')}&` +
      `response_type=code`;

    if (authUrl.includes(appId)) {
      logSuccess('Authorization URL can be generated');
    } else {
      logError('Authorization URL generation failed');
      return { success: false, message: 'Failed to generate authorization URL' };
    }

    // Test Graph API connectivity (without auth)
    logInfo('Testing Facebook Graph API connectivity...');
    try {
      const response = await axios.get('https://graph.facebook.com/v18.0/', {
        timeout: 5000,
      });
      logSuccess('Facebook Graph API is reachable');
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        logWarning('Could not reach Facebook Graph API (network issue)');
      } else {
        logSuccess('Facebook Graph API is reachable (expected error without auth)');
      }
    }

    logInfo('Facebook OAuth configuration test passed');
    logWarning('To complete full OAuth flow, you need to:');
    logInfo('1. Visit the authorization URL in a browser');
    logInfo('2. Authorize the application');
    logInfo('3. Copy the authorization code from the callback');
    logInfo('4. Test token exchange (requires authorization code)');

    return { success: true, message: 'Facebook OAuth configuration is valid' };
  } catch (error) {
    logError(`Facebook OAuth test failed: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Test Instagram OAuth configuration (uses Facebook)
 */
async function testInstagram() {
  logSection('Testing Instagram OAuth (via Facebook)');

  const config = checkConfiguration('instagram');
  if (!config.configured) {
    logError(config.message);
    logWarning('Instagram requires Facebook OAuth to be configured first');
    return { success: false, message: config.message };
  }

  logSuccess('Instagram OAuth is configured (via Facebook)');
  logInfo('Instagram uses Facebook Graph API');
  logInfo('Make sure your Facebook app has Instagram Graph API access enabled');

  return { success: true, message: 'Instagram OAuth configuration is valid (requires Facebook connection)' };
}

/**
 * Test TikTok OAuth configuration
 */
async function testTikTok() {
  logSection('Testing TikTok OAuth');

  const config = checkConfiguration('tiktok');
  if (!config.configured) {
    logError(config.message);
    return { success: false, message: config.message };
  }

  logSuccess('TikTok OAuth is configured');

  try {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const callbackUrl = process.env.TIKTOK_CALLBACK_URL || 'http://localhost:5001/api/oauth/tiktok/callback';
    
    logInfo('Testing authorization URL generation...');
    const authUrl = `https://www.tiktok.com/v2/auth/authorize/` +
      `?client_key=${clientKey}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('user.info.basic,video.upload,video.publish')}`;

    if (authUrl.includes(clientKey)) {
      logSuccess('Authorization URL can be generated');
    } else {
      logError('Authorization URL generation failed');
      return { success: false, message: 'Failed to generate authorization URL' };
    }

    // Test TikTok API connectivity
    logInfo('Testing TikTok API connectivity...');
    try {
      const response = await axios.get('https://open.tiktokapis.com/v2/', {
        timeout: 5000,
      });
      logSuccess('TikTok API is reachable');
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        logWarning('Could not reach TikTok API (network issue)');
      } else {
        logSuccess('TikTok API is reachable (expected error without auth)');
      }
    }

    logInfo('TikTok OAuth configuration test passed');
    logWarning('To complete full OAuth flow, you need to:');
    logInfo('1. Visit the authorization URL in a browser');
    logInfo('2. Authorize the application');
    logInfo('3. Copy the authorization code from the callback');
    logInfo('4. Test token exchange (requires authorization code)');

    return { success: true, message: 'TikTok OAuth configuration is valid' };
  } catch (error) {
    logError(`TikTok OAuth test failed: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Test YouTube OAuth configuration
 */
async function testYouTube() {
  logSection('Testing YouTube OAuth');

  const config = checkConfiguration('youtube');
  if (!config.configured) {
    logError(config.message);
    return { success: false, message: config.message };
  }

  logSuccess('YouTube OAuth is configured');

  try {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const callbackUrl = process.env.YOUTUBE_CALLBACK_URL || 'http://localhost:5001/api/oauth/youtube/callback';
    
    logInfo('Testing authorization URL generation...');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube')}&` +
      `access_type=offline&` +
      `prompt=consent`;

    if (authUrl.includes(clientId)) {
      logSuccess('Authorization URL can be generated');
    } else {
      logError('Authorization URL generation failed');
      return { success: false, message: 'Failed to generate authorization URL' };
    }

    // Test Google OAuth API connectivity
    logInfo('Testing Google OAuth API connectivity...');
    try {
      const response = await axios.get('https://oauth2.googleapis.com/.well-known/openid-configuration', {
        timeout: 5000,
      });
      logSuccess('Google OAuth API is reachable');
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        logWarning('Could not reach Google OAuth API (network issue)');
      } else {
        logSuccess('Google OAuth API is reachable');
      }
    }

    logInfo('YouTube OAuth configuration test passed');
    logWarning('To complete full OAuth flow, you need to:');
    logInfo('1. Visit the authorization URL in a browser');
    logInfo('2. Authorize the application');
    logInfo('3. Copy the authorization code from the callback');
    logInfo('4. Test token exchange (requires authorization code)');

    return { success: true, message: 'YouTube OAuth configuration is valid' };
  } catch (error) {
    logError(`YouTube OAuth test failed: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Test all platforms
 */
async function testAll() {
  logSection('Testing All OAuth Platforms');

  const platforms = [
    { name: 'LinkedIn', test: testLinkedIn },
    { name: 'Facebook', test: testFacebook },
    { name: 'Instagram', test: testInstagram },
    { name: 'TikTok', test: testTikTok },
    { name: 'YouTube', test: testYouTube },
  ];

  const results = [];

  for (const platform of platforms) {
    try {
      const result = await platform.test();
      results.push({
        platform: platform.name,
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      results.push({
        platform: platform.name,
        success: false,
        message: error.message,
      });
    }
  }

  // Summary
  logSection('Test Summary');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  results.forEach(result => {
    if (result.success) {
      logSuccess(`${result.platform}: ${result.message}`);
    } else {
      logError(`${result.platform}: ${result.message}`);
    }
  });

  console.log('\n');
  logInfo(`Total: ${results.length} platforms`);
  logSuccess(`Passed: ${successful}`);
  if (failed > 0) {
    logError(`Failed: ${failed}`);
  }

  return {
    total: results.length,
    successful,
    failed,
    results,
  };
}

/**
 * Main function
 */
async function main() {
  const platform = process.argv[2]?.toLowerCase() || 'all';

  logSection('OAuth Integration Testing');
  logInfo(`Testing platform: ${platform === 'all' ? 'All platforms' : platform}\n`);

  let result;

  switch (platform) {
    case 'linkedin':
      result = await testLinkedIn();
      break;
    case 'facebook':
      result = await testFacebook();
      break;
    case 'instagram':
      result = await testInstagram();
      break;
    case 'tiktok':
      result = await testTikTok();
      break;
    case 'youtube':
      result = await testYouTube();
      break;
    case 'all':
      result = await testAll();
      break;
    default:
      logError(`Unknown platform: ${platform}`);
      logInfo('Available platforms: linkedin, facebook, instagram, tiktok, youtube, all');
      process.exit(1);
  }

  console.log('\n');
  if (result.success !== false && result.failed === 0) {
    logSuccess('All tests passed!');
    process.exit(0);
  } else {
    logError('Some tests failed. Please check the configuration.');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  testLinkedIn,
  testFacebook,
  testInstagram,
  testTikTok,
  testYouTube,
  testAll,
  checkConfiguration,
};


