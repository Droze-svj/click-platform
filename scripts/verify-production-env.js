#!/usr/bin/env node

/**
 * Production Environment Variables Verification Script
 * 
 * Verifies that all required environment variables for production are set correctly.
 * This script checks for required variables, validates formats, and warns about
 * missing optional but recommended variables.
 */

const fs = require('fs');
const path = require('path');

// Required environment variables for production
const REQUIRED_VARS = {
  // Backend
  NODE_ENV: { 
    required: true, 
    validate: (val) => val === 'production',
    message: 'Must be set to "production"'
  },
  PORT: { 
    required: true, 
    validate: (val) => !isNaN(parseInt(val)) && parseInt(val) > 0 && parseInt(val) < 65536,
    message: 'Must be a valid port number (1-65535)'
  },
  MONGODB_URI: { 
    required: true, 
    validate: (val) => val.startsWith('mongodb://') || val.startsWith('mongodb+srv://'),
    message: 'Must be a valid MongoDB connection string'
  },
  JWT_SECRET: { 
    required: true, 
    validate: (val) => val.length >= 32,
    message: 'Must be at least 32 characters long for security'
  },
  
  // Frontend (NEXT_PUBLIC_*)
  NEXT_PUBLIC_API_URL: { 
    required: true, 
    validate: (val) => {
      try {
        const url = new URL(val);
        return (url.protocol === 'https:' || url.protocol === 'http:');
      } catch {
        return false;
      }
    },
    message: 'Must be a valid URL (preferably https://)'
  },
};

// Optional but recommended variables
const RECOMMENDED_VARS = {
  // Redis
  REDIS_URL: {
    validate: (val) => val.startsWith('redis://') || val.startsWith('rediss://'),
    message: 'Should be a valid Redis connection string'
  },
  
  // AWS S3
  AWS_ACCESS_KEY_ID: {
    validate: (val) => val.length > 0,
    message: 'Required for file storage'
  },
  AWS_SECRET_ACCESS_KEY: {
    validate: (val) => val.length > 0,
    message: 'Required for file storage'
  },
  AWS_S3_BUCKET: {
    validate: (val) => val.length > 0,
    message: 'Required for file storage'
  },
  AWS_REGION: {
    validate: (val) => val.length > 0,
    message: 'Required for AWS services'
  },
  
  // OpenAI
  OPENAI_API_KEY: {
    validate: (val) => val.startsWith('sk-') && val.length > 20,
    message: 'Should be a valid OpenAI API key (starts with sk-)'
  },
  
  // Sentry
  NEXT_PUBLIC_SENTRY_DSN: {
    validate: (val) => val.startsWith('https://'),
    message: 'Should be a valid Sentry DSN URL'
  },
  SENTRY_ORG: {
    validate: (val) => val.length > 0,
    message: 'Required for Sentry source map uploads'
  },
  SENTRY_PROJECT: {
    validate: (val) => val.length > 0,
    message: 'Required for Sentry source map uploads'
  },
  
  // Analytics
  NEXT_PUBLIC_GA_MEASUREMENT_ID: {
    validate: (val) => val.startsWith('G-') || val.startsWith('UA-'),
    message: 'Should be a valid Google Analytics Measurement ID'
  },
  
  // Email (SendGrid - if implemented)
  SENDGRID_API_KEY: {
    validate: (val) => val.startsWith('SG.') && val.length > 20,
    message: 'Should be a valid SendGrid API key (starts with SG.)'
  },
};

// Security checks
const SECURITY_CHECKS = {
  JWT_SECRET_STRENGTH: {
    check: (env) => {
      const secret = env.JWT_SECRET;
      if (!secret) return { pass: false, message: 'JWT_SECRET not set' };
      if (secret.length < 32) return { pass: false, message: 'JWT_SECRET too short (minimum 32 characters)' };
      if (secret === 'your-secret-key' || secret === 'change-me') return { pass: false, message: 'JWT_SECRET appears to be a default/placeholder value' };
      return { pass: true };
    }
  },
  PRODUCTION_NODE_ENV: {
    check: (env) => {
      if (env.NODE_ENV !== 'production') {
        return { pass: false, message: 'NODE_ENV must be set to "production" in production environment' };
      }
      return { pass: true };
    }
  },
  HTTPS_URL: {
    check: (env) => {
      const apiUrl = env.NEXT_PUBLIC_API_URL;
      if (apiUrl && apiUrl.startsWith('http://') && !apiUrl.includes('localhost')) {
        return { pass: false, message: 'NEXT_PUBLIC_API_URL should use HTTPS in production (not http://)' };
      }
      return { pass: true };
    }
  },
  SECURE_MONGODB: {
    check: (env) => {
      const mongoUri = env.MONGODB_URI;
      if (mongoUri && mongoUri.startsWith('mongodb://') && !mongoUri.includes('localhost')) {
        return { pass: false, message: 'MONGODB_URI should use mongodb+srv:// (with TLS) in production' };
      }
      return { pass: true };
    }
  },
};

