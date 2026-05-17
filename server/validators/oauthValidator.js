const { body, query, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

const validateConnect = [
  param('platform')
    .isIn(['twitter', 'tiktok', 'youtube', 'instagram', 'linkedin', 'facebook', 'google'])
    .withMessage('Invalid or unsupported platform'),
  query('redirect_uri')
    .optional()
    .isURL({ require_tld: false })
    .withMessage('Invalid redirect URI'),
  handleValidationErrors
];

const validateCallback = [
  param('platform')
    .isIn(['twitter', 'tiktok', 'youtube', 'instagram', 'linkedin', 'facebook', 'google'])
    .withMessage('Invalid or unsupported platform'),
  query('code')
    .notEmpty()
    .withMessage('Authorization code is required'),
  query('state')
    .notEmpty()
    .withMessage('State parameter is required'),
  handleValidationErrors
];

const validateDisconnect = [
  param('platform')
    .isIn(['twitter', 'tiktok', 'youtube', 'instagram', 'linkedin', 'facebook', 'google'])
    .withMessage('Invalid or unsupported platform'),
  body('platform_user_id').optional({ values: 'falsy' }).isString(),
  // Multi-account: pass `accountId` to disconnect one of several
  // connected accounts. Both fields are optional — when neither is
  // provided, every account on the platform is disconnected.
  body('accountId').optional({ values: 'falsy' }).isString(),
  handleValidationErrors
];

module.exports = {
  validateConnect,
  validateCallback,
  validateDisconnect
};
