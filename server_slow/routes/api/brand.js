const express = require('express');
const router = express.Router();
const brandService = require('../../services/brandService');

/**
 * @route GET /api/brand/profiles
 * @desc Fetch all brand profiles for the current user including elite presets.
 */
router.get('/profiles', async (req, res) => {
  try {
    const userId = req.user?.id || 'mock-user-123';
    const profiles = await brandService.getProfiles(userId);
    res.json({ success: true, data: profiles });
  } catch (error) {
    console.error('Error fetching brand profiles:', error);
    res.status(500).json({ success: false, message: 'Neural Archive Retrieval Failed' });
  }
});

/**
 * @route POST /api/brand/profiles
 * @desc Save a new brand profile (Train DNA).
 */
router.post('/profiles', async (req, res) => {
  try {
    const userId = req.user?.id || 'mock-user-123';
    const profileData = req.body;
    const newProfile = await brandService.saveProfile(userId, profileData);
    res.json({ success: true, data: newProfile });
  } catch (error) {
    console.error('Error saving brand profile:', error);
    res.status(500).json({ success: false, message: 'DNA Capture Failed' });
  }
});

/**
 * @route POST /api/brand/evolve
 * @desc Evolve current DNA based on session telemetry.
 */
router.post('/evolve', async (req, res) => {
  try {
    const { currentDNA, telemetryHistory } = req.body;
    const evolvedDNA = await brandService.evolveDNA(currentDNA, telemetryHistory);
    res.json({ success: true, data: evolvedDNA });
  } catch (error) {
    console.error('Error evolving DNA:', error);
    res.status(500).json({ success: false, message: 'Sentiment Drift Calculation Failed' });
  }
});

module.exports = router;
