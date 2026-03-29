// Validate required environment variables on startup

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET'
];

const optionalEnvVars = {
  'GOOGLE_AI_API_KEY': 'AI features will be limited',
  'WHOP_API_KEY': 'WHOP subscription features will be disabled',
  'PORT': 'Will use default port 5001',
  'FRONTEND_URL': 'Will use default CORS settings'
};

function validateEnv() {
  const missing = [];
  const warnings = [];

  // Check required variables
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  // Check optional variables
  Object.keys(optionalEnvVars).forEach(varName => {
    if (!process.env[varName]) {
      warnings.push(`${varName}: ${optionalEnvVars[varName]}`);
    }
  });

  // Throw error if required vars are missing
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease set these variables in your .env file or Render.com environment variables');

    // In production, log but don't exit - let server start to show health check endpoint
    if (process.env.NODE_ENV === 'production') {
      console.error('⚠️ Continuing in production mode. Server will start but may not function correctly.');
      console.error('⚠️ Add missing variables to Render.com and redeploy.');
    } else {
      process.exit(1);
    }
  }

  // Show warnings for optional vars
  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn('\n⚠️  Optional environment variables not set:');
    warnings.forEach(warning => {
      console.warn(`   - ${warning}`);
    });
    console.warn('');
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  JWT_SECRET should be at least 32 characters long for security');
  }

  console.log('✅ Environment variables validated');
}

module.exports = validateEnv;







