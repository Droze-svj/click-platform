const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Get niche packs
router.get('/packs', auth, async (req, res) => {
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
});

// Update user niche
router.put('/select', auth, async (req, res) => {
  try {
    const { niche } = req.body;

    if (!niche) {
      return res.status(400).json({ error: 'Niche is required' });
    }

    const validNiches = ['health', 'finance', 'education', 'technology', 'lifestyle', 'business', 'entertainment', 'other'];
    if (!validNiches.includes(niche)) {
      return res.status(400).json({ error: 'Invalid niche' });
    }

    req.user.niche = niche;
    await req.user.save();

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

    await req.user.save();

    res.json({
      message: 'Brand settings updated',
      brandSettings: req.user.brandSettings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

