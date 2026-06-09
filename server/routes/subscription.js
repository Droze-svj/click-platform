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
      // Derive the plan from the canonical Whop product map — NEVER hardcode
      // 'pro'. An unknown/unmapped product means we cannot prove a paid tier,
      // so we record the membership as active on 'free' rather than granting Pro.
      const { getProductMap } = require('../services/whopWebhookService');
      const productId = subData.plan_id || subData.product_id || subData.plan?.id || null;
      const mapping = productId ? getProductMap()[productId] : null;
      if (!mapping) {
        logger.warn('Subscription verify: unmapped Whop product, defaulting to free', { userId: req.user._id, productId });
      }
      const resolvedPlan = mapping ? mapping.planId : 'free';

      req.user.whopUserId = whopUserId;
      req.user.subscription = {
        status: 'active',
        plan: resolvedPlan,
        startDate: new Date(subData.created_at || Date.now()),
        endDate: new Date(subData.expires_at || Date.now() + 30 * 24 * 60 * 60 * 1000),
        whopSubscriptionId: whopSubscriptionId
      };
      
      if (req.user && typeof req.user.save === 'function') {
        await req.user.save();
      } else {
        const User = require('../models/User');
        const userDoc = await User.findById(req.userId || req.user?._id || req.user?.id);
        if (userDoc) {
          userDoc.whopUserId = whopUserId;
          userDoc.subscription = req.user.subscription;
          await userDoc.save();
        } else {
          if (!req.allowDevMode && !req.user.isDevUser) {
            try {
              const newUserDoc = new User({
                _id: req.userId || req.user?._id || req.user?.id,
                email: req.user.email || 'unknown@example.com',
                name: req.user.name || 'Unknown User',
                password: 'sso-placeholder-password',
                whopUserId: whopUserId,
                subscription: req.user.subscription
              });
              await newUserDoc.save();
            } catch (e) {
              logger.error('Failed to create user doc for subscription settings', e);
            }
          }
        }
      }

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
    const userId = req.user?._id || req.user?.id;
    const host = req.headers.host || req.headers['x-forwarded-host'] || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const allowDevMode = process.env.NODE_ENV !== 'production' || isLocalhost;

    // Developer bypass for testing — instant response. Gated strictly on
    // NON-PRODUCTION + dev user id so production can never receive a free Pro.
    if (process.env.NODE_ENV !== 'production' && allowDevMode && userId &&
        (String(userId).startsWith('dev-') || String(userId) === 'dev-user-123')) {
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

    // Surface the canonical resolved tier alongside the raw subscription so the
    // client doesn't have to re-derive it (and so trial⇒pro is honoured here).
    const entitlements = require('../config/entitlements');
    const tier = entitlements.resolveTier(req.user || {});
    return {
      subscription: req.user.subscription || { status: 'none', plan: 'free' },
      tier,
      usage: req.user.usage || {}
    };
  })();

  // 2s timeout for critical dashboard load
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => 
    timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), 2000)
  );

  try {
    const result = await Promise.race([
      statusPromise.then((res) => {
        clearTimeout(timeoutId);
        return res;
      }),
      timeoutPromise
    ]);
    res.json(result);
  } catch (err) {
    clearTimeout(timeoutId);
    logger.error('Subscription status error or timeout', { error: err.message, userId: req.user?._id });
    // SECURITY: never grant Pro on error/timeout. Fail to the LEAST-privileged
    // honest answer — the user's real plan if we have it on the attached doc,
    // else 'free'. Only non-production dev sessions get the generous fallback.
    if (process.env.NODE_ENV !== 'production') {
      return res.json({
        subscription: req.user?.subscription || { status: 'active', plan: 'pro', isFallback: true },
        tier: 'pro',
        usage: req.user?.usage || {},
        isFallback: true
      });
    }
    let tier = 'free';
    try {
      tier = require('../config/entitlements').resolveTier(req.user || {});
    } catch (_) { tier = 'free'; }
    res.json({
      subscription: req.user?.subscription || { status: 'none', plan: 'free' },
      tier,
      usage: req.user?.usage || {},
      isFallback: true
    });
  }
});

// RETIRED: legacy UNSIGNED webhook.
//
// This handler previously accepted unauthenticated POSTs and granted plans
// (defaulting to 'pro') with NO signature verification — a trivial way for
// anyone to upgrade any account. It is replaced by the canonical signed
// handler at POST /api/webhooks/whop (server/routes/webhooks/whop.js), which
// verifies the Whop HMAC signature and maps products via the canonical
// product map. We return 410 Gone so any stale Whop dashboard config fails
// loudly instead of silently granting access.
router.post('/webhook', (req, res) => {
  logger.warn('[subscription] hit RETIRED unsigned /subscription/webhook — use /api/webhooks/whop', {
    ip: req.ip,
  });
  return res.status(410).json({
    error: 'gone',
    message: 'This endpoint has been retired. Configure your Whop webhook to POST /api/webhooks/whop (signed).',
  });
});

module.exports = router;

