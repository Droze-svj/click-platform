const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

// Core analytics routes (formerly server/routes/analytics.js)
const coreRouter = require('./core');
router.use('/', coreRouter);

// Sub-modules
try {
  router.use('/content', require('./content'));
  router.use('/performance', require('./performance'));
  router.use('/advanced', require('./advanced'));
  router.use('/advanced-features', require('./advanced-features'));
  router.use('/bi', require('./bi'));
  router.use('/enhanced', require('./enhanced'));
  router.use('/growth', require('./growth'));
  router.use('/platform', require('./platform'));
  router.use('/predictions', require('./predictions'));
  router.use('/user', require('./user'));
  router.use('/content-performance', require('./contentPerformance'));
  
  logger.info('✅ Analytics sub-modules mounted successfully');
} catch (error) {
  logger.error('❌ Failed to mount some analytics sub-modules', { error: error.message });
}

module.exports = router;
