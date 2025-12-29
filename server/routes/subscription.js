const express = require('express');
const axios = require('axios');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Verify WHOP subscription
router.post('/verify', auth, async (req, res) => {
  try {
    const { whopUserId, whopSubscriptionId } = req.body;

    // Verify with WHOP API
    const whopResponse = await axios.get(
      `${process.env.WHOP_API_URL}/subscriptions/${whopSubscriptionId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHOP_API_KEY}`
        }
      }
    );

    if (whopResponse.data.status === 'active') {
      req.user.whopUserId = whopUserId;
      req.user.subscription = {
        status: 'active',
        plan: whopResponse.data.plan || 'monthly',
        startDate: new Date(whopResponse.data.created_at),
        endDate: new Date(whopResponse.data.expires_at),
        whopSubscriptionId: whopSubscriptionId
      };
      await req.user.save();

      res.json({ 
        message: 'Subscription verified',
        subscription: req.user.subscription
      });
    } else {
      res.status(403).json({ error: 'Subscription not active' });
    }
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('WHOP verification error', { error: error.message, userId: req.user._id });
    res.status(500).json({ error: 'Failed to verify subscription' });
  }
});

// Get subscription status
router.get('/status', auth, async (req, res) => {
  res.json({
    subscription: req.user.subscription,
    usage: req.user.usage
  });
});

// Webhook handler for WHOP events
router.post('/webhook', async (req, res) => {
  try {
    const { event, data } = req.body;

    if (event === 'subscription.created' || event === 'subscription.updated') {
      const user = await User.findOne({ whopSubscriptionId: data.id });
      if (user) {
        user.subscription = {
          status: data.status === 'active' ? 'active' : 'cancelled',
          plan: data.plan || 'monthly',
          startDate: new Date(data.created_at),
          endDate: new Date(data.expires_at),
          whopSubscriptionId: data.id
        };
        await user.save();
      }
    }

    if (event === 'subscription.deleted') {
      const user = await User.findOne({ whopSubscriptionId: data.id });
      if (user) {
        user.subscription.status = 'expired';
        await user.save();
      }
    }

    res.json({ received: true });
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Webhook error', { error: error.message, event: req.body.event });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;

