#!/usr/bin/env node

/**
 * Production Environment Validation
 * Validates all required environment variables are set
 */

const fs = require('fs');
const path = require('path');

const required = {
  // Critical
  MONGODB_URI: 'MongoDB connection string',
  JWT_SECRET: 'JWT secret key for token signing',
  NODE_ENV: 'Node environment (should be "production")',
  
  // Important
  FRONTEND_URL: 'Frontend URL (for CORS and redirects)',
  PORT: 'Server port (default: 5001)',
};

const recommended = {
  AWS_ACCESS_KEY_ID: 'AWS access key for S3 storage',
  AWS_SECRET_ACCESS_KEY: 'AWS secret key',
  AWS_S3_BUCKET: 'S3 bucket name',
  REDIS_URL: 'Redis connection URL for caching',
  SENTRY_DSN: 'Sentry DSN for error tracking',
  TWITTER_CLIENT_ID: 'Twitter OAuth client ID',
  TWITTER_CLIENT_SECRET: 'Twitter OAuth secret',
  LINKEDIN_CLIENT_ID: 'LinkedIn OAuth client ID',
  LINKEDIN_CLIENT_SECRET: 'LinkedIn OAuth secret',
  FACEBOOK_APP_ID: 'Facebook OAuth app ID',
  FACEBOOK_APP_SECRET: 'Facebook OAuth secret',
};

function validateEnvironment() {
  console.log('🔍 Validating production environment...\n');
  
  const envFile = path.join(__dirname, '../.env.production');
  let envVars = {};
  
  // Load .env.production if it exists
  if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        envVars[match[1].trim()] = match[2].trim();
      }
    });
  }
  
  // Also check process.env (for runtime validation)
  Object.keys(process.env).forEach(key => {
    if (!envVars[key]) {
      envVars[key] = process.env[key];
    }
  });
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // Check required variables
  console.log('📋 Required Variables:');
  Object.keys(required).forEach(key => {
    if (!envVars[key] || envVars[key].trim() === '') {
      console.log(`  ❌ ${key}: ${required[key]} - MISSING`);
      hasErrors = true;
    } else {
      // Validate specific values
      if (key === 'NODE_ENV' && envVars[key] !== 'production') {
        console.log(`  ⚠️  ${key}: Should be "production", got "${envVars[key]}"`);
        hasWarnings = true;
      } else if (key === 'JWT_SECRET' && envVars[key].length < 32) {
        console.log(`  ⚠️  ${key}: Should be at least 32 characters for security`);
        hasWarnings = true;
      } else if (key === 'MONGODB_URI' && !envVars[key].startsWith('mongodb://') && !envVars[key].startsWith('mongodb+srv://')) {
        console.log(`  ⚠️  ${key}: Should start with mongodb:// or mongodb+srv://`);
        hasWarnings = true;
      } else {
        console.log(`  ✅ ${key}: Set`);
      }
    }
  });
  
  console.log('\n📋 Recommended Variables:');
  Object.keys(recommended).forEach(key => {
    if (!envVars[key] || envVars[key].trim() === '') {
      console.log(`  ⚠️  ${key}: ${recommended[key]} - Not set (optional)`);
      hasWarnings = true;
    } else {
      console.log(`  ✅ ${key}: Set`);
    }
  });
  
  console.log('');
  
  if (hasErrors) {
    console.error('❌ Validation failed! Please set all required variables.');
    process.exit(1);
  }
  
  if (hasWarnings) {
    console.warn('⚠️  Some recommended variables are missing. Application may have limited functionality.');
  } else {
    console.log('✅ All validations passed!');
  }
  
  // Additional checks
  console.log('\n🔒 Security Checks:');
  
  // Check JWT secret strength
  if (envVars.JWT_SECRET && envVars.JWT_SECRET.length >= 32) {
    console.log('  ✅ JWT_SECRET is sufficiently long');
  } else {
    console.log('  ⚠️  JWT_SECRET should be at least 32 characters');
  }
  
  // Check if using HTTPS
  if (envVars.FRONTEND_URL && envVars.FRONTEND_URL.startsWith('https://')) {
    console.log('  ✅ FRONTEND_URL uses HTTPS');
  } else {
    console.log('  ⚠️  FRONTEND_URL should use HTTPS in production');
  }
  
  // Check MongoDB connection
  if (envVars.MONGODB_URI) {
    if (envVars.MONGODB_URI.includes('localhost') || envVars.MONGODB_URI.includes('127.0.0.1')) {
      console.log('  ⚠️  Using local MongoDB - ensure it\'s properly secured');
    } else {
      console.log('  ✅ Using remote MongoDB (Atlas or similar)');
    }
  }
  
  console.log('\n✅ Environment validation complete!');
}

// Run validation
validateEnvironment();



