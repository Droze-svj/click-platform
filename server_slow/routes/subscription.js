const express = require('express');
const axios = require('axios');
const User = require('../models/User');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const router = express.Router();

// Verify WHOP subscription
router.post('/verify', auth, async (req, res) => {
  try {
    const { whopUserId, whopSubscriptionId } = req.body;

    if (!whopSubscriptionId) {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    logger.info('Verifying WHOP subscription', { userId: req.user._id, whopSubscriptionId });

    // Verify with WHOP API
    const whopResponse = await axios.get(
      `${process.env.WHOP_API_URL}/subscriptions/${whopSubscriptionId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHOP_API_KEY}`
        }
      }
    );

    const subData = whopResponse.data;
    const isActive = ['active', 'trialing'].includes(subData.status);

    if (isActive) {
      req.user.whopUserId = whopUserId;
      req.user.subscription = {
        status: 'active',
        plan: (subData.plan_id || subData.plan?.id || 'pro').toLowerCase(),
        startDate: new Date(subData.created_at || Date.now()),
        endDate: new Date(subData.expires_at || Date.now() + 30 * 24 * 60 * 60 * 1000),
        whopSubscriptionId: whopSubscriptionId
      };
      
      await req.user.save();

      logger.info('Subscription verified successfully', { 
        userId: req.user._id, 
        tier: req.user.subscription.plan 
      });

      res.json({
        success: true,
        message: 'Subscription verified',
        subscription: req.user.subscription
      });
    } else {
      logger.warn('Subscription verify failed: Inactive status', { 
        userId: req.user._id, 
        status: subData.status 
      });
      res.status(403).json({ error: `Subscription is ${subData.status}. Please reactivate at Whop.` });
    }
  } catch (error) {
    logger.error('WHOP verification error', { 
      error: error.response?.data || error.message, 
      userId: req.user._id 
    });
    res.status(500).json({ error: 'Failed to verify subscription with Whop' });
  }
});

// Get subscription status
router.get('/status', auth, async (req, res) => {
  const statusPromise = (async () => {
    try {
      const userId = req.user?._id || req.user?.id;
      const host = req.headers.host || req.headers['x-forwarded-host'] || '';
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
      const allowDevMode = process.env.NODE_ENV !== 'production' || isLocalhost;

      // Developer bypass for testing - instant response
      if (allowDevMode && userId && (String(userId).startsWith('dev-') || String(userId) === 'dev-user-123')) {
        return {
          subscription: {
            status: 'active',
            plan: 'pro',
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          },
          usage: req.user.usage || {}
        };
      }

      return {
        subscription: req.user.subscription || { status: 'none', plan: 'free' },
        usage: req.user.usage || {}
      };
    } catch (err) {
      throw err;
    }
  })();

  // 2s timeout for critical dashboard load
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('TIMEOUT')), 2000)
  );

  try {
    const result = await Promise.race([statusPromise, timeoutPromise]);
    res.json(result);
  } catch (err) {
    logger.error('Subscription status error or timeout', { error: err.message, userId: req.user?._id });
    // Aggressive fallback to prevent dashboard blank screen
    res.json({
      subscription: { status: 'active', plan: 'pro', isFallback: true },
      usage: {}
    });
  }
});

// Webhook handler for WHOP events
router.post('/webhook', async (req, res) => {
  try {
    const { action, data } = req.body;
    
    // Whop API v2 uses 'action' instead of 'event' in some cases
    const eventType = action || req.body.event;

    logger.info('WHOP Webhook received', { eventType, subscriptionId: data?.id });

    if (['subscription.created', 'subscription.updated', 'membership.went_active'].includes(eventType)) {
      const user = await User.findOne({ 
        $or: [
          { whopSubscriptionId: data.id },
          { whopUserId: data.user_id },
          { email: data.user?.email }
        ]
      });

      if (user) {
        user.subscription = {
          status: ['active', 'trialing'].includes(data.status) ? 'active' : 'cancelled',
          plan: (data.plan_id || 'pro').toLowerCase(),
          startDate: new Date(data.created_at || Date.now()),
          endDate: new Date(data.expires_at || Date.now()),
          whopSubscriptionId: data.id
        };
        await user.save();
        logger.info('User subscription updated via webhook', { userId: user._id, status: user.subscription.status });
      }
    }

    if (['subscription.deleted', 'membership.went_inactive'].includes(eventType)) {
      const user = await User.findOne({ whopSubscriptionId: data.id });
      if (user) {
        user.subscription.status = 'expired';
        await user.save();
        logger.info('User subscription expired via webhook', { userId: user._id });
      }
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('WHOP Webhook processing critical failure', { error: error.message });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;

