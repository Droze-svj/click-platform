const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { mongoUserId } = require('../../utils/userKey');
const brandService = require('../../services/brandService');
const logger = require('../../utils/logger');

// Every route here reads or writes a user's own Style DNA, so all of them are
// authenticated. This file previously had no auth at all and fell back to a
// literal `'mock-user-123'` id, which meant any unauthenticated caller read and
// wrote one shared bucket — that is why it was never mounted.
router.use(auth);

/**
 * @route GET /api/brand/profiles
 * @desc Fetch the built-in elite presets plus this user's own brand profiles.
 */
router.get('/profiles', async (req, res) => {
  try {
    const profiles = await brandService.getProfiles(mongoUserId(req));
    res.json({ success: true, data: profiles });
  } catch (error) {
    logger.error('Error fetching brand profiles:', error);
    res.status(500).json({ success: false, message: 'Failed to load brand profiles' });
  }
});

/**
 * @route POST /api/brand/profiles
 * @desc Save a new brand profile (Train DNA) owned by the current user.
 */
router.post('/profiles', async (req, res) => {
  try {
    const newProfile = await brandService.saveProfile(mongoUserId(req), req.body);
    res.status(201).json({ success: true, data: newProfile });
  } catch (error) {
    logger.error('Error saving brand profile:', error);
    res.status(500).json({ success: false, message: 'Failed to save brand profile' });
  }
});

/**
 * @route DELETE /api/brand/profiles/:profileId
 * @desc Delete one of the current user's own profiles. Scoped by userId, so a
 *       caller cannot delete another user's profile; presets are not deletable.
 */
router.delete('/profiles/:profileId', async (req, res) => {
  try {
    const result = await brandService.deleteProfile(mongoUserId(req), req.params.profileId);
    if (!result.success) {
      return res.status(404).json({ success: false, message: 'Brand profile not found' });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting brand profile:', error);
    res.status(500).json({ success: false, message: 'Failed to delete brand profile' });
  }
});

/**
 * @route POST /api/brand/evolve
 * @desc Evolve a DNA vector from accepted-edit telemetry. Pure computation on
 *       the supplied payload — no stored state is read or written.
 */
router.post('/evolve', async (req, res) => {
  try {
    const { currentDNA, telemetryHistory } = req.body || {};
    if (!currentDNA || typeof currentDNA !== 'object') {
      return res.status(400).json({ success: false, message: 'currentDNA is required' });
    }
    const evolvedDNA = await brandService.evolveDNA(currentDNA, telemetryHistory);
    res.json({ success: true, data: evolvedDNA });
  } catch (error) {
    logger.error('Error evolving DNA:', error);
    res.status(500).json({ success: false, message: 'Failed to evolve brand DNA' });
  }
});

module.exports = router;
