// Mock for isomorphic-dompurify to avoid ES module issues in Jest

module.exports = {
  sanitize: (dirty, config) => {
    // Simple mock that returns the input string
    // In real tests, you might want more sophisticated sanitization
    if (typeof dirty !== 'string') {
      return dirty;
    }
    // Basic XSS prevention mock
    return dirty
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  },
  isSupported: true,
  setConfig: () => {},
  clearConfig: () => {},
  addHook: () => {},
  removeHook: () => {},
  removeAllHooks: () => {},
  removeAttribute: () => {},
  addAttribute: () => {},
  removeTag: () => {},
  addTag: () => {},
};

