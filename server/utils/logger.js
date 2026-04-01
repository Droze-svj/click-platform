/* eslint-disable no-console */
// Production-grade logger with structured metadata support
// Overcomes 'console.log' limitations while bypassing potential library-induced hangs
const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

const format = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  if (isProduction) {
    // Structured JSON for production monitoring
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...(typeof meta === 'object' ? meta : { data: meta })
    });
  }
  // Human-readable for development
  const metaStr = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
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

