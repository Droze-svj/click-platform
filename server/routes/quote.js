const express = require('express');
const sharp = require('sharp');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');
const Content = require('../models/Content');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { extractQuotes } = require('../services/aiService');
const router = express.Router();

// Generate quote cards from content
router.post('/generate', auth, async (req, res) => {
  try {
    const { contentId, quoteText, style } = req.body;

    let content;
    if (contentId) {
      content = await Content.findOne({
        _id: contentId,
        userId: req.user._id
      });
    }

    const quotes = contentId && content
      ? await extractQuotes(content.transcript || content.description, req.user.niche)
      : quoteText ? [{ quote: quoteText, context: '', impact: '' }] : [];

    if (quotes.length === 0) {
      return res.status(400).json({ error: 'No quotes found' });
    }

    // Generate quote cards
    const quoteCards = [];
    for (const quoteData of quotes.slice(0, 5)) { // Limit to 5 cards
      const cardImage = await generateQuoteCard(
        quoteData.quote,
        req.user.name,
        req.user.brandSettings,
        style || 'modern',
        req.user.niche
      );

      quoteCards.push({
        imageUrl: cardImage,
        quote: quoteData.quote,
        author: req.user.name,
        style: style || 'modern'
      });
    }

    // Update content if provided
    if (content) {
      if (!content.generatedContent) {
        content.generatedContent = {};
      }
      content.generatedContent.quoteCards = quoteCards;
      await content.save();
    }

    // Update usage
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'usage.quotesCreated': quoteCards.length }
    });

    res.json({
      message: 'Quote cards generated',
      quoteCards
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function generateQuoteCard(quote, author, brandSettings, style, niche) {
  const width = 1080;
  const height = 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  const primaryColor = brandSettings?.primaryColor || getNicheColor(niche);
  const secondaryColor = brandSettings?.secondaryColor || '#FFFFFF';
  
  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, primaryColor);
  gradient.addColorStop(1, secondaryColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Quote text
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Wrap text
  const maxWidth = width - 200;
  const lineHeight = 60;
  const fontSize = 48;
  ctx.font = `bold ${fontSize}px Arial`;
  
  const words = quote.split(' ');
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine !== '') {
      lines.push(currentLine);
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  });
  if (currentLine) lines.push(currentLine);

  // Draw quote lines
  const startY = height / 2 - (lines.length * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line.trim(), width / 2, startY + index * lineHeight);
  });

  // Author
  ctx.font = '32px Arial';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText(`— ${author}`, width / 2, height - 150);

  // Save image
  const filename = `quote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
  const filepath = path.join(__dirname, '../../uploads/quotes', filename);
  
  const quotesDir = path.dirname(filepath);
  if (!fs.existsSync(quotesDir)) {
    fs.mkdirSync(quotesDir, { recursive: true });
  }

  const buffer = canvas.toBuffer('image/png');
  await sharp(buffer).toFile(filepath);

  return `/uploads/quotes/${filename}`;
}

function getNicheColor(niche) {
  const colors = {
    health: '#4CAF50',
    finance: '#2196F3',
    education: '#FF9800',
    technology: '#9C27B0',
    lifestyle: '#E91E63',
    business: '#607D8B',
    entertainment: '#F44336',
    other: '#00BCD4'
  };
  return colors[niche] || colors.other;
}

// Get quote cards for content
router.get('/content/:contentId', auth, async (req, res) => {
  try {
    const content = await Content.findOne({
      _id: req.params.contentId,
      userId: req.user._id
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    res.json({
      quoteCards: content.generatedContent?.quoteCards || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;







