// Additional validation utilities

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate color hex code
 */
function isValidColor(color) {
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color);
}

/**
 * Sanitize string input
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
}

/**
 * Validate file extension
 */
function isValidFileExtension(filename, allowedExtensions) {
  const ext = filename.split('.').pop()?.toLowerCase();
  return allowedExtensions.includes(`.${ext}`);
}

module.exports = {
  isValidEmail,
  isValidUrl,
  isValidColor,
  sanitizeString,
  isValidFileExtension
};







