// Password policy utilities

/**
 * Calculate password strength score (0-100)
 */
function calculatePasswordStrength(password) {
  if (!password) return 0;

  let score = 0;
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /\d/.test(password),
    specialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    noCommonPatterns: !/(123456|password|qwerty|abc123)/i.test(password)
  };

  // Length scoring
  if (checks.length) {
    score += password.length >= 12 ? 25 : password.length >= 8 ? 15 : 5;
  }

  // Character variety scoring
  if (checks.uppercase) score += 15;
  if (checks.lowercase) score += 15;
  if (checks.numbers) score += 15;
  if (checks.specialChars) score += 15;
  if (checks.noCommonPatterns) score += 15;

  return Math.min(Math.max(score, 0), 100);
}

/**
 * Get password strength level
 */
function getPasswordStrengthLevel(score) {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'weak';
}

/**
 * Get password suggestions based on current password
 */
function getPasswordSuggestions(password) {
  const suggestions = [];
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /\d/.test(password),
    specialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };

  if (!checks.length) {
    suggestions.push('Use at least 8 characters');
  } else if (password.length < 12) {
    suggestions.push('Consider using 12 or more characters for better security');
  }

  if (!checks.uppercase) {
    suggestions.push('Include at least one uppercase letter (A-Z)');
  }

  if (!checks.lowercase) {
    suggestions.push('Include at least one lowercase letter (a-z)');
  }

  if (!checks.numbers) {
    suggestions.push('Include at least one number (0-9)');
  }

  if (!checks.specialChars) {
    suggestions.push('Include at least one special character (!@#$%^&*)');
  }

  // Check for common patterns
  if (/(123456|password|qwerty|abc123)/i.test(password)) {
    suggestions.push('Avoid common patterns like "123456", "password", "qwerty"');
  }

  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    suggestions.push('Avoid repeated characters (e.g., "aaa", "111")');
  }

  return suggestions;
}

/**
 * Validate password against policy
 */
function validatePasswordPolicy(password) {
  const errors = [];
  const warnings = [];

  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (password.length < 8) {
    warnings.push('Password is short. Consider using 8 or more characters');
  }

  // Check for required character types (at least 3 of 4)
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const charTypeCount = [hasUppercase, hasLowercase, hasNumbers, hasSpecialChars].filter(Boolean).length;

  if (charTypeCount < 3) {
    errors.push('Password must contain at least 3 of the following: uppercase letters, lowercase letters, numbers, special characters');
  }

  // Check for common weak passwords
  const commonPasswords = ['password', '123456', 'qwerty', 'abc123', 'password123', 'admin', 'letmein'];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('This password is too common. Please choose a more unique password');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    strength: calculatePasswordStrength(password),
    strengthLevel: getPasswordStrengthLevel(calculatePasswordStrength(password))
  };
}

module.exports = {
  calculatePasswordStrength,
  getPasswordStrengthLevel,
  getPasswordSuggestions,
  validatePasswordPolicy
};
