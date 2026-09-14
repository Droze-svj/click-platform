const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const digitalTwinService = require('../services/digitalTwinService');
const usageService = require('../services/usageService');
const logger = require('../utils/logger');
const { getUserIdFromReq } = require('../utils/userId');

/**
 * @route   GET /api/digital-twin/providers
 * @desc    Get configured & available digital twin synthesis providers for the user
 * @access  Private
 */
router.get('/providers', authenticateToken, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
    const providers = await digitalTwinService.getAvailableProviders(userId);
    res.json({
      success: true,
      data: providers
    });
  } catch (error) {
    logger.error('Failed to retrieve digital twin providers', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retrieve available providers' });
  }
});

/**
 * @route   GET /api/digital-twin/jobs
 * @desc    Get all digital twin generation jobs for the authenticated user
 * @access  Private
 */
router.get('/jobs', authenticateToken, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
    const limit = parseInt(req.query.limit, 10) || 50;
    const jobs = digitalTwinService.getUserJobs(userId, { limit });
    res.json({
      success: true,
      data: jobs
    });
  } catch (error) {
    logger.error('Failed to list digital twin jobs', { error: error.message, userId: req.user?.id });
    res.status(500).json({ success: false, error: 'Failed to list digital twin jobs' });
  }
});

/**
 * @route   POST /api/digital-twin/generate
 * @desc    Generate a digital twin video from a voice note
 * @access  Private
 */
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { voiceNoteUrl, options = {} } = req.body || {};
    const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;

    if (!voiceNoteUrl) {
      return res.status(400).json({ error: 'voiceNoteUrl is required' });
    }

    // Auto-inject creator avatar from profile if not explicitly specified
    const mergedOptions = {
      ...options,
      avatarUrl: options.avatarUrl || options.avatarImage || req.user?.avatar || undefined,
    };

    const job = await digitalTwinService.createAvatarVideo(userId, voiceNoteUrl, mergedOptions);
    
    if (job && job.status !== 'unavailable' && job.status !== 'failed') {
      usageService.incrementUsage(userId, 'contentGenerated', 1).catch(err => {
        logger.warn('[digital-twin] usage counter increment failed', { error: err.message, userId });
      });
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    logger.error('Digital Twin generation failed', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to initiate digital twin generation' });
  }
});

/**
 * @route   GET /api/digital-twin/status/:jobId
 * @desc    Get the status of a digital twin generation job
 * @access  Private
 */
router.get('/status/:jobId', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await digitalTwinService.getGenerationStatus(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
    if (job.userId && String(job.userId) !== String(userId) && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access to job' });
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    logger.error('Failed to get digital twin status', { error: error.message, jobId: req.params.jobId });
    res.status(500).json({ error: 'Failed to retrieve job status' });
  }
});

/**
 * @route   DELETE /api/digital-twin/jobs/:jobId
 * @desc    Delete or cancel a digital twin generation job
 * @access  Private
 */
router.delete('/jobs/:jobId', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
    
    const deleted = digitalTwinService.deleteJob(jobId, userId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    res.json({
      success: true,
      message: 'Job removed successfully'
    });
  } catch (error) {
    const status = error.statusCode || 500;
    logger.error('Failed to delete digital twin job', { error: error.message, jobId: req.params.jobId });
    res.status(status).json({ success: false, error: error.message || 'Failed to delete job' });
  }
});

/**
 * @route   GET /api/digital-twin/consent
 * @desc    Check if user has acknowledged BIPA / EU AI Act biometric consent
 * @access  Private
 */
router.get('/consent', authenticateToken, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
    const settings = await digitalTwinService.resolveUserSettings(userId);
    const consent = settings?.agentic?.biometricConsent || false;
    const consentAt = settings?.agentic?.biometricConsentAt || null;

    res.json({
      success: true,
      data: {
        consent,
        consentAt,
        policyVersion: '2026.1',
        notice: 'Biometric voice and facial landmark processing complies with 740 ILCS 14/ (BIPA) and EU AI Act Art. 50.',
      },
    });
  } catch (error) {
    logger.error('Failed to get digital twin consent status', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retrieve consent status' });
  }
});

/**
 * @route   POST /api/digital-twin/consent
 * @desc    Record explicit user consent for biometric voice & facial synthesis
 * @access  Private
 */
router.post('/consent', authenticateToken, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req) || req.user?._id || req.user?.id;
    const { consent = true } = req.body || {};

    const UserSettings = require('../models/UserSettings');
    if (UserSettings && typeof UserSettings.findOneAndUpdate === 'function') {
      await UserSettings.findOneAndUpdate(
        { userId },
        {
          $set: {
            'agentic.biometricConsent': Boolean(consent),
            'agentic.biometricConsentAt': new Date(),
            'agentic.biometricConsentVersion': '2026.1',
          },
        },
        { upsert: true, new: true }
      );
    }

    res.json({
      success: true,
      message: 'Biometric and synthetic media consent recorded successfully',
      data: {
        consent: Boolean(consent),
        consentAt: new Date(),
        policyVersion: '2026.1',
      },
    });
  } catch (error) {
    logger.error('Failed to record digital twin consent', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to record consent' });
  }
});

module.exports = router;
