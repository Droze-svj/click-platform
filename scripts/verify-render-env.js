#!/usr/bin/env node

/**
 * Verify Render.com Environment Variables
 * 
 * This script helps verify that all required environment variables
 * are properly configured. Run this locally to check your .env file,
 * or use it as a reference for Render.com setup.
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
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

// Expected environment variables
const requiredVars = {
  'NODE_ENV': {
    value: 'production',
    description: 'Server environment',
    required: true,
  },
  'PORT': {
    value: '5001 (or auto-assigned)',
    description: 'Server port',
    required: false, // Render.com can auto-assign
  },
  'MONGODB_URI': {
    value: 'mongodb+srv://...',
    description: 'MongoDB connection string',
    required: true,
    format: 'mongodb+srv://',
  },
  'JWT_SECRET': {
    value: '[long random string]',
    description: 'JWT secret key',
    required: true,
    minLength: 32,
  },
};

const optionalVars = {
  'SENDGRID_API_KEY': {
    value: 'SG.xxxxxxxxx',
    description: 'SendGrid API key',
    format: 'SG.',
    status: '✅ Configured',
  },
  'SENDGRID_FROM_EMAIL': {
    value: '[verified email]',
    description: 'SendGrid sender email',
    status: '✅ Configured',
  },
  'CLOUDINARY_CLOUD_NAME': {
    value: 'dq3qhgdky',
    description: 'Cloudinary cloud name',
    status: '✅ Configured',
  },
  'CLOUDINARY_API_KEY': {
    value: '669778257786928',
    description: 'Cloudinary API key',
    status: '✅ Configured',
  },
  'CLOUDINARY_API_SECRET': {
    value: 'GvjJYi0TC-KkdycaDuuDD3L4D2w',
    description: 'Cloudinary API secret',
    status: '✅ Configured',
  },
  'REDIS_URL': {
    value: 'redis://default:password@host:port',
    description: 'Redis connection string',
    format: 'redis://',
    expected: 'redis://default:NjVtJYF66oFrxmRDf6ebOinB7Rdavz9t@redis-10560.c270.us-east-1-3.ec2.cloud.redislabs.com:10560',
    status: '⏳ Needs verification',
  },
  'SENTRY_DSN': {
    value: 'https://...',
    description: 'Sentry DSN',
    format: 'https://',
    status: '⏳ Optional',
  },
  'YOUTUBE_CLIENT_ID': {
    value: '[your client ID]',
    description: 'YouTube OAuth client ID',
    status: '✅ Configured',
  },
  'YOUTUBE_CLIENT_SECRET': {
    value: '[your client secret]',
    description: 'YouTube OAuth client secret',
    status: '✅ Configured',
  },
  'YOUTUBE_CALLBACK_URL': {
    value: 'https://your-app.onrender.com/api/oauth/youtube/callback',
    description: 'YouTube OAuth callback URL',
    status: '✅ Configured',
  },
};

// Load .env file if it exists
const envPath = path.join(__dirname, '../../.env');
let envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}

log('\n📋 Render.com Environment Variables Verification\n', 'cyan');
log('=' .repeat(60), 'cyan');

// Check required variables
log('\n✅ REQUIRED VARIABLES:', 'yellow');
log('-'.repeat(60), 'yellow');

let allRequiredPresent = true;
Object.entries(requiredVars).forEach(([key, config]) => {
  const value = envVars[key] || process.env[key];
  const present = !!value;
  
  if (config.required && !present) {
    log(`❌ ${key}: MISSING`, 'red');
    log(`   Description: ${config.description}`, 'red');
    log(`   Expected: ${config.value}`, 'red');
    allRequiredPresent = false;
  } else if (present) {
    // Validate format if specified
    let isValid = true;
    if (config.format && !value.startsWith(config.format)) {
      log(`⚠️  ${key}: WRONG FORMAT`, 'yellow');
      log(`   Current: ${value.substring(0, 50)}...`, 'yellow');
      log(`   Should start with: ${config.format}`, 'yellow');
      isValid = false;
    }
    
    if (config.minLength && value.length < config.minLength) {
      log(`⚠️  ${key}: TOO SHORT`, 'yellow');
      log(`   Should be at least ${config.minLength} characters`, 'yellow');
      isValid = false;
    }
    
    if (isValid) {
      log(`✅ ${key}: SET`, 'green');
      if (key === 'JWT_SECRET') {
        log(`   Length: ${value.length} characters`, 'green');
      }
    }
  } else if (!config.required) {
    log(`⏭️  ${key}: OPTIONAL`, 'blue');
  }
});

// Check optional variables
log('\n📦 OPTIONAL VARIABLES:', 'yellow');
log('-'.repeat(60), 'yellow');

Object.entries(optionalVars).forEach(([key, config]) => {
  const value = envVars[key] || process.env[key];
  const present = !!value;
  
  if (present) {
    // Validate format if specified
    let isValid = true;
    if (config.format && !value.startsWith(config.format)) {
      log(`⚠️  ${key}: WRONG FORMAT`, 'yellow');
      log(`   Should start with: ${config.format}`, 'yellow');
      isValid = false;
    }
    
    if (isValid) {
      log(`✅ ${key}: SET ${config.status || ''}`, 'green');
      if (config.expected && value !== config.expected) {
        log(`   ⚠️  Value doesn't match expected`, 'yellow');
      }
    }
  } else {
    const status = config.status || 'Not configured';
    log(`⏭️  ${key}: ${status}`, 'blue');
  }
});

// Summary
log('\n📊 SUMMARY:', 'cyan');
log('='.repeat(60), 'cyan');

if (allRequiredPresent) {
  log('✅ All required variables are present', 'green');
} else {
  log('❌ Some required variables are missing', 'red');
  log('   Add missing variables to Render.com environment', 'red');
}

log('\n📝 NEXT STEPS:', 'cyan');
log('1. Go to Render.com → Your service → Environment tab', 'blue');
log('2. Verify all variables listed above are present', 'blue');
log('3. Check variable names are exact (case-sensitive)', 'blue');
log('4. Check variable values are complete', 'blue');
log('5. Redeploy service after adding variables', 'blue');
log('6. Check logs for service initialization', 'blue');

log('\n🔗 Quick Links:', 'cyan');
log('- Render.com Dashboard: https://dashboard.render.com/', 'blue');
log('- SendGrid Dashboard: https://app.sendgrid.com/', 'blue');
log('- Cloudinary Dashboard: https://cloudinary.com/console', 'blue');
log('- Redis Cloud: https://redis.com/redis-enterprise-cloud/', 'blue');

log('\n');

