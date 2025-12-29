// API v2 Routes (Enhanced version)

const express = require('express');
const router = express.Router();

// V2 routes can have different implementations or enhanced features
// For now, we'll use v1 routes but can be extended later
router.use('/auth', require('../auth'));
router.use('/content', require('../content'));
router.use('/video', require('../video'));
router.use('/analytics', require('../analytics'));
router.use('/social', require('../social'));
router.use('/scheduler', require('../scheduler'));
router.use('/search', require('../search'));
router.use('/templates', require('../templates'));
router.use('/workflows', require('../workflows'));
router.use('/teams', require('../teams'));
router.use('/collections', require('../collections'));
router.use('/backup', require('../backup'));
router.use('/moderation', require('../moderation'));
router.use('/jobs', require('../jobs'));
router.use('/cache', require('../cache'));
router.use('/performance', require('../performance'));
router.use('/feature-flags', require('../feature-flags'));
router.use('/security', require('../security'));

// V2 specific enhancements can be added here
// Example: Enhanced endpoints with better response formats

module.exports = router;






