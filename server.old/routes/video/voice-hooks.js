// Voice Hooks Routes
// Professional voice hooks for video enhancement

const express = require('express');
const multer = require('multer');
const router = express.Router();
const voiceHookService = require('../../services/voiceHookService');
const logger = require('../../utils/logger');

// Configure multer for voice hook uploads
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for voice hooks
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP3, WAV, M4A, and MP4 audio files are allowed.'), false);
    }
  }
});

// Get voice hooks library
router.get('/library', async (req, res) => {
  try {
    const library = await voiceHookService.getVoiceHooksLibrary();
    res.json({
      success: true,
      data: { library }
    });
  } catch (error) {
    logger.error('Failed to get voice hooks library', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get voice hooks library' });
  }
});

// Get voice hook suggestions for video
router.post('/suggestions', async (req, res) => {
  try {
    const { videoMetadata, userPreferences } = req.body;

    if (!videoMetadata) {
      return res.status(400).json({ success: false, error: 'Video metadata is required' });
    }

    const suggestions = await voiceHookService.getVoiceHookSuggestions(videoMetadata, userPreferences);
    res.json({
      success: true,
      data: { suggestions }
    });
  } catch (error) {
    logger.error('Voice hook suggestions failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get voice hook suggestions' });
  }
});

// Add voice hook to video
router.post('/add-to-video', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'voiceHook', maxCount: 1 }
]), async (req, res) => {
  try {
    const { options } = req.body;
    const videoFile = req.files.video?.[0];
    const voiceHookFile = req.files.voiceHook?.[0];

    if (!videoFile) {
      return res.status(400).json({ success: false, error: 'Video file is required' });
    }

    if (!voiceHookFile) {
      return res.status(400).json({ success: false, error: 'Voice hook file is required' });
    }

    const parsedOptions = options ? JSON.parse(options) : {};
    const resultPath = await voiceHookService.addVoiceHookToVideo(
      videoFile.path,
      voiceHookFile.path,
      parsedOptions
    );

    // Clean up temp files
    await Promise.all([videoFile, voiceHookFile].map(file =>
      require('fs').promises.unlink(file.path)
    ));

    res.json({
      success: true,
      data: {
        videoWithVoiceHookPath: resultPath,
        message: 'Voice hook added successfully'
      }
    });

  } catch (error) {
    logger.error('Voice hook addition failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to add voice hook to video' });
  }
});

// Upload and process custom voice hook
router.post('/upload-custom', upload.single('voiceHook'), async (req, res) => {
  try {
    const { options, name, category } = req.body;
    const voiceHookFile = req.file;

    if (!voiceHookFile) {
      return res.status(400).json({ success: false, error: 'Voice hook file is required' });
    }

    const parsedOptions = options ? JSON.parse(options) : {};
    const processedPath = await voiceHookService.processCustomVoiceHook(voiceHookFile.path, parsedOptions);

    // Clean up original file
    await require('fs').promises.unlink(voiceHookFile.path);

    // Create custom voice hook entry
    const customVoiceHook = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name || voiceHookFile.originalname,
      category: category || 'custom',
      duration: 0, // Would need to calculate from processed file
      url: processedPath,
      custom: true,
      uploadedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: {
        voiceHook: customVoiceHook,
        processedPath,
        message: 'Custom voice hook processed successfully'
      }
    });

  } catch (error) {
    logger.error('Custom voice hook upload failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to process custom voice hook' });
  }
});

// Analyze voice hook performance
router.post('/analyze-performance', async (req, res) => {
  try {
    const { voiceHookId, videoMetrics } = req.body;

    if (!voiceHookId || !videoMetrics) {
      return res.status(400).json({ success: false, error: 'Voice hook ID and video metrics are required' });
    }

    const analysis = await voiceHookService.analyzeVoiceHookPerformance(voiceHookId, videoMetrics);
    res.json({
      success: true,
      data: { analysis }
    });
  } catch (error) {
    logger.error('Voice hook performance analysis failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to analyze voice hook performance' });
  }
});

// Get voice hook templates
router.get('/templates', async (req, res) => {
  try {
    const templates = await voiceHookService.getVoiceHookTemplates();
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    logger.error('Failed to get voice hook templates', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get voice hook templates' });
  }
});

// Generate dynamic voice hook
router.post('/generate-dynamic', async (req, res) => {
  try {
    const { content, style, platform } = req.body;

    if (!content || !style) {
      return res.status(400).json({ success: false, error: 'Content and style are required' });
    }

    const dynamicHook = await voiceHookService.generateDynamicVoiceHook(content, style, platform);
    res.json({
      success: true,
      data: { dynamicHook }
    });
  } catch (error) {
    logger.error('Dynamic voice hook generation failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to generate dynamic voice hook' });
  }
});