function loadEnvFile(filePath) {
  const env = {};
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      env[key] = value;
    }
  }
  
  return env;
}

function verifyEnvironment() {
  console.log('🔍 Verifying Production Environment Variables...\n');
  
  // Try to load from .env.production first, then .env
  let env = loadEnvFile(path.join(process.cwd(), '.env.production')) ||
            loadEnvFile(path.join(process.cwd(), '.env')) ||
            process.env;
  
  // Also load from process.env (for CI/CD environments)
  env = { ...env, ...process.env };
  
  const errors = [];
  const warnings = [];
  const securityIssues = [];
  
  // Check required variables
  console.log('📋 Checking Required Variables...');
  for (const [varName, config] of Object.entries(REQUIRED_VARS)) {
    const value = env[varName];
    
    if (!value) {
      errors.push(`❌ ${varName}: Missing (required)`);
      continue;
    }
    
    if (config.validate && !config.validate(value)) {
      errors.push(`❌ ${varName}: Invalid - ${config.message}`);
      continue;
    }
    
    // Mask sensitive values for display
    const displayValue = varName.includes('SECRET') || varName.includes('KEY') || varName.includes('PASSWORD')
      ? '***' + value.slice(-4)
      : value;
    console.log(`✅ ${varName}: ${displayValue}`);
  }
  
  // Check recommended variables
  console.log('\n📋 Checking Recommended Variables...');
  for (const [varName, config] of Object.entries(RECOMMENDED_VARS)) {
    const value = env[varName];
    
    if (!value) {
      warnings.push(`⚠️  ${varName}: Not set (recommended)`);
      continue;
    }
    
    if (config.validate && !config.validate(value)) {
      warnings.push(`⚠️  ${varName}: Invalid - ${config.message}`);
      continue;
    }
    
    // Mask sensitive values
    const displayValue = varName.includes('SECRET') || varName.includes('KEY') || varName.includes('PASSWORD')
      ? '***' + value.slice(-4)
      : value;
    console.log(`✅ ${varName}: ${displayValue}`);
  }
  
  // Security checks
  console.log('\n🔒 Running Security Checks...');
  for (const [checkName, check] of Object.entries(SECURITY_CHECKS)) {
    const result = check.check(env);
    if (!result.pass) {
      securityIssues.push(`🔴 ${checkName}: ${result.message}`);
    } else {
      console.log(`✅ ${checkName}: Pass`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  
  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length}):`);
    errors.forEach(err => console.log(`   ${err}`));
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${warnings.length}):`);
    warnings.forEach(warn => console.log(`   ${warn}`));
  }
  
  if (securityIssues.length > 0) {
    console.log(`\n🔴 Security Issues (${securityIssues.length}):`);
    securityIssues.forEach(issue => console.log(`   ${issue}`));
  }
  
  const allPass = errors.length === 0 && securityIssues.length === 0;
  
  if (allPass) {
    console.log('\n✅ All required variables are set correctly!');
    if (warnings.length === 0) {
      console.log('✅ All recommended variables are set!');
    } else {
      console.log(`⚠️  ${warnings.length} recommended variable(s) missing (non-critical)`);
    }
  } else {
    console.log('\n❌ Verification failed. Please fix the errors above.');
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(60));
  
  return allPass;
}

// Run verification
if (require.main === module) {
  verifyEnvironment();
}

module.exports = { verifyEnvironment, REQUIRED_VARS, RECOMMENDED_VARS, SECURITY_CHECKS };



