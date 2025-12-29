// Validate Staging Environment Variables
// Usage: node scripts/validate-staging-env.js

require('dotenv').config({ path: '.env.staging' });

const requiredVars = [
  'NODE_ENV',
  'PORT',
  'MONGODB_URI',
  'JWT_SECRET',
  'FRONTEND_URL'
];

const optionalVars = [
  'REDIS_URL',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET',
  'SENTRY_DSN',
  'OPENAI_API_KEY',
  'TWITTER_CLIENT_ID',
  'LINKEDIN_CLIENT_ID',
  'FACEBOOK_APP_ID'
];

console.log('🔍 Validating staging environment variables...\n');

let hasErrors = false;
let hasWarnings = false;

// Check required variables
console.log('Required variables:');
requiredVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`  ❌ ${varName} is missing`);
    hasErrors = true;
  } else {
    // Check for placeholder values
    if (process.env[varName].includes('your-') || process.env[varName].includes('YOUR-')) {
      console.error(`  ❌ ${varName} contains placeholder value`);
      hasErrors = true;
    } else {
      console.log(`  ✅ ${varName}`);
    }
  }
});

console.log('\nOptional variables:');
optionalVars.forEach(varName => {
  if (!process.env[varName]) {
    console.warn(`  ⚠️  ${varName} is not set (optional)`);
    hasWarnings = true;
  } else {
    // Check for placeholder values
    if (process.env[varName].includes('your-') || process.env[varName].includes('YOUR-')) {
      console.warn(`  ⚠️  ${varName} contains placeholder value`);
      hasWarnings = true;
    } else {
      console.log(`  ✅ ${varName}`);
    }
  }
});

// Validate specific values
console.log('\nValidating values:');

if (process.env.NODE_ENV !== 'staging') {
  console.warn(`  ⚠️  NODE_ENV should be 'staging', got '${process.env.NODE_ENV}'`);
  hasWarnings = true;
}

if (process.env.PORT && parseInt(process.env.PORT) === 5001) {
  console.warn(`  ⚠️  PORT is 5001 (production port). Consider using 5002 for staging.`);
  hasWarnings = true;
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.error(`  ❌ JWT_SECRET should be at least 32 characters`);
  hasErrors = true;
}

if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('staging')) {
  console.warn(`  ⚠️  MONGODB_URI doesn't contain 'staging'. Make sure you're using a staging database.`);
  hasWarnings = true;
}

if (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('staging')) {
  console.warn(`  ⚠️  FRONTEND_URL doesn't contain 'staging'. Make sure you're using staging URLs.`);
  hasWarnings = true;
}

console.log('\n');

if (hasErrors) {
  console.error('❌ Validation failed! Please fix the errors above.');
  process.exit(1);
} else if (hasWarnings) {
  console.warn('⚠️  Validation passed with warnings. Review the warnings above.');
  process.exit(0);
} else {
  console.log('✅ All staging environment variables validated successfully!');
  process.exit(0);
}


