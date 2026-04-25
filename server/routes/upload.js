// Upload router — mounts chunked + progress sub-routers under /api/upload.
// Previously the chunked sub-routes (server/routes/upload/chunked.js) were
// never mounted, so ChunkedUpload.tsx's POST /api/upload/chunked/init hit
// a 404. Same dishonest-stub antipattern as scheduler before this fix.

const express = require('express');
const { getUploadProgress } = require('../middleware/uploadProgress');
const router = express.Router();

// Sub-routes
router.use('/chunked', require('./upload/chunked'));

// Get upload progress
router.get('/progress/:uploadId', (req, res) => {
  try {
    const progress = getUploadProgress(req.params.uploadId);
    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Upload progress not found'
    });
  }
});

module.exports = router;







