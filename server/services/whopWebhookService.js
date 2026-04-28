/**
 * Whop webhook service — pure functions for verifying signatures and
 * routing inbound Whop events to the right user-update.
 *
 * The HTTP route lives at server/routes/webhooks/whop.js. This file is
 * the pure-logic layer so it's unit-testable without spinning up Express.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Verify a Whop webhook HMAC signature.
 * Whop signs the raw request body with HMAC-SHA256 using the webhook
 * secret you configure in their dashboard. They send it in the
 * `x-whop-signature` header (lowercase typical, but case-insensitive).
 *
 * @param {string|Buffer} rawBody - the request body BEFORE JSON parsing
 * @param {string} signature       - value of the x-whop-signature header
 * @param {string} secret          - WHOP_WEBHOOK_SECRET env var
 * @returns {boolean} true if the signature is valid, false otherwise
 */
function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody.toString() : String(rawBody);
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

  // timingSafeEqual throws on length mismatch — short-circuit first.
  if (signature.length !== expected.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Build the canonical map from Whop product IDs → { planId, period }.
 * Read at request time (not module-load) so env-var rotation works
 * without a server restart.
 */
function getProductMap() {
  const env = process.env;
  const map = {};
  const entries = [
    ['creator', 'monthly', env.WHOP_PRODUCT_ID_CREATOR_MONTHLY],
    ['creator', 'yearly', env.WHOP_PRODUCT_ID_CREATOR_YEARLY],
    ['pro', 'monthly', env.WHOP_PRODUCT_ID_PRO_MONTHLY],
    ['pro', 'yearly', env.WHOP_PRODUCT_ID_PRO_YEARLY],
    ['agency', 'monthly', env.WHOP_PRODUCT_ID_AGENCY_MONTHLY],
    ['agency', 'yearly', env.WHOP_PRODUCT_ID_AGENCY_YEARLY],
  ];
  for (const [planId, period, productId] of entries) {
    if (productId) map[productId] = { planId, period };
  }
  return map;
}

/**
 * Resolve the user a Whop event applies to.
 * Tries (in order): explicit metadata.passthrough, top-level user_id,
 * then email match. Returns the user document or null.
 */
async function resolveUser(event, User) {
  const passthrough =
    event?.data?.metadata?.passthrough ||
    event?.metadata?.passthrough ||
    event?.data?.passthrough ||
    null;

  if (passthrough && /^[0-9a-f]{24}$/i.test(passthrough)) {
    const u = await User.findById(passthrough).catch(() => null);
    if (u) return u;
  }

  const whopUserId = event?.data?.user_id || event?.user_id || null;
  if (whopUserId) {
    const u = await User.findOne({ whopUserId }).catch(() => null);
    if (u) return u;
  }

  const email = event?.data?.email || event?.data?.user_email || event?.email || null;
  if (email) {
    const u = await User.findOne({ email: email.toLowerCase().trim() }).catch(() => null);
    if (u) return u;
  }

  return null;
}

/**
 * Process a single Whop event and apply it to the user.
 * Returns { ok, action, userId, plan } for logging.
 *
 * Side effect: mutates and saves the User document.
 */
async function processEvent(event, deps) {
  const { User } = deps;
  const eventType = event?.action || event?.type || 'unknown';

  const user = await resolveUser(event, User);
  if (!user) {
    return { ok: false, action: eventType, reason: 'user-not-found' };
  }

  const productId =
    event?.data?.product_id ||
    event?.data?.plan_id ||
    event?.product_id ||
    event?.plan_id ||
    null;
  const subId = event?.data?.id || event?.data?.subscription_id || event?.id || null;
  const productMap = getProductMap();
  const mapping = productId ? productMap[productId] : null;

  switch (eventType) {
  case 'payment.succeeded':
  case 'payment_succeeded':
  case 'membership.went_valid':
  case 'membership_went_valid':
  case 'subscription.created':
  case 'subscription_created': {
    if (!mapping) {
      logger.warn('[whop] payment event without recognised product_id', { productId, eventType, userId: user._id?.toString() });
      // Still mark active so the user isn't locked out, but on Free.
      user.subscription = user.subscription || {};
      user.subscription.status = 'active';
      if (subId) user.subscription.whopSubscriptionId = subId;
      await user.save();
      return { ok: true, action: eventType, userId: user._id.toString(), plan: 'unknown' };
    }
    user.subscription = user.subscription || {};
    user.subscription.plan = mapping.planId;
    user.subscription.status = 'active';
    user.subscription.startDate = new Date();
    if (subId) user.subscription.whopSubscriptionId = subId;
    if (event?.data?.user_id && !user.whopUserId) user.whopUserId = event.data.user_id;
    await user.save();
    return { ok: true, action: eventType, userId: user._id.toString(), plan: mapping.planId, period: mapping.period };
  }

  case 'membership.went_invalid':
  case 'membership_went_invalid':
  case 'subscription.cancelled':
  case 'subscription_cancelled':
  case 'payment.failed':
  case 'payment_failed': {
    user.subscription = user.subscription || {};
    user.subscription.status = 'cancelled';
    const periodEnd = event?.data?.expires_at || event?.data?.current_period_end;
    if (periodEnd) user.subscription.endDate = new Date(periodEnd);
    await user.save();
    return { ok: true, action: eventType, userId: user._id.toString(), plan: user.subscription.plan };
  }

  default:
    return { ok: true, action: eventType, ignored: true };
  }
}

module.exports = {
  verifySignature,
  getProductMap,
  resolveUser,
  processEvent,
};
