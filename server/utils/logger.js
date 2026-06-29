// Winston logger configuration

const winston = require('winston');
const path = require('path');
const { getContext } = require('./requestContext');

// Stamp every log line emitted during a request with its requestId (+ userId)
// from the AsyncLocalStorage context, so one request can be traced end-to-end.
// Never throws — a context hiccup must not break logging.
const injectRequestContext = winston.format((info) => {
  try {
    const ctx = getContext();
    if (ctx.requestId && info.requestId === undefined) info.requestId = ctx.requestId;
    if (ctx.userId && info.userId === undefined) info.userId = ctx.userId;
  } catch (_) { /* never break logging */ }
  return info;
});

// Define log format
const logFormat = winston.format.combine(
  injectRequestContext(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * Stringify metadata safely. Replaces circular references with a marker
 * instead of crashing the request — axios errors carry the request +
 * response objects which reference each other, so a `logger.error(err)`
 * call could 500 the whole response by throwing inside the formatter.
 * That actually happened during the Google OAuth callback flow: the
 * token-exchange error was real, but `JSON.stringify` blew up trying
 * to log it, the 500 masked the original error, and there was no
 * useful diagnostic in the response.
 */
function safeStringify(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
      // Trim a few known-noisy axios internals so the log isn't
      // dominated by them when we DO get to print them.
      if (value.constructor && /^(ClientRequest|IncomingMessage|Socket|TLSSocket|HTTPParser)$/.test(value.constructor.name)) {
        return `[${value.constructor.name}]`;
      }
    }
    return value;
  });
}

// Console format for development
const consoleFormat = winston.format.combine(
  injectRequestContext(),
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      try {
        msg += ` ${safeStringify(meta)}`;
      } catch (err) {
        msg += ` [meta-serialise-failed: ${err.message}]`;
      }
    }
    return msg;
  })
);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'click' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat
    }),
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      // Filter out Redis localhost connection errors
      format: winston.format((info) => {
        if (info.reason && typeof info.reason === 'object' && info.reason.message &&
            info.reason.message.includes('ECONNREFUSED') && info.reason.message.includes('127.0.0.1:6379')) {
          return false; // Don't log this
        }
        return info;
      })()
    })
  ]
});

// Create a stream object for Morgan HTTP request logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;

