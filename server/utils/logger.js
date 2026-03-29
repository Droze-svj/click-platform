// Simplified logger to bypass hanging issues
module.exports = {
  info: (...args) => console.log(...args),
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  debug: (...args) => console.debug(...args),
  stream: {
    write: (message) => console.log(message.trim())
  }
};

