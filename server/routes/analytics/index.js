const express = require('express');
const router = express.Router();

// Aggregate analytics routes.
// Mount /global FIRST so the public marketing-stats route isn't shadowed
// by an auth middleware in `core` if one of those handlers also responds
// to GET /global by accident.
router.use('/global', require('./global'));
router.use('/', require('./core'));
router.use('/growth', require('./growth'));
router.use('/advanced', require('./advanced'));
router.use('/predictions', require('./predictions'));
router.use('/content', require('./content'));
router.use('/performance', require('./performance'));
router.use('/advanced-features', require('./advanced-features'));

module.exports = router;
