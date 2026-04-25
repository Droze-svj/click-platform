const express = require('express');
const router = express.Router();

// Aggregate analytics routes
router.use('/', require('./core'));
router.use('/growth', require('./growth'));
router.use('/advanced', require('./advanced'));
router.use('/predictions', require('./predictions'));
router.use('/content', require('./content'));
router.use('/performance', require('./performance'));
router.use('/advanced-features', require('./advanced-features'));

module.exports = router;
