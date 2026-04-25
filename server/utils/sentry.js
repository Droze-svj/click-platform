// Sentry configuration for backend

let Sentry = null;
let ProfilingIntegration = null;

try {
  if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
    console.log('REQUIRING SENTRY');
    Sentry = require('@sentry/node');
    ProfilingIntegration = require('@sentry/profiling-node').ProfilingIntegration;
    console.log('SENTRY REQUIRED');
  }
} catch (e) {
  console.warn('Sentry failed to load:', e.message);
}

const logger = require('./logger');

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';
  const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1');
  const profilesSampleRate = parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1');

  if (!dsn || !Sentry) {
    logger.warn('Sentry DSN not configured or Sentry failed to load. Error tracking disabled.');
    return;
  }

  try {
    const integrations = [];
    if (ProfilingIntegration) {
      integrations.push(new ProfilingIntegration());
    }

    Sentry.init({
      dsn,
      environment,
      integrations,
      // Performance Monitoring
      tracesSampleRate,
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
  if (process.env.SENTRY_DSN && Sentry) {
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
  if (process.env.SENTRY_DSN && Sentry) {
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
  if (process.env.SENTRY_DSN && Sentry) {
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
  if (process.env.SENTRY_DSN && Sentry) {
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
  if (process.env.SENTRY_DSN && Sentry) {
    Sentry.setUser(null);
  }
}

/**
 * Start a transaction for performance monitoring
 */
function startTransaction(name, op = 'http.server') {
  if (process.env.SENTRY_DSN && Sentry) {
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






