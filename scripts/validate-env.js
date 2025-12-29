// Validate environment variables

// Support different environment files
const env = process.argv[2] || 'development';
const envFile = env === 'production' ? '.env.production' : env === 'staging' ? '.env.staging' : '.env';

// Load environment file
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', envFile);

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  console.warn(`⚠️  ${envFile} not found, using process.env`);
  require('dotenv').config();
}

const requiredVars = {
  core: [
    'MONGODB_URI',
    'JWT_SECRET',
    'OPENAI_API_KEY',
  ],
  optional: {
    sentry: ['SENTRY_DSN', 'NEXT_PUBLIC_SENTRY_DSN'],
    aws: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET'],
    oauth: {
      twitter: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'],
      linkedin: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
      facebook: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
    },
  },
};

function validateEnv() {
  const missing = [];
  const warnings = [];
  const info = [];

  console.log('🔍 Validating environment variables...\n');

  // Check required variables
  console.log('📋 Required Variables:');
  requiredVars.core.forEach(varName => {
    if (!process.env[varName] || process.env[varName].includes('your-') || process.env[varName].includes('change-this')) {
      missing.push(varName);
      console.log(`  ❌ ${varName} - MISSING or not configured`);
    } else {
      console.log(`  ✅ ${varName} - configured`);
    }
  });

  // Check optional variables
  console.log('\n📋 Optional Variables:');

  // Sentry
  const sentryConfigured = requiredVars.optional.sentry.every(v => process.env[v]);
  if (sentryConfigured) {
    console.log(`  ✅ Sentry - configured`);
    info.push('Sentry error tracking is enabled');
  } else {
    console.log(`  ⚠️  Sentry - not configured (errors won't be tracked)`);
    warnings.push('Sentry not configured - error tracking disabled');
  }

  // AWS S3
  const awsConfigured = requiredVars.optional.aws.every(v => process.env[v]);
  if (awsConfigured) {
    console.log(`  ✅ AWS S3 - configured`);
    info.push('Cloud storage (S3) is enabled');
  } else {
    console.log(`  ⚠️  AWS S3 - not configured (using local storage)`);
    warnings.push('AWS S3 not configured - files will be stored locally');
  }

  // OAuth
  console.log(`  📱 OAuth Integrations:`);
  Object.entries(requiredVars.optional.oauth).forEach(([platform, vars]) => {
    const configured = vars.every(v => process.env[v]);
    if (configured) {
      console.log(`    ✅ ${platform.charAt(0).toUpperCase() + platform.slice(1)} - configured`);
      info.push(`${platform} OAuth is enabled`);
    } else {
      console.log(`    ⚠️  ${platform.charAt(0).toUpperCase() + platform.slice(1)} - not configured`);
    }
  });

  // Summary
  console.log('\n📊 Summary:');
  if (missing.length > 0) {
    console.log(`\n❌ Missing required variables: ${missing.join(', ')}`);
    console.log('   Please configure these in your .env file');
    process.exit(1);
  } else {
    console.log('✅ All required variables are configured');
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings:`);
    warnings.forEach(w => console.log(`   - ${w}`));
  }

  if (info.length > 0) {
    console.log(`\nℹ️  Enabled features:`);
    info.forEach(i => console.log(`   - ${i}`));
  }

  console.log('\n✅ Environment validation complete!\n');
}

validateEnv();






