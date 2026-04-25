/* eslint-disable no-console */
// Production-grade logger with structured metadata support
// Overcomes 'console.log' limitations while bypassing potential library-induced hangs
const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'key', 'auth', 'cookie', 'credential', 'api_key', 'apikey'];

const redactMetadata = (data) => {
  if (!data || typeof data !== 'object') return data;
  
  const redacted = { ...data };
  Object.keys(redacted).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactMetadata(redacted[key]);
    }
  });
  return redacted;
};

const format = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  // Redact potentially sensitive metadata
  const cleanMeta = redactMetadata(meta);
  
  if (isProduction) {
    // Structured JSON for production monitoring
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...(typeof cleanMeta === 'object' ? cleanMeta : { data: cleanMeta })
    });
  }
  // Human-readable for development
  const metaStr = Object.keys(cleanMeta).length ? ` | ${JSON.stringify(cleanMeta)}` : '';
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
};

module.exports = {
  info: (msg, meta) => console.log(format('info', msg, meta)),
  error: (msg, meta) => console.error(format('error', msg, meta)),
  warn: (msg, meta) => console.warn(format('warn', msg, meta)),
  debug: (msg, meta) => {
    if (!isProduction) console.debug(format('debug', msg, meta));
  },
  stream: {
    write: (msg) => console.log(format('info', msg.trim()))
  }
};

