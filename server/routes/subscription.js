const express = require('express');
const axios = require('axios');
const User = require('../models/User');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const router = express.Router();

// Verify WHOP subscription
router.post('/verify', auth, async (req, res) => {
  try {
    // NOTE: whopUserId is intentionally NOT read from the body — it can only be
    // set by the signed webhook. Accepting it here would let a caller claim
    // another account's Whop identity.
    const { whopSubscriptionId } = req.body;

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

    // SECURITY: this route must NOT grant paid entitlements. A body-supplied
    // `whopSubscriptionId` proves nothing about the caller — anyone could pass
    // ANY active paid subscription id (their own on a throwaway account, a
    // friend's, a leaked/shared one) and self-upgrade to Pro/Agency for free,
    // and a single valid sub id could upgrade unlimited accounts. Likewise the
    // body-supplied `whopUserId` must never be written (identity-claim /
    // mass-assignment). Paid tiers are applied ONLY by the signed Whop webhook
    // (/api/webhooks/whop -> whopWebhookService.processEvent), which binds the
    // subscription to the correct user via passthrough/user_id/email — exactly
    // like the retired unsigned /subscription/webhook and /billing/complete
    // self-grant paths. Here we only REPORT the Whop-side status; we never write
    // req.user.subscription or req.user.whopUserId.
    logger.info('Subscription verify (report-only; grants happen via signed webhook)', {
      userId: req.user._id, whopStatus: subData.status,
    });
    return res.json({
      success: true,
      message: isActive
        ? 'Subscription is active on Whop. Entitlements are applied automatically via the secure webhook.'
        : `Subscription is ${subData.status}. Please reactivate at Whop.`,
      whopStatus: subData.status,
      subscription: req.user.subscription || { status: 'none', plan: 'free' },
    });
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

