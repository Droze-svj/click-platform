const express = require('express');
const router = express.Router();

router.use('/', require('../ai-content'));
router.use('/', require('../ai-enhanced'));
// AI Director (Slice 1) → /api/ai/director/*
router.use('/director', require('./director'));

module.exports = router;
