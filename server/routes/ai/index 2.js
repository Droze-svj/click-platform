const express = require('express');
const router = express.Router();

router.use('/', require('../ai-content'));
router.use('/', require('../ai-enhanced'));

module.exports = router;
