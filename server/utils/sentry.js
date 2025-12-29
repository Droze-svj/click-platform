// Sentry configuration for backend

const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');
const logger = require('./logger');

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';
  const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1');
  const profilesSampleRate = parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1');

  if (!dsn) {
    logger.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment,
      integrations: [
        new ProfilingIntegration(),
      ],
      // Performance Monitoring
      tracesSampleRate,
      // Set sampling rate for profiling - this is relative to tracesSampleRate
      // We recommend keeping it at 1.0 while in development and sample at a lower rate in production
      profilesSampleRate,
      
      // Release tracking
      release: process.env.SENTRY_RELEASE || `click@${process.env.npm_package_version || '1.0.0'}`,
      
      // Filter out sensitive data
      beforeSend(event, hint) {
        // Remove sensitive information
        if (event.request) {
          // Remove sensitive headers
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
          
          // Remove sensitive body data
          if (event.request.data) {
            if (typeof event.request.data === 'object') {
              delete event.request.data.password;
              delete event.request.data.token;
              delete event.request.data.accessToken;
              delete event.request.data.refreshToken;
            }
          }
        }
        
        return event;
      },
      
      // Ignore certain errors
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        // Network errors
        'NetworkError',
        'Network request failed',
        // Known non-critical errors
        'ResizeObserver loop limit exceeded',
      ],
    });

    logger.info('✅ Sentry initialized for error tracking and performance monitoring');
  } catch (error) {
    logger.error('Failed to initialize Sentry', { error: error.message });
  }
}

/**
 * Capture exception and send to Sentry
 */
function captureException(error, context = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      // Add context
      if (context.userId) {
        scope.setUser({ id: context.userId });
      }
      if (context.tags) {
        Object.keys(context.tags).forEach(key => {
          scope.setTag(key, context.tags[key]);
        });
      }
      if (context.extra) {
        Object.keys(context.extra).forEach(key => {
          scope.setExtra(key, context.extra[key]);
        });
      }
      
      Sentry.captureException(error);
    });
  }
}

/**
 * Capture message and send to Sentry
 */
function captureMessage(message, level = 'info', context = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (context.userId) {
        scope.setUser({ id: context.userId });
      }
      if (context.tags) {
        Object.keys(context.tags).forEach(key => {
          scope.setTag(key, context.tags[key]);
        });
      }
      
      Sentry.captureMessage(message, level);
    });
  }
}

/**
 * Add breadcrumb for debugging
 */
function addBreadcrumb(message, category = 'default', level = 'info', data = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  }
}

/**
 * Set user context for Sentry
 */
function setUser(user) {
  if (process.env.SENTRY_DSN) {
    Sentry.setUser({
      id: user._id || user.id,
      email: user.email,
      username: user.username || user.name,
    });
  }
}

/**
 * Clear user context
 */
function clearUser() {
  if (process.env.SENTRY_DSN) {
    Sentry.setUser(null);
  }
}

/**
 * Start a transaction for performance monitoring
 */
function startTransaction(name, op = 'http.server') {
  if (process.env.SENTRY_DSN) {
    return Sentry.startTransaction({
      name,
      op,
    });
  }
  return null;
}

module.exports = {
  initSentry,
  captureException,
  captureMessage,
  addBreadcrumb,
  setUser,
  clearUser,
  startTransaction,
  Sentry, // Export Sentry for direct use if needed
};






