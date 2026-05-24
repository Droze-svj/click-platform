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
  OAUTH_ENCRYPTION_KEY: {
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

  // Google AI Studio (Gemini) — gates niche-aware AI generation, trend
  // reports, captions, and auto-edit. Without it everything falls back
  // to mock data. Variable name is GOOGLE_AI_API_KEY (not GEMINI_API_KEY)
  // — see server/utils/googleAI.js.
  GOOGLE_AI_API_KEY: {
    validate: (val) => val.length > 20,
    message: 'Required for AI-driven trend reports / auto-edit / captions. Get one at https://aistudio.google.com/apikey'
  },

  // Supabase — analytics endpoints (creator stats, performance global) read
  // from Supabase. Without these they gracefully degrade to empty data
  // (post PR #4) but you lose the analytics surface.
  SUPABASE_URL: {
    validate: (val) => val.startsWith('https://') && val.includes('.supabase.co'),
    message: 'Should be your Supabase project URL (https://<project>.supabase.co)'
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    validate: (val) => val.length > 40,
    message: 'Service role key from Supabase Settings → API'
  },

  // Platform OAuth — without these, social-posting routes fall back to
  // dev-token mock and never actually publish. Var names match what the
  // OAuth services in server/services/*OAuthService.js actually read.
  TWITTER_CLIENT_ID: {
    validate: (val) => val.length > 0,
    message: 'Required to post to X/Twitter (Twitter Developer Portal → OAuth 2.0 settings)'
  },
  TWITTER_CLIENT_SECRET: {
    validate: (val) => val.length > 0,
    message: 'Required to post to X/Twitter'
  },
  YOUTUBE_CLIENT_ID: {
    validate: (val) => val.length > 0,
    message: 'Required to upload to YouTube (Google Cloud Console → APIs & Services → Credentials)'
  },
  YOUTUBE_CLIENT_SECRET: {
    validate: (val) => val.length > 0,
    message: 'Required to upload to YouTube'
  },
  LINKEDIN_CLIENT_ID: {
    validate: (val) => val.length > 0,
    message: 'Required to post to LinkedIn'
  },
  LINKEDIN_CLIENT_SECRET: {
    validate: (val) => val.length > 0,
    message: 'Required to post to LinkedIn'
  },
  TIKTOK_CLIENT_KEY: {
    validate: (val) => val.length > 0,
    message: 'Required to post to TikTok (TikTok for Developers)'
  },
  TIKTOK_CLIENT_SECRET: {
    validate: (val) => val.length > 0,
    message: 'Required to post to TikTok'
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

  // Whop Subscription Integration (14 critical values)
  WHOP_API_KEY: {
    validate: (val) => val.startsWith('apik_') && val.length > 20,
    message: 'Required for Whop API calls. Get from Whop Dashboard -> Developer Settings.'
  },
  WHOP_WEBHOOK_SECRET: {
    validate: (val) => val.length > 10,
    message: 'Required to verify Whop webhooks. Get from Whop Dashboard -> Webhooks.'
  },
  WHOP_PRODUCT_ID_CREATOR_MONTHLY: {
    validate: (val) => val.startsWith('prod_'),
    message: 'Required for Creator Monthly plan routing.'
  },
  WHOP_PRODUCT_ID_CREATOR_YEARLY: {
    validate: (val) => val.startsWith('prod_'),
    message: 'Required for Creator Yearly plan routing.'
  },
  WHOP_PRODUCT_ID_PRO_MONTHLY: {
    validate: (val) => val.startsWith('prod_'),
    message: 'Required for Pro Monthly plan routing.'
  },
  WHOP_PRODUCT_ID_PRO_YEARLY: {
    validate: (val) => val.startsWith('prod_'),
    message: 'Required for Pro Yearly plan routing.'
  },
  WHOP_PRODUCT_ID_AGENCY_MONTHLY: {
    validate: (val) => val.startsWith('prod_'),
    message: 'Required for Agency Monthly plan routing.'
  },
  WHOP_PRODUCT_ID_AGENCY_YEARLY: {
    validate: (val) => val.startsWith('prod_'),
    message: 'Required for Agency Yearly plan routing.'
  },
  NEXT_PUBLIC_WHOP_URL_CREATOR_MONTHLY: {
    validate: (val) => val.startsWith('https://'),
    message: 'Hosted checkout URL for Creator Monthly.'
  },
  NEXT_PUBLIC_WHOP_URL_CREATOR_YEARLY: {
    validate: (val) => val.startsWith('https://'),
    message: 'Hosted checkout URL for Creator Yearly.'
  },
  NEXT_PUBLIC_WHOP_URL_PRO_MONTHLY: {
    validate: (val) => val.startsWith('https://'),
    message: 'Hosted checkout URL for Pro Monthly.'
  },
  NEXT_PUBLIC_WHOP_URL_PRO_YEARLY: {
    validate: (val) => val.startsWith('https://'),
    message: 'Hosted checkout URL for Pro Yearly.'
  },
  NEXT_PUBLIC_WHOP_URL_AGENCY_MONTHLY: {
    validate: (val) => val.startsWith('https://'),
    message: 'Hosted checkout URL for Agency Monthly.'
  },
  NEXT_PUBLIC_WHOP_URL_AGENCY_YEARLY: {
    validate: (val) => val.startsWith('https://'),
    message: 'Hosted checkout URL for Agency Yearly.'
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

/**
 * Detect obvious placeholder values that pass length / format checks but
 * are clearly not real credentials. The previous verifier returned ✅ for
 * values like "your-twitter-client-id" or "SG.placeholder_..." — which
 * meant `npm run verify:production:env` reported "all good" right before
 * a deploy that would 401 on every OAuth handshake. This catches those.
 *
 * Returns the matched placeholder pattern (string) if value is a
 * placeholder, otherwise null.
 */
const PLACEHOLDER_PATTERNS = [
  /^your[-_]/i,
  /placeholder/i,
  /change[-_]?(me|this)/i,
  /^(xxx|yyy|zzz)/i,
  /^example[-_]/i,
  /must[-_]be[-_]real/i,
  /^todo$/i,
  /^prod_[a-z_]+_(monthly|yearly)$/i,   // e.g. prod_creator_monthly (fake Whop product ids)
  /^https?:\/\/whop\.com\/checkout\/(creator|pro|agency)-(monthly|yearly)$/i, // fake Whop URLs from .env.production template
  /^sk-(test|fake|placeholder)/i,
  /^sg\.placeholder/i,
  /^apik_placeholder/i,
  /default[-_]secret/i,
  /^test[-_]?(client|key|secret|id)$/i,
];

function detectPlaceholder(value) {
  if (!value || typeof value !== 'string') return null;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(value)) return pattern.toString();
  }
  return null;
}

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

    // Catch placeholder values that pass length / format checks but are
    // clearly the .env.example template strings (the previous verifier
    // approved "your-twitter-client-id" and "prod_creator_monthly" as ✅).
    const placeholderMatch = detectPlaceholder(value);
    if (placeholderMatch) {
      errors.push(`❌ ${varName}: Placeholder value detected ("${value}" matches ${placeholderMatch}) — replace with the real credential from the provider's dev console`);
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

    // Placeholder check (same logic as required vars, but emits a warning
    // instead of an error since these are not strictly required).
    const placeholderMatch = detectPlaceholder(value);
    if (placeholderMatch) {
      warnings.push(`⚠️  ${varName}: Placeholder value ("${value}") — replace with the real credential`);
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
  
  // Count placeholders among warnings — these aren't optional like Sentry
  // or GA; they're real production blockers (SendGrid placeholder = no
  // emails sent; Whop product placeholders = no plan upgrades happen).
  // We separate the "truly recommended but missing" case from the
  // "placeholder value that will silently break the feature" case.
  const placeholderWarnings = warnings.filter((w) => /Placeholder value/.test(w));
  const purelyOptional = warnings.length - placeholderWarnings.length;

  const allPass = errors.length === 0 && securityIssues.length === 0 && placeholderWarnings.length === 0;

  if (allPass) {
    console.log('\n✅ All required variables are set correctly!');
    if (warnings.length === 0) {
      console.log('✅ All recommended variables are set!');
    } else {
      console.log(`⚠️  ${warnings.length} recommended variable(s) missing (non-critical)`);
    }
  } else {
    console.log('\n❌ Verification failed.');
    if (placeholderWarnings.length > 0) {
      console.log(`   🔴 ${placeholderWarnings.length} placeholder value(s) detected — replace with real credentials before deploy:`);
      for (const w of placeholderWarnings) {
        console.log('     ' + w.replace(/^[⚠️  ]+/u, ''));
      }
    }
    if (errors.length > 0) {
      console.log(`   ❌ ${errors.length} required variable(s) missing or invalid`);
    }
    if (securityIssues.length > 0) {
      console.log(`   🔴 ${securityIssues.length} security issue(s)`);
    }
    if (purelyOptional > 0) {
      console.log(`   ⚠️  ${purelyOptional} purely-optional variable(s) missing (non-blocking)`);
    }
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



