// Validate required environment variables on startup

const logger = require('../utils/logger');

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

  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) missing.push(varName);
  });

  Object.keys(optionalEnvVars).forEach((varName) => {
    if (!process.env[varName]) warnings.push(`${varName}: ${optionalEnvVars[varName]}`);
  });

  if (missing.length > 0) {
    logger.error('Missing required environment variables', { missing });

    // In production, log but don't exit — let server start to show the
    // health check endpoint; the boot-level fatal check in index.js gates
    // the truly critical deps.
    if (process.env.NODE_ENV === 'production') {
      logger.warn('Continuing in production mode; some functionality will be degraded until missing vars are set');
    } else {
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    logger.warn('Optional environment variables not set', { warnings });
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    logger.warn('JWT_SECRET should be at least 32 characters long for security');
  }

  logger.info('Environment variables validated');
}

module.exports = validateEnv;







