// Transcript Management Routes

const express = require('express');
const auth = require('../middleware/auth');
const {
  updateTranscript,
  exportTranscript,
  searchTranscripts,
  getTranscriptWithTimestamps,
} = require('../services/transcriptService');
const { sendSuccess, sendError } = require('../utils/response');
const asyncHandler = require('../middleware/asyncHandler');
const router = express.Router();

/**
 * PUT /api/transcripts/:contentId
 * Update transcript
 */
router.put('/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { transcript, changeSummary } = req.body;

  if (!transcript) {
    return sendError(res, 'Transcript is required', 400);
  }

  const content = await updateTranscript(contentId, req.user._id, transcript, changeSummary);
  sendSuccess(res, 'Transcript updated successfully', 200, {
    contentId: content._id,
    transcript: content.transcript,
  });
}));

/**
 * GET /api/transcripts/:contentId/export
 * Export transcript
 */
router.get('/:contentId/export', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const format = req.query.format || 'txt';

  const exported = await exportTranscript(contentId, req.user._id, format);

  // Set appropriate content type
  const contentTypes = {
    txt: 'text/plain',
    json: 'application/json',
    srt: 'text/srt',
    vtt: 'text/vtt',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  res.setHeader('Content-Type', contentTypes[format] || 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="transcript-${contentId}.${format}"`);

  if (format === 'docx') {
    // For DOCX, you'd need a library like docx to generate the file
    // For now, return JSON with instructions
    return sendSuccess(res, 'DOCX export requires additional setup', 200, exported);
  }

  res.send(exported);
}));

/**
 * GET /api/transcripts/search
 * Search transcripts
 */
router.get('/search', auth, asyncHandler(async (req, res) => {
  const { query, limit, offset } = req.query;

  if (!query) {
    return sendError(res, 'Search query is required', 400);
  }

  const results = await searchTranscripts(req.user._id, query, {
    limit: parseInt(limit) || 20,
    offset: parseInt(offset) || 0,
  });

  sendSuccess(res, 'Transcripts found', 200, results);
}));

/**
 * GET /api/transcripts/:contentId/timestamps
 * Get transcript with timestamps
 */
router.get('/:contentId/timestamps', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const result = await getTranscriptWithTimestamps(contentId, req.user._id);
  sendSuccess(res, 'Transcript retrieved', 200, result);
}));

module.exports = router;




