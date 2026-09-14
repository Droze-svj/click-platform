const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const { parseTimelineXML } = require('../utils/styleVaultExtractor');

// In-memory parsing with an explicit size cap. NLE timeline exports are XML in
// the low MBs; without a limit an unbounded upload is buffered straight into
// the heap. 10MB is comfortably above a real Premiere/FCP sequence export.
const MAX_TIMELINE_BYTES = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TIMELINE_BYTES, files: 1 },
});

/**
 * @route POST /api/style-vault/extract
 * @desc Accepts NLE XML (Premiere/FCP) and returns a StyleProfile
 *
 * Authenticated: this used to run behind a hardcoded stub that set
 * `req.user = { id: 'test_user_v6' }` and let anyone through, attributing every
 * upload to one fake user. That stub is why the route was never mounted.
 */
router.post('/extract', auth, upload.single('timeline'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing 'timeline' XML file payload" });
    }

    const xmlString = req.file.buffer.toString('utf-8');
    const styleProfile = parseTimelineXML(xmlString);

    // An unparseable timeline is bad INPUT, not a server fault — 400, not 500.
    // (A 5xx here would also trip the write-endpoint sweep.)
    if (!styleProfile) {
      return res.status(400).json({
        error: "Could not extract a StyleProfile — the file doesn't look like a Premiere/FCP timeline export",
      });
    }

    res.json({ message: "Style DNA Extractions complete", styleProfile, status: 200 });
  } catch (error) {
    logger.error('Style vault XML extraction error', { error: error.message });
    res.status(500).json({ error: "Server Error examining XML" });
  }
});

// Multer rejects an oversized or malformed upload before the handler runs; its
// errors are client faults, so translate them instead of letting the global
// handler render them as 500s.
router.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({
      error: tooBig
        ? `Timeline file exceeds the ${Math.round(MAX_TIMELINE_BYTES / (1024 * 1024))}MB limit`
        : `Upload rejected: ${err.code}`,
    });
  }
  return next(err);
});

module.exports = router;
