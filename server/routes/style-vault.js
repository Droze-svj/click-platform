const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parseTimelineXML } = require('../utils/styleVaultExtractor');

// Setup multer for in-memory file parsing
const upload = multer({ storage: multer.memoryStorage() });

// Authenticate Mock
const authenticate = (req, res, next) => {
    req.user = { id: 'test_user_v6' };
    next();
};

/**
 * @route POST /api/style-vault/extract
 * @desc Accepts NLE XML (Premiere/FCP) and returns a StyleProfile
 */
router.post('/extract', authenticate, upload.single('timeline'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing 'timeline' XML file payload" });
    }

    const xmlString = req.file.buffer.toString('utf-8');
    const styleProfile = parseTimelineXML(xmlString);

    if (!styleProfile) {
        return res.status(500).json({ error: "Failed to extract StyleProfile from XML" });
    }

    res.json({ message: "Style DNA Extractions complete", styleProfile, status: 200 });
  } catch (error) {
    console.error('Style Vault Extraction Error:', error);
    res.status(500).json({ error: "Server Error examining XML" });
  }
});

module.exports = router;
