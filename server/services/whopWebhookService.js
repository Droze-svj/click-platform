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
 * Resolves the planId ('creator', 'pro', 'agency') and period ('monthly', 'yearly')
 * from a Whop webhook event, using all available signals:
 *  1. Configured productMap (WHOP_PRODUCT_ID_*)
 *  2. Direct plan ID if it is a canonical tier name
 *  3. Metadata fields (metadata.planId, metadata.plan, metadata.tier, metadata.packageId)
 *  4. Product / Plan titles or names (e.g. "Pro Yearly", "Creator Monthly", "Agency")
 *  5. Price heuristic ($39/390, $119/1190, $349/3490)
 *  6. Fallback to existing user subscription plan (for recurring renewals)
 */
function resolvePlanFromEvent(event, user = null) {
  const d = event?.data || {};
  const productMap = getProductMap();

  const rawProductId =
    d.product_id ||
    d.plan_id ||
    event?.product_id ||
    event?.plan_id ||
    null;

  // 1. Direct match in configured product map
  if (rawProductId && productMap[rawProductId]) {
    return productMap[rawProductId];
  }

  const canonicalTiers = ['creator', 'pro', 'agency'];

  // 2. Direct canonical tier ID
  if (rawProductId && canonicalTiers.includes(String(rawProductId).toLowerCase())) {
    const period = /year|annual/i.test(String(d.billing_period || d.period || '')) ? 'yearly' : 'monthly';
    return { planId: String(rawProductId).toLowerCase(), period };
  }

  // 3. Metadata fields
  const meta = d.metadata || event?.metadata || {};
  const metaPlan = meta.planId || meta.plan || meta.tier || meta.packageId || meta.product;
  if (metaPlan) {
    const pStr = String(metaPlan).toLowerCase();
    for (const t of canonicalTiers) {
      if (pStr.includes(t)) {
        const periodStr = String(meta.period || meta.billingCycle || d.billing_period || '').toLowerCase();
        const period = /year|annual/.test(periodStr) ? 'yearly' : 'monthly';
        return { planId: t, period };
      }
    }
  }

  // 4. Inspect name / title / description in product / plan objects or top-level
  const textSignals = [
    d.product_name,
    d.plan_name,
    d.name,
    d.title,
    d.product?.name,
    d.plan?.name,
    event?.product_name,
    event?.plan_name,
    d.description,
  ].filter(Boolean).map(s => String(s).toLowerCase()).join(' ');

  if (textSignals) {
    let detectedPlan = null;
    if (/\bagency\b/.test(textSignals)) detectedPlan = 'agency';
    else if (/\bpro\b/.test(textSignals)) detectedPlan = 'pro';
    else if (/\bcreator\b/.test(textSignals)) detectedPlan = 'creator';

    if (detectedPlan) {
      const period = /\b(yearly|annual|year)\b/.test(textSignals) ? 'yearly' : 'monthly';
      return { planId: detectedPlan, period };
    }
  }

  // 5. Price heuristic (standard Click pricing)
  const amount = getEventAmount(event);
  if (amount != null) {
    if (amount >= 3400 || amount === 349) {
      return { planId: 'agency', period: amount >= 3400 ? 'yearly' : 'monthly' };
    }
    if (amount >= 1100 || amount === 119) {
      return { planId: 'pro', period: amount >= 1100 ? 'yearly' : 'monthly' };
    }
    if (amount >= 350 || amount === 39) {
      return { planId: 'creator', period: amount >= 350 ? 'yearly' : 'monthly' };
    }
  }

  // 6. Existing user subscription plan preservation (for renewals)
  if (user?.subscription?.plan && canonicalTiers.includes(user.subscription.plan)) {
    return {
      planId: user.subscription.plan,
      period: user.subscription.billingCycle || 'monthly',
    };
  }

  return null;
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
 * Best-effort extraction of an event's source timestamp (ms since epoch).
 * Whop payloads don't carry a single canonical field, so we try the common
 * ones and accept ISO strings, epoch-seconds, or epoch-millis. Returns null
 * when nothing usable is present — callers must treat null as "unknown", never
 * as "oldest", so a missing timestamp can't cause a legit event to be dropped.
 */
function getEventTime(event) {
  const raw =
    event?.data?.updated_at ||
    event?.data?.created_at ||
    event?.updated_at ||
    event?.created_at ||
    event?.timestamp ||
    null;
  if (raw == null) return null;
  let ms;
  if (typeof raw === 'number') {
    ms = raw < 1e12 ? raw * 1000 : raw; // seconds vs millis heuristic
  } else {
    ms = Date.parse(raw);
  }
  return Number.isFinite(ms) ? ms : null;
}

/**
 * The amount a Whop payment event carries, normalized to major units.
 *
 * Whop has sent amounts under several keys across API versions, and some
 * integrations report minor units (cents). Returns null when no amount is
 * present — an invoice with a guessed total is worse than no invoice.
 */
function getEventAmount(event) {
  const d = event?.data || {};
  const raw = d.final_amount ?? d.amount ?? d.subtotal ?? d.total ?? event?.amount ?? null;
  if (raw == null) return null;
  const num = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(num)) return null;

  // `amount_in_cents`/`currency_minor` style fields mean the value is minor units.
  const isMinor = d.amount_in_cents != null || d.currency_minor === true;
  return isMinor ? num / 100 : num;
}

