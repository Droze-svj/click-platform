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
    
    missing.forEach(varName => {
      
    });
    

    // In production, log but don't exit - let server start to show health check endpoint
    if (process.env.NODE_ENV === 'production') {
      
      
    } else {
      process.exit(1);
    }
  }

  // Show warnings for optional vars
  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    
    warnings.forEach(warning => {
      
    });
    
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    
  }

  
}

module.exports = validateEnv;







