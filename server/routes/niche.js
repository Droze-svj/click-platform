const express = require('express');
const User = require('../models/User');
const UserPreferences = require('../models/UserPreferences');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const { NICHE_PLAYBOOKS } = require('../services/marketingKnowledge');
const router = express.Router();

// Canonical niche list — derived directly from the marketing playbooks so the
// API never drifts from the AI knowledge base. Every accepted niche maps 1:1
// to a real Gemini playbook.
const VALID_NICHES = Object.keys(NICHE_PLAYBOOKS);

// Primary-goal + platform whitelists for signup personalization. Kept small and
// fixed; anything outside the list is dropped rather than rejecting the signup.
const VALID_GOALS = ['grow_audience', 'more_views', 'monetize', 'save_time', 'build_brand'];
const VALID_PLATFORMS = ['tiktok', 'instagram', 'youtube', 'twitter', 'linkedin', 'facebook'];

// Get niche packs
router.get('/packs', auth, asyncHandler(async (req, res) => {
  const nichePacks = {
    health: {
      name: 'Health & Wellness',
      description: 'Templates and styles optimized for health content',
      templates: [
        { id: 'health-quote-1', name: 'Minimalist Health Quote', style: 'minimalist' },
        { id: 'health-tip-1', name: 'Health Tip Card', style: 'informative' },
        { id: 'health-video-1', name: 'Workout Highlight', style: 'energetic' }
      ],
      colorPalette: ['#4CAF50', '#81C784', '#C8E6C9'],
      hashtags: ['#health', '#wellness', '#fitness', '#nutrition', '#selfcare']
    },
    finance: {
      name: 'Finance & Investing',
      description: 'Professional templates for financial content',
      templates: [
        { id: 'finance-quote-1', name: 'Financial Wisdom Quote', style: 'professional' },
        { id: 'finance-tip-1', name: 'Investment Tip Card', style: 'clean' },
        { id: 'finance-chart-1', name: 'Market Insight', style: 'data-driven' }
      ],
      colorPalette: ['#2196F3', '#64B5F6', '#BBDEFB'],
      hashtags: ['#finance', '#investing', '#money', '#wealth', '#trading']
    },
    education: {
      name: 'Education & Learning',
      description: 'Engaging templates for educational content',
      templates: [
        { id: 'edu-quote-1', name: 'Learning Quote', style: 'inspiring' },
        { id: 'edu-tip-1', name: 'Study Tip Card', style: 'clear' },
        { id: 'edu-video-1', name: 'Tutorial Highlight', style: 'educational' }
      ],
      colorPalette: ['#FF9800', '#FFB74D', '#FFE0B2'],
      hashtags: ['#education', '#learning', '#study', '#knowledge', '#teaching']
    },
    technology: {
      name: 'Technology & Innovation',
      description: 'Modern templates for tech content',
      templates: [
        { id: 'tech-quote-1', name: 'Tech Innovation Quote', style: 'futuristic' },
        { id: 'tech-tip-1', name: 'Tech Tip Card', style: 'modern' },
        { id: 'tech-video-1', name: 'Product Demo', style: 'dynamic' }
      ],
      colorPalette: ['#9C27B0', '#BA68C8', '#E1BEE7'],
      hashtags: ['#technology', '#innovation', '#tech', '#ai', '#startup']
    },
    lifestyle: {
      name: 'Lifestyle & Personal',
      description: 'Vibrant templates for lifestyle content',
      templates: [
        { id: 'lifestyle-quote-1', name: 'Life Quote', style: 'vibrant' },
        { id: 'lifestyle-tip-1', name: 'Lifestyle Tip', style: 'casual' },
        { id: 'lifestyle-video-1', name: 'Day in Life', style: 'authentic' }
      ],
      colorPalette: ['#E91E63', '#F06292', '#F8BBD0'],
      hashtags: ['#lifestyle', '#life', '#personal', '#daily', '#inspiration']
    },
    business: {
      name: 'Business & Entrepreneurship',
      description: 'Professional business templates',
      templates: [
        { id: 'business-quote-1', name: 'Business Quote', style: 'corporate' },
        { id: 'business-tip-1', name: 'Business Tip', style: 'professional' },
        { id: 'business-video-1', name: 'Success Story', style: 'motivational' }
      ],
      colorPalette: ['#607D8B', '#90A4AE', '#CFD8DC'],
      hashtags: ['#business', '#entrepreneurship', '#startup', '#success', '#leadership']
    },
    entertainment: {
      name: 'Entertainment & Media',
      description: 'Fun and engaging entertainment templates',
      templates: [
        { id: 'ent-quote-1', name: 'Entertainment Quote', style: 'fun' },
        { id: 'ent-tip-1', name: 'Trend Alert', style: 'trendy' },
        { id: 'ent-video-1', name: 'Moment Highlight', style: 'dynamic' }
      ],
      colorPalette: ['#F44336', '#E57373', '#FFCDD2'],
      hashtags: ['#entertainment', '#fun', '#viral', '#trending', '#comedy']
    }
  };

  res.json(nichePacks);
}));