/**
 * Persist a paid invoice to BillingHistory.
 *
 * Nothing in the codebase created these documents, so billingHistoryService —
 * and every endpoint behind it (/billing/history, /billing/summary,
 * /billing/invoices/:n, and the PDF download) — read an always-empty collection.
 * The subscription state was recorded on the User; the money never was.
 *
 * Idempotent on the Whop transaction id so a webhook replay (Whop retries, and
 * the receipt table is replay-safe by design) cannot double-invoice.
 *
 * Never throws: a bookkeeping failure must not fail the webhook and cause Whop
 * to retry a payment that was already applied to the user's plan.
 */
async function recordBillingHistory({ user, event, mapping, subId, stampTime }) {
  try {
    const BillingHistory = require('../models/BillingHistory');

    const transactionId = event?.data?.id || event?.id || subId || null;
    if (transactionId) {
      const existing = await BillingHistory.findOne({ 'payment.transactionId': transactionId }).select('_id').lean();
      if (existing) {
        logger.info('[whop] billing history already recorded for this transaction', { transactionId });
        return;
      }
    }

    const amount = getEventAmount(event);
    if (amount == null) {
      // Record the event without inventing a total: the invoice exists and is
      // marked as needing reconciliation rather than showing a made-up figure.
      logger.warn('[whop] payment event carried no recognizable amount — invoice recorded without a total', {
        transactionId, userId: user._id?.toString(),
      });
    }

    const currency = (event?.data?.currency || 'USD').toUpperCase();
    const date = stampTime || new Date();

    await BillingHistory.create({
      userId: user._id,
      invoice: {
        date,
        period: mapping?.period === 'yearly'
          ? { start: date, end: new Date(new Date(date).setFullYear(date.getFullYear() + 1)) }
          : { start: date, end: new Date(new Date(date).setMonth(date.getMonth() + 1)) },
        amount: {
          subtotal: amount,
          tax: 0,
          discount: 0,
          total: amount,
          currency,
        },
        items: [{
          description: `Click ${mapping?.planId || 'subscription'} (${mapping?.period || 'monthly'})`,
          quantity: 1,
          unitPrice: amount,
          total: amount,
        }],
      },
      payment: {
        method: 'other', // Whop does not report the underlying instrument here.
        transactionId,
        status: 'completed',
        paidAt: date,
      },
      subscription: { billingCycle: mapping?.period === 'yearly' ? 'yearly' : 'monthly' },
      // 'draft' (not 'paid') when no amount came through, so an invoice with no
      // total is visibly incomplete and can be reconciled rather than presented
      // to the customer as a finished record. ('pending' is not in this enum.)
      status: amount == null ? 'draft' : 'paid',
    });

    logger.info('[whop] billing history recorded', { userId: user._id?.toString(), transactionId, amount, currency });
  } catch (error) {
    logger.error('[whop] failed to record billing history (payment itself was applied)', {
      error: error.message, userId: user._id?.toString(),
    });
  }
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

  // Ordering guard (now ON by default; set WHOP_WEBHOOK_ORDERING_GUARD=false to
  // disable). The two-phase idempotency layer stops a *processed* event from
  // re-applying, but not an out-of-order or replayed *older* event — e.g. a
  // delayed `payment.succeeded` arriving AFTER a `cancelled` would re-grant the
  // tier. This drops any event provably older than the last one applied to this
  // user. It only ever skips when BOTH the incoming and the stored timestamps are
  // known, so it can never drop a first/only event or one from a provider that
  // omits timestamps.
  const orderingGuard = process.env.WHOP_WEBHOOK_ORDERING_GUARD !== 'false';
  const eventTime = orderingGuard ? getEventTime(event) : null;
  if (orderingGuard && eventTime != null) {
    const lastAt = user.subscription?.lastEventAt
      ? new Date(user.subscription.lastEventAt).getTime()
      : null;
    if (lastAt != null && eventTime < lastAt) {
      logger.info('[whop] dropping out-of-order event', {
        eventType, userId: user._id?.toString(), eventTime, lastAt,
      });
      return { ok: true, action: eventType, stale: true, userId: user._id.toString() };
    }
  }
  const stampTime = eventTime != null ? new Date(eventTime) : null;

  const productId =
    event?.data?.product_id ||
    event?.data?.plan_id ||
    event?.product_id ||
    event?.plan_id ||
    null;
  const subId = event?.data?.id || event?.data?.subscription_id || event?.id || null;
  const mapping = resolvePlanFromEvent(event, user);

  switch (eventType) {
  case 'payment.succeeded':
  case 'payment_succeeded':
  case 'membership.went_valid':
  case 'membership_went_valid':
  case 'subscription.created':
  case 'subscription_created': {
    if (!mapping) {
      logger.warn('[whop] payment event without recognised product_id or plan metadata', {
        productId, eventType, userId: user._id?.toString(),
      });
      // Still mark active so the user isn't locked out.
      user.subscription = user.subscription || {};
      user.subscription.status = 'active';
      const amount = getEventAmount(event);
      if (!user.subscription.plan || user.subscription.plan === 'free') {
        if (amount && amount > 0) {
          user.subscription.plan = 'pro'; // Generous fallback for paying customers
        }
      }
      if (subId) user.subscription.whopSubscriptionId = subId;
      if (event?.data?.user_id && !user.whopUserId) user.whopUserId = event.data.user_id;
      if (stampTime) user.subscription.lastEventAt = stampTime;
      await user.save();

      if (eventType === 'payment.succeeded' || eventType === 'payment_succeeded') {
        await recordBillingHistory({
          user,
          event,
          mapping: { planId: user.subscription.plan || 'pro', period: 'monthly' },
          subId,
          stampTime,
        });
      }

      return { ok: true, action: eventType, userId: user._id.toString(), plan: user.subscription.plan || 'unknown' };
    }

    user.subscription = user.subscription || {};
    user.subscription.plan = mapping.planId;
    user.subscription.billingCycle = mapping.period;
    user.subscription.status = 'active';
    user.subscription.startDate = user.subscription.startDate || new Date();

    const periodEnd =
      event?.data?.expires_at ||
      event?.data?.current_period_end ||
      event?.expires_at ||
      event?.current_period_end ||
      null;
    if (periodEnd) {
      user.subscription.endDate = new Date(periodEnd);
    } else {
      const calcEnd = new Date();
      if (mapping.period === 'yearly') {
        calcEnd.setFullYear(calcEnd.getFullYear() + 1);
      } else {
        calcEnd.setMonth(calcEnd.getMonth() + 1);
      }
      user.subscription.endDate = calcEnd;
    }

    if (subId) user.subscription.whopSubscriptionId = subId;
    if (event?.data?.user_id && !user.whopUserId) user.whopUserId = event.data.user_id;
    if (stampTime) user.subscription.lastEventAt = stampTime;
    await user.save();

    // Record the money.
    if (eventType === 'payment.succeeded' || eventType === 'payment_succeeded') {
      await recordBillingHistory({ user, event, mapping, subId, stampTime });
    }

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
    const periodEnd =
      event?.data?.expires_at ||
      event?.data?.current_period_end ||
      event?.expires_at ||
      event?.current_period_end ||
      null;
    if (periodEnd) {
      user.subscription.endDate = new Date(periodEnd);
    } else if (!user.subscription.endDate) {
      user.subscription.endDate = new Date();
    }
    if (stampTime) user.subscription.lastEventAt = stampTime;
    await user.save();
    return { ok: true, action: eventType, userId: user._id.toString(), plan: user.subscription.plan };
  }

  case 'payment.refunded':
  case 'payment_refunded':
  case 'dispute.created':
  case 'dispute_created': {
    user.subscription = user.subscription || {};
    user.subscription.status = 'refunded';
    user.subscription.plan = 'free';
    user.subscription.endDate = new Date();
    if (stampTime) user.subscription.lastEventAt = stampTime;
    await user.save();

    try {
      const BillingHistory = require('../models/BillingHistory');
      const amount = getEventAmount(event);
      const currency = (
        event?.data?.currency ||
        event?.currency ||
        'USD'
      ).toUpperCase();
      const date = stampTime || new Date();
      const transactionId =
        event?.data?.payment_id ||
        event?.data?.id ||
        event?.id ||
        `REF-${Date.now()}`;

      await BillingHistory.create({
        userId: user._id,
        invoice: {
          date,
          period: { start: date, end: date },
          amount: {
            subtotal: amount != null ? -Math.abs(amount) : 0,
            tax: 0,
            discount: 0,
            total: amount != null ? -Math.abs(amount) : 0,
            currency,
          },
          items: [{
            description: `14-Day Refund Processed (${eventType})`,
            quantity: 1,
            unitPrice: amount != null ? -Math.abs(amount) : 0,
            total: amount != null ? -Math.abs(amount) : 0,
          }],
        },
        payment: {
          method: 'other',
          transactionId: String(transactionId),
          status: 'refunded',
          paidAt: date,
          refundedAt: date,
          refundAmount: amount != null ? Math.abs(amount) : 0,
        },
        subscription: {
          billingCycle: user.subscription?.billingCycle || 'monthly',
        },
        status: 'refunded',
      });
      logger.info('[whop] refund event recorded in billing history', { userId: user._id?.toString(), transactionId, amount });
    } catch (err) {
      logger.error('[whop] failed to log refund in billing history', { error: err.message, userId: user._id?.toString() });
    }

    return { ok: true, action: eventType, userId: user._id.toString(), plan: 'free' };
  }

  default:
    return { ok: true, action: eventType, ignored: true };
  }
}

module.exports = {
  verifySignature,
  getProductMap,
  resolvePlanFromEvent,
  resolveUser,
  processEvent,
  getEventTime,
};
