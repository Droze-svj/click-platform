// Input validation for content routes

const { body, validationResult } = require('express-validator');

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

// Content generation validation
const validateContentGenerate = [
  body('text')
    .notEmpty()
    .withMessage('Text content is required')
    .isLength({ min: 50 })
    .withMessage('Text content must be at least 50 characters long')
    .isLength({ max: 50000 })
    .withMessage('Text content must be less than 50,000 characters'),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title must be less than 200 characters'),
  body('type')
    .optional()
    .isIn(['article', 'podcast', 'transcript'])
    .withMessage('Type must be article, podcast, or transcript'),
  body('platforms')
    .optional()
    .isArray()
    .withMessage('Platforms must be an array')
    .custom((platforms) => {
      const allowed = ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok'];
      if (platforms.some(p => !allowed.includes(p))) {
        throw new Error(`Platforms must be one of: ${allowed.join(', ')}`);
      }
      return true;
    }),
  handleValidationErrors
];

module.exports = {
  validateContentGenerate
};







