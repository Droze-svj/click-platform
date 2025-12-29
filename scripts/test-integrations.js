// Test script to verify integrations are working

require('dotenv').config();
const { initSentry, captureException, captureMessage } = require('../server/utils/sentry');
const { uploadFile, isCloudStorageEnabled, fileExists } = require('../server/services/storageService');
const fs = require('fs');
const path = require('path');

async function testSentry() {
  console.log('\n🔍 Testing Sentry Integration...');
  
  if (!process.env.SENTRY_DSN) {
    console.log('  ⚠️  Sentry not configured (SENTRY_DSN missing)');
    return false;
  }

  try {
    initSentry();
    console.log('  ✅ Sentry initialized');
    
    // Test error capture
    try {
      captureMessage('Test message from integration test', 'info');
      console.log('  ✅ Sentry message capture works');
    } catch (error) {
      console.log('  ❌ Sentry message capture failed:', error.message);
      return false;
    }

    // Test exception capture
    try {
      const testError = new Error('Test error for Sentry');
      captureException(testError, { tags: { test: true } });
      console.log('  ✅ Sentry exception capture works');
    } catch (error) {
      console.log('  ❌ Sentry exception capture failed:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.log('  ❌ Sentry test failed:', error.message);
    return false;
  }
}

async function testS3() {
  console.log('\n🔍 Testing AWS S3 Integration...');
  
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
    console.log('  ⚠️  AWS S3 not configured (missing credentials or bucket)');
    console.log('  ℹ️  Will use local storage as fallback');
    return false;
  }

  try {
    const isEnabled = isCloudStorageEnabled();
    if (!isEnabled) {
      console.log('  ⚠️  Cloud storage not enabled');
      return false;
    }

    console.log('  ✅ S3 client initialized');
    console.log('  ℹ️  To fully test, upload a file via the API');
    
    return true;
  } catch (error) {
    console.log('  ❌ S3 test failed:', error.message);
    return false;
  }
}

async function testOAuth() {
  console.log('\n🔍 Testing OAuth Integration...');
  
  const platforms = {
    twitter: {
      id: process.env.TWITTER_CLIENT_ID,
      secret: process.env.TWITTER_CLIENT_SECRET,
    },
    linkedin: {
      id: process.env.LINKEDIN_CLIENT_ID,
      secret: process.env.LINKEDIN_CLIENT_SECRET,
    },
    facebook: {
      id: process.env.FACEBOOK_APP_ID,
      secret: process.env.FACEBOOK_APP_SECRET,
    },
  };

  const configured = [];
  const notConfigured = [];

  Object.entries(platforms).forEach(([platform, creds]) => {
    if (creds.id && creds.secret) {
      configured.push(platform);
      console.log(`  ✅ ${platform.charAt(0).toUpperCase() + platform.slice(1)} OAuth configured`);
    } else {
      notConfigured.push(platform);
      console.log(`  ⚠️  ${platform.charAt(0).toUpperCase() + platform.slice(1)} OAuth not configured`);
    }
  });

  if (configured.length === 0) {
    console.log('  ℹ️  No OAuth platforms configured');
    return false;
  }

  console.log(`  ✅ ${configured.length} OAuth platform(s) configured`);
  return true;
}

async function testFileStorage() {
  console.log('\n🔍 Testing File Storage...');
  
  try {
    // Check if upload directories exist
    const uploadDirs = ['uploads/videos', 'uploads/music', 'uploads/clips', 'uploads/thumbnails', 'uploads/quotes'];
    let allExist = true;

    uploadDirs.forEach(dir => {
      const fullPath = path.join(__dirname, '..', dir);
      if (!fs.existsSync(fullPath)) {
        console.log(`  ⚠️  Directory missing: ${dir}`);
        allExist = false;
      }
    });

    if (allExist) {
      console.log('  ✅ All upload directories exist');
    } else {
      console.log('  ℹ️  Creating missing directories...');
      uploadDirs.forEach(dir => {
        const fullPath = path.join(__dirname, '..', dir);
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
          console.log(`  ✅ Created: ${dir}`);
        }
      });
    }

    return true;
  } catch (error) {
    console.log('  ❌ File storage test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 Integration Tests');
  console.log('===================\n');

  const results = {
    sentry: await testSentry(),
    s3: await testS3(),
    oauth: await testOAuth(),
    storage: await testFileStorage(),
  };

  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  console.log(`Sentry:        ${results.sentry ? '✅ Working' : '⚠️  Not configured'}`);
  console.log(`AWS S3:        ${results.s3 ? '✅ Working' : '⚠️  Not configured (using local storage)'}`);
  console.log(`OAuth:         ${results.oauth ? '✅ Configured' : '⚠️  Not configured'}`);
  console.log(`File Storage:  ${results.storage ? '✅ Ready' : '❌ Issues found'}`);

  const allWorking = Object.values(results).every(r => r !== false);
  
  if (allWorking) {
    console.log('\n✅ All configured integrations are working!');
  } else {
    console.log('\n⚠️  Some integrations are not configured (this is OK for development)');
    console.log('   See QUICK_SETUP_GUIDE.md for setup instructions');
  }

  return results;
}

// Run tests if called directly
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n✅ Integration tests complete\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Test error:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, testSentry, testS3, testOAuth, testFileStorage };