// Create voice hook sequence
router.post('/create-sequence', async (req, res) => {
  try {
    const { videoDuration, contentType, engagementPoints } = req.body;

    if (!videoDuration || !contentType) {
      return res.status(400).json({ success: false, error: 'Video duration and content type are required' });
    }

    const sequence = await voiceHookService.createVoiceHookSequence(
      videoDuration,
      contentType,
      engagementPoints
    );

    res.json({
      success: true,
      data: { sequence }
    });
  } catch (error) {
    logger.error('Voice hook sequence creation failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create voice hook sequence' });
  }
});

// Get voice hook marketplace
router.get('/marketplace', async (req, res) => {
  try {
    const filters = req.query;
    const marketplace = await voiceHookService.getVoiceHookMarketplace(filters);
    res.json({
      success: true,
      data: marketplace
    });
  } catch (error) {
    logger.error('Failed to get voice hook marketplace', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get voice hook marketplace' });
  }
});

// Apply advanced audio mixing
router.post('/advanced-mixing', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'voiceHooks', maxCount: 10 }
]), async (req, res) => {
  try {
    const { audioSettings } = req.body;
    const videoFile = req.files.video?.[0];
    const voiceHookFiles = req.files.voiceHooks || [];

    if (!videoFile) {
      return res.status(400).json({ success: false, error: 'Video file is required' });
    }

    const parsedSettings = audioSettings ? JSON.parse(audioSettings) : {};

    // Convert uploaded files to hook objects
    const voiceHooks = voiceHookFiles.map(file => ({
      url: file.path,
      startTime: 0,
      volume: 1
    }));

    const resultPath = await voiceHookService.applyAdvancedAudioMixing(
      videoFile.path,
      voiceHooks,
      parsedSettings
    );

    // Clean up temp files
    await require('fs').promises.unlink(videoFile.path);
    await Promise.all(voiceHookFiles.map(file => require('fs').promises.unlink(file.path)));

    res.json({
      success: true,
      data: {
        videoWithAdvancedAudioPath: resultPath,
        message: 'Advanced audio mixing completed successfully'
      }
    });

  } catch (error) {
    logger.error('Advanced audio mixing failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to apply advanced audio mixing' });
  }
});

// Get popular voice hooks
router.get('/popular', async (req, res) => {
  try {
    const popularHooks = [
      { id: 'intro_attention', name: 'Attention Grabber', category: 'intros', usage: 1250 },
      { id: 'cta_like', name: 'Like & Subscribe', category: 'ctas', usage: 980 },
      { id: 'hook_shocking', name: 'Shocking Fact', category: 'hooks', usage: 750 },
      { id: 'transition_next', name: 'But Wait...', category: 'transitions', usage: 620 },
      { id: 'outro_thanks', name: 'Thank You', category: 'outros', usage: 580 }
    ];

    res.json({
      success: true,
      data: { popularHooks }
    });
  } catch (error) {
    logger.error('Failed to get popular voice hooks', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get popular voice hooks' });
  }
});

// Get voice hook categories
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      {
        id: 'intros',
        name: 'Video Intros',
        description: 'Hook viewers at the start',
        icon: '🎬',
        color: '#4fc3f7'
      },
      {
        id: 'hooks',
        name: 'Attention Hooks',
        description: 'Grab attention instantly',
        icon: '⚡',
        color: '#ff6b35'
      },
      {
        id: 'transitions',
        name: 'Transitions',
        description: 'Smooth scene changes',
        icon: '🔄',
        color: '#81c784'
      },
      {
        id: 'ctas',
        name: 'Call-to-Actions',
        description: 'Drive engagement',
        icon: '📢',
        color: '#ffb74d'
      },
      {
        id: 'outros',
        name: 'Video Outros',
        description: 'Strong closings',
        icon: '🎯',
        color: '#ba68c8'
      },
      {
        id: 'custom',
        name: 'Custom Hooks',
        description: 'Your uploaded voice hooks',
        icon: '🎤',
        color: '#90a4ae'
      }
    ];

    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    logger.error('Failed to get voice hook categories', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get voice hook categories' });
  }
});

// Preview voice hook (get audio file)
router.get('/preview/:hookId', async (req, res) => {
  try {
    const { hookId } = req.params;

    // This would serve the actual audio file
    // For now, return a placeholder response
    res.json({
      success: true,
      data: {
        hookId,
        url: `/api/voice-hooks/audio/${hookId}.mp3`,
        message: 'Voice hook preview URL generated'
      }
    });
  } catch (error) {
    logger.error('Voice hook preview failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to get voice hook preview' });
  }
});

module.exports = router;
