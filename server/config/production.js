// Production Environment Configuration

const logger = require('../utils/logger');

/**
 * Validate production environment variables
 */
function validateProductionEnv() {
  const required = [
    'MONGODB_URI',
    'JWT_SECRET',
    'NODE_ENV'
  ];

  const getEnvSafe = (key) => {
    if (typeof key !== 'string' || key === '__proto__' || key === 'constructor') {
      return undefined;
    }
    return process.env[key];
  };

  const missing = required.filter(key => !getEnvSafe(key));

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Warn about optional but recommended variables
  const recommended = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_BUCKET',
    'SENTRY_DSN',
    'REDIS_URL'
  ];

  const missingRecommended = recommended.filter(key => !getEnvSafe(key));
  if (missingRecommended.length > 0) {
    logger.warn('Missing recommended environment variables:', {
      variables: missingRecommended,
      message: 'Some features may not work optimally'
    });
  }

  logger.info('✅ Production environment validated');
}

/**
 * Get production configuration
 */
function getProductionConfig() {
  return {
    // Server
    port: process.env.PORT || 5001,
    nodeEnv: process.env.NODE_ENV || 'production',
    
    // Database
    mongodb: {
      uri: process.env.MONGODB_URI,
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }
    },

    // Security
    // NOTE: session token lifetimes are owned by server/utils/jwtTokens.js
    // (access 1h + 90d refresh). This field is informational only.
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    },

    // Storage
    storage: {
      type: process.env.STORAGE_TYPE || (process.env.AWS_S3_BUCKET ? 's3' : 'local'),
      s3: {
        bucket: process.env.AWS_S3_BUCKET,
        region: process.env.AWS_REGION || 'us-east-1',
        cdnUrl: process.env.AWS_CLOUDFRONT_URL
      }
    },

    // Redis
    redis: {
      url: process.env.REDIS_URL,
      enabled: !!process.env.REDIS_URL
    },

    // Monitoring
    sentry: {
      dsn: process.env.SENTRY_DSN,
      enabled: !!process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production'
    },

    // Rate Limiting
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100
    },

    // CORS
    cors: {
      origin: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '*',
      credentials: true
    },

    // Logging
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: 'json' // Use JSON in production
    }
  };
}

/**
 * Initialize production environment
 */
function initProduction() {
  try {
    validateProductionEnv();
    const config = getProductionConfig();
    
    logger.info('🚀 Production environment initialized', {
      port: config.port,
      nodeEnv: config.nodeEnv,
      storage: config.storage.type,
      redis: config.redis.enabled ? 'enabled' : 'disabled',
      sentry: config.sentry.enabled ? 'enabled' : 'disabled'
    });

    return config;
  } catch (error) {
    logger.error('❌ Production environment initialization failed', {
      error: error.message
    });
    // Don't throw - allow server to start even if production config fails
    logger.warn('⚠️ Continuing without full production config. Server will still start.');
    return null;
  }
}

module.exports = {
  validateProductionEnv,
  getProductionConfig,
  initProduction
};




