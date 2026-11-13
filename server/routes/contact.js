const express = require('express');
const ContactMessage = require('../models/ContactMessage');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { createRateLimiter } = require('../middleware/enhancedRateLimiter');
const logger = require('../utils/logger');

const router = express.Router();

// Public: someone who can't sign in must still be able to reach us (support,
// billing, privacy and erasure requests). Tight per-IP limit against spam.
const contactLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many messages. Please try again later.' },
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOPICS = new Set(['support', 'billing', 'privacy', 'sales', 'other']);

/**
 * POST /api/contact  { name?, email, topic?, message, website? }
 * `website` is a honeypot: people never fill it; bots do.
 */
router.post('/', contactLimiter, asyncHandler(async (req, res) => {
  const { name = '', email = '', topic = 'other', message = '', website = '' } = req.body || {};
  if (website) return sendSuccess(res, 'Message received', 201, {}); // bot: pretend
  const cleanEmail = String(email).trim();
  const cleanMessage = String(message).trim();
  if (!EMAIL.test(cleanEmail) || cleanEmail.length > 254) return sendError(res, 'Enter a valid email address so we can reply.', 400);
  if (cleanMessage.length < 10) return sendError(res, 'Tell us a little more (at least 10 characters).', 400);
  if (cleanMessage.length > 5000) return sendError(res, 'Keep the message under 5,000 characters.', 400);

  // Optional: attach the signed-in account (no auth required to write).
  let userId;
  try {
    const header = String(req.headers.authorization || '');
    if (header.startsWith('Bearer ')) {
      const jwt = require('jsonwebtoken');
      const { getJwtSecret } = require('../utils/jwtSecret');
      const payload = jwt.verify(header.slice(7), getJwtSecret());
      if (payload && payload.userId && require('mongoose').Types.ObjectId.isValid(payload.userId)) userId = payload.userId;
    }
  } catch (_) { /* anonymous is fine */ }

  const doc = await ContactMessage.create({
    name: String(name).trim().slice(0, 120),
    email: cleanEmail,
    topic: TOPICS.has(topic) ? topic : 'other',
    message: cleanMessage,
    ...(userId ? { userId } : {}),
  });
  logger.info('[contact] message received', { id: String(doc._id), topic: doc.topic });
  return sendSuccess(res, 'Message received', 201, { id: String(doc._id) });
}));

module.exports = router;
