/**
 * Intelligence Factory Routes
 * ===========================
 * Handles high-fidelity content generation and persistence (Neural Archive).
 * 
 * Mount: /api/intelligence
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
const Script = require('../models/Script');
const { generateContent } = require('../utils/googleAI');

// Middleware
router.use(authenticate);

/**
 * POST /api/intelligence/factory/create
 * Generates a high-resonance content manifest using Gemini.
 */
router.post('/factory/create', async (req, res) => {
  try {
    const { topic, platform, contentType, style, tone, keywords } = req.body;
    
    const prompt = `You are the Sovereign Intelligence Forge, a world-class content architect.
    
    TASK: Create a high-resonance content manifest for a ${platform} ${contentType}.
    TOPIC: ${topic}
    STYLE: ${style}
    TONE: ${tone}
    KEYWORDS: ${keywords?.join(', ') || 'none'}
    
    Requirements:
    1. Provide 3 viral hooks (each with a "Psychological Trigger" description).
    2. Provide a main script/body (structured and engaging).
    3. Provide 2 strong CTAs.
    4. Provide 5 trending hashtags.
    
    Return ONLY a JSON object:
    {
      "hooks": [{"text": "...", "trigger": "..."}],
      "script": "...",
      "cta": ["...", "..."],
      "hashtags": ["...", "..."],
      "resonanceScore": 0-100
    }`;

    const response = await generateContent(prompt, { temperature: 0.8, maxTokens: 2000 });
    const manifest = JSON.parse(response || '{}');
    
    res.json({ success: true, data: manifest });
  } catch (error) {
    logger.error('Forge Factory creation error', { error: error.message, userId: req.user.id });
    res.status(500).json({ success: false, error: 'Forge synthesis failed. Signal lost.' });
  }
});

/**
 * POST /api/intelligence/factory/save
 * Saves a generated manifest to the Neural Archive.
 */
router.post('/factory/save', async (req, res) => {
  try {
    const { manifest, topic, platform } = req.body;
    
    const newScript = new Script({
      userId: req.user.id,
      title: `${topic || 'Untitled'} - ${platform}`,
      type: 'social-media',
      topic: topic,
      script: manifest.script,
      metadata: {
        hashtags: manifest.hashtags,
        hooks: manifest.hooks, // We'll store hooks in metadata or extend the schema
      },
      status: 'completed'
    });

    await newScript.save();
    res.json({ success: true, data: newScript });
  } catch (error) {
    logger.error('Forge Factory save error', { error: error.message, userId: req.user.id });
    res.status(500).json({ success: false, error: 'Failed to archive manifest.' });
  }
});

/**
 * GET /api/intelligence/factory/history
 * Retrieves the last 10 manifest manifests from the Neural Archive.
 */
router.get('/factory/history', async (req, res) => {
  try {
    const history = await Script.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(10);
      
    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('Forge Factory history error', { error: error.message, userId: req.user.id });
    res.status(500).json({ success: false, error: 'Failed to retrieve archive.' });
  }
});

module.exports = router;
