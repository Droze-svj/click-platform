// Upload progress endpoint

const express = require('express');
const { getUploadProgress } = require('../middleware/uploadProgress');
const router = express.Router();

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