// Update user niche
router.put('/select', auth, async (req, res) => {
  try {
    const { niche } = req.body;

    if (!niche) {
      return res.status(400).json({ error: 'Niche is required' });
    }

    if (!VALID_NICHES.includes(niche)) {
      return res.status(400).json({ error: 'Invalid niche' });
    }

    if (req.user && typeof req.user.save === 'function') {
      req.user.niche = niche;
      await req.user.save();
    } else {
      const User = require('../models/User');
      const userDoc = await User.findById(req.userId || req.user?._id || req.user?.id);
      if (userDoc) {
        userDoc.niche = niche;
        await userDoc.save();
        req.user.niche = niche;
      } else {
        req.user.niche = niche;
        if (!req.allowDevMode && !req.user.isDevUser) {
          try {
            const newUserDoc = new User({
              _id: req.userId || req.user?._id || req.user?.id,
              email: req.user.email || 'unknown@example.com',
              name: req.user.name || 'Unknown User',
              password: 'sso-placeholder-password',
              niche: niche
            });
            await newUserDoc.save();
          } catch (e) {
            logger.error('Failed to create user doc for niche selection', e);
          }
        }
      }
    }

    res.json({
      message: 'Niche updated',
      niche: req.user.niche
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's niche pack
router.get('/my-pack', auth, async (req, res) => {
  try {
    const nichePacks = {
      health: {
        name: 'Health & Wellness',
        templates: [
          { id: 'health-quote-1', name: 'Minimalist Health Quote', style: 'minimalist' },
          { id: 'health-tip-1', name: 'Health Tip Card', style: 'informative' }
        ],
        colorPalette: ['#4CAF50', '#81C784', '#C8E6C9'],
        hashtags: ['#health', '#wellness', '#fitness']
      },
      finance: {
        name: 'Finance & Investing',
        templates: [
          { id: 'finance-quote-1', name: 'Financial Wisdom Quote', style: 'professional' }
        ],
        colorPalette: ['#2196F3', '#64B5F6', '#BBDEFB'],
        hashtags: ['#finance', '#investing', '#money']
      },
      other: {
        name: 'Custom',
        templates: [],
        colorPalette: ['#00BCD4'],
        hashtags: []
      }
    };
    
    const userNiche = req.user.niche || 'other';
    const pack = nichePacks[userNiche] || nichePacks.other;

    res.json({
      niche: userNiche,
      pack,
      brandSettings: req.user.brandSettings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update brand settings
router.put('/brand', auth, async (req, res) => {
  try {
    const { primaryColor, secondaryColor, logo, font } = req.body;

    if (!req.user.brandSettings) {
      req.user.brandSettings = {};
    }

    if (primaryColor) req.user.brandSettings.primaryColor = primaryColor;
    if (secondaryColor) req.user.brandSettings.secondaryColor = secondaryColor;
    if (logo) req.user.brandSettings.logo = logo;
    if (font) req.user.brandSettings.font = font;

    if (req.user && typeof req.user.save === 'function') {
      await req.user.save();
    } else {
      const User = require('../models/User');
      const userDoc = await User.findById(req.userId || req.user?._id || req.user?.id);
      if (userDoc) {
        userDoc.brandSettings = req.user.brandSettings;
        await userDoc.save();
      } else {
        if (!req.allowDevMode && !req.user.isDevUser) {
          try {
            const newUserDoc = new User({
              _id: req.userId || req.user?._id || req.user?.id,
              email: req.user.email || 'unknown@example.com',
              name: req.user.name || 'Unknown User',
              password: 'sso-placeholder-password',
              brandSettings: req.user.brandSettings
            });
            await newUserDoc.save();
          } catch (e) {
            logger.error('Failed to create user doc for brand settings', e);
          }
        }
      }
    }

    res.json({
      message: 'Brand settings updated',
      brandSettings: req.user.brandSettings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Signup personalization ────────────────────────────────────────────────
// Called by the register page's step 2 (immediately after the user is signed
// in) to persist niche + primary goal(s) + platform focus in ONE authenticated
// request. Niche becomes a single canonical source: it is written to BOTH
// User.niche (used across the product) AND
// UserPreferences.marketingIntelligence.niche (the canonical marketing-brain
// niche) so generations are tuned from the very first session. Inputs are
// whitelisted; unknown values are dropped rather than failing the request.
router.put('/personalize', auth, async (req, res) => {
  try {
    const { niche, goals, platformFocus } = req.body || {};

    // Niche is the one field we validate strictly — it drives the playbook.
    const cleanNiche = typeof niche === 'string' && VALID_NICHES.includes(niche.toLowerCase().trim())
      ? niche.toLowerCase().trim()
      : null;

    const cleanGoals = Array.isArray(goals)
      ? [...new Set(goals.filter((g) => VALID_GOALS.includes(g)))]
      : [];
    const cleanPlatforms = Array.isArray(platformFocus)
      ? [...new Set(platformFocus.filter((p) => VALID_PLATFORMS.includes(p)))]
      : [];

    if (!cleanNiche && cleanGoals.length === 0 && cleanPlatforms.length === 0) {
      return res.status(400).json({ error: 'Nothing to personalize (provide a valid niche, goals, or platformFocus).' });
    }

    const userId = req.userId || req.user?._id || req.user?.id;

    // 1) Persist niche to the User doc (the product-wide niche).
    if (cleanNiche) {
      if (req.user && typeof req.user.save === 'function') {
        req.user.niche = cleanNiche;
        await req.user.save();
      } else {
        const userDoc = await User.findById(userId);
        if (userDoc) {
          userDoc.niche = cleanNiche;
          await userDoc.save();
        }
        if (req.user) req.user.niche = cleanNiche;
      }
    }

    // 2) Mirror into UserPreferences.marketingIntelligence — the CANONICAL
    //    marketing niche the AI strategist reads — and store goals + platforms.
    const prefsUpdate = {};
    if (cleanNiche) prefsUpdate['marketingIntelligence.niche'] = cleanNiche;
    if (cleanGoals.length) prefsUpdate['marketingIntelligence.goals'] = cleanGoals;
    if (cleanPlatforms.length) prefsUpdate['marketingIntelligence.platformFocus'] = cleanPlatforms;

    if (Object.keys(prefsUpdate).length && userId) {
      await UserPreferences.findOneAndUpdate(
        { userId },
        { $set: prefsUpdate, $setOnInsert: { userId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    res.json({
      message: 'Personalization saved',
      niche: cleanNiche || req.user?.niche || null,
      goals: cleanGoals,
      platformFocus: cleanPlatforms,
    });
  } catch (error) {
    logger.error('Failed to persist signup personalization', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

