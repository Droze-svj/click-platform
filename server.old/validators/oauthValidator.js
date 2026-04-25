
const { body, query, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
    });
  }
  next();
};

const validateConnect = [
  param('platform')
    .isIn(['twitter', 'tiktok', 'youtube', 'instagram', 'linkedin', 'facebook'])
    .withMessage('Invalid platform'),
  query('redirect_uri')
    .optional()
    .isURL()
    .withMessage('Invalid redirect URI'),
  handleValidationErrors
];

const validateCallback = [
  param('platform')
    .isIn(['twitter', 'tiktok', 'youtube', 'instagram', 'linkedin', 'facebook'])
    .withMessage('Invalid platform'),
  query('code')
    .optional()
    .notEmpty()
    .withMessage('Code is required'),
  query('state')
    .optional()
    .notEmpty()
    .withMessage('State is required'),
  query('error')
    .optional(),
  handleValidationErrors
];

const validateDisconnect = [
  param('platform')
    .isIn(['twitter', 'tiktok', 'youtube', 'instagram', 'linkedin', 'facebook'])
    .withMessage('Invalid platform'),
  handleValidationErrors
];

module.exports = {
  validateConnect,
  validateCallback,
  validateDisconnect
};
