// Voice cloning and the digital twin process biometric data (a voiceprint,
// facial geometry). The privacy policy promises recorded, affirmative consent
// before that happens (BIPA / EU AI Act); POST /api/digital-twin/consent
// records it, but nothing checked it. These routes now require it.

const logger = require('../utils/logger');

module.exports = async function requireBiometricConsent(req, res, next) {
  try {
    const userId = req.user && (req.user._id || req.user.id);
    const UserSettings = require('../models/UserSettings');
    const settings = await UserSettings.findOne({ userId }).select('agentic.biometricConsent').lean();
    if (settings && settings.agentic && settings.agentic.biometricConsent === true) return next();
    return res.status(403).json({
      success: false,
      code: 'BIOMETRIC_CONSENT_REQUIRED',
      error: 'Voice and face features need your consent first. Record it with POST /api/digital-twin/consent.',
    });
  } catch (err) {
    logger.error('[biometric-consent] check failed', { error: err.message });
    return res.status(500).json({ success: false, error: 'Could not check consent' });
  }
};
