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

const WEBHOOK_TOLERANCE_SEC = 5 * 60;

/**
 * Verify an inbound Whop webhook request.
 *
 * Whop signs with the Standard Webhooks scheme: headers `webhook-id`,
 * `webhook-timestamp` and `webhook-signature`; HMAC-SHA256 over
 * `${webhook-id}.${webhook-timestamp}.${rawBody}`; header value `v1,<base64>`,
 * possibly several space-separated values while a secret is being rotated. The
 * HMAC key is the `ws_…` secret exactly as the Whop dashboard shows it — Whop's
 * docs say the prefix must NOT be stripped. A `whsec_` secret is also accepted
 * the Standard Webhooks way (base64-decode what follows the prefix).
 *
 * Click used to check only a hex HMAC of the body in an `x-whop-signature`
 * header, which Whop does not send, so every real webhook was rejected with
 * 401 and no purchase ever upgraded an account. That scheme is kept only as a
 * fallback for anything still signing the old way.
 *
 * @returns {{ ok: boolean, scheme: 'standard'|'legacy'|null, reason?: string }}
 */
function verifyWebhookRequest(rawBody, headers = {}, secret, { now = Date.now(), toleranceSec = WEBHOOK_TOLERANCE_SEC } = {}) {
  if (!secret) return { ok: false, scheme: null, reason: 'no-secret' };

  const header = (name) => {
    const v = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '');

  const id = header('webhook-id');
  const timestamp = header('webhook-timestamp');
  const signatureHeader = header('webhook-signature');

  if (id && timestamp && signatureHeader) {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return { ok: false, scheme: 'standard', reason: 'bad-timestamp' };
    // Reject stale or future-dated deliveries so a captured request can't be replayed.
    if (Math.abs(now / 1000 - ts) > toleranceSec) {
      return { ok: false, scheme: 'standard', reason: 'timestamp-outside-tolerance' };
    }

    const keys = [Buffer.from(String(secret), 'utf8')];
    if (/^whsec_/.test(String(secret))) keys.push(Buffer.from(String(secret).slice(6), 'base64'));

    const signedContent = `${id}.${timestamp}.${body}`;
    const expected = keys.map((key) => crypto.createHmac('sha256', key).update(signedContent).digest());
    const provided = String(signatureHeader)
      .split(' ')
      .map((part) => part.trim())
      .filter((part) => part.startsWith('v1,'))
      .map((part) => Buffer.from(part.slice(3), 'base64'))
      .filter((buf) => buf.length > 0);

    for (const candidate of provided) {
      for (const want of expected) {
        if (candidate.length === want.length && crypto.timingSafeEqual(candidate, want)) {
          return { ok: true, scheme: 'standard' };
        }
      }
    }
    return { ok: false, scheme: 'standard', reason: 'signature-mismatch' };
  }

  const legacySignature = header('x-whop-signature') || header('whop-signature');
  if (legacySignature) {
    return verifySignature(body, legacySignature, secret)
      ? { ok: true, scheme: 'legacy' }
      : { ok: false, scheme: 'legacy', reason: 'signature-mismatch' };
  }

  return { ok: false, scheme: null, reason: 'missing-signature-headers' };
}

// ── Whop payload accessors ───────────────────────────────────────────────────
// Whop's current (v1) webhooks nest related records — data.plan.id,
// data.product.id, data.user.{id,email} — where older payloads used flat
// data.plan_id / product_id / user_id / email. Reading only the flat fields
// meant a real v1 purchase matched no plan and no user and was silently
// skipped. Each accessor reads the nested shape first, accepts a related record
// given as a bare id string, and keeps the flat legacy field as a fallback.
const idOf = (value) => (value && typeof value === 'object' ? value.id : value) || null;

function planIdOf(event) {
  const d = event?.data || {};
  return idOf(d.plan) || d.plan_id || idOf(d.membership?.plan) || event?.plan_id || null;
}

function productIdOf(event) {
  const d = event?.data || {};
  return idOf(d.product) || idOf(d.access_pass) || d.product_id || idOf(d.membership?.product) || event?.product_id || null;
}

function whopUserOf(event) {
  const d = event?.data || {};
  const user = d.user && typeof d.user === 'object' ? d.user : {};
  return {
    id: user.id || (typeof d.user === 'string' ? d.user : null) || d.user_id || event?.user_id || null,
    email: user.email || d.email || d.user_email || event?.email || null,
  };
}

/**
 * Normalise a Whop time value to a Date. Membership `renewal_period_end` is a
 * Unix timestamp in SECONDS; `new Date(seconds)` would land in January 1970, so
 * numbers below 1e12 are treated as seconds. ISO strings and millis also work.
 */
function toDate(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return Number.isFinite(raw.getTime()) ? raw : null;
  let ms;
  if (typeof raw === 'number' || /^\d+(\.\d+)?$/.test(String(raw))) {
    const n = Number(raw);
    ms = n < 1e12 ? n * 1000 : n;
  } else {
    ms = Date.parse(raw);
  }
  return Number.isFinite(ms) ? new Date(ms) : null;
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
  // One id configured for two plan/periods — typically a product id pasted into
  // both the MONTHLY and YEARLY slots — used to be silently overwritten by the
  // later entry, so every monthly purchase was recorded as yearly. An ambiguous
  // id is left out of the map; resolution then falls through to the plan id,
  // metadata, names and price, which can still tell the periods apart.
  const seen = new Map();
  for (const [planId, period, productId] of entries) {
    if (!productId) continue;
    seen.set(productId, seen.has(productId) ? null : { planId, period });
  }
  const ambiguous = [];
  for (const [id, value] of seen) {
    if (value) map[id] = value;
    else ambiguous.push(id);
  }
  if (ambiguous.length) {
    logger.warn('[whop] the same id is configured for more than one plan/period — ignoring it for plan mapping', { ids: ambiguous });
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

  // Candidate ids, most specific first. A Whop PLAN id is unique to one price
  // and billing period; a PRODUCT id is shared by that product's monthly and
  // yearly plans. Matching the product first meant a two-plan product could
  // never resolve both periods correctly.
  const candidates = [planIdOf(event), productIdOf(event)].filter(Boolean);

  // 1. Direct match in configured product map
  for (const id of candidates) {
    if (productMap[id]) return productMap[id];
  }

  const canonicalTiers = ['creator', 'pro', 'agency'];

  // 2. Direct canonical tier ID
  const canonical = candidates.find((id) => canonicalTiers.includes(String(id).toLowerCase()));
  if (canonical) {
    const period = /year|annual/i.test(String(d.billing_period || d.period || '')) ? 'yearly' : 'monthly';
    return { planId: String(canonical).toLowerCase(), period };
  }

  // 3. Metadata. Whop v1 carries metadata on the payment/membership AND on its
  // plan and product. Tagging a Whop plan with click_plan / click_period is the
  // most robust mapping of all: it travels with the plan and needs no env var.
  const metas = [d.metadata, d.plan?.metadata, d.product?.metadata, d.membership?.metadata, event?.metadata]
    .filter((m) => m && typeof m === 'object');
  for (const meta of metas) {
    const metaPlan = meta.click_plan || meta.planId || meta.plan || meta.tier || meta.packageId || meta.product;
    if (!metaPlan) continue;
    const pStr = String(metaPlan).toLowerCase();
    for (const t of canonicalTiers) {
      if (pStr.includes(t)) {
        const periodStr = String(meta.click_period || meta.period || meta.billingCycle || d.billing_period || '').toLowerCase();
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
    d.product?.title,
    d.plan?.name,
    d.plan?.title,
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
  const metas = [event?.data?.metadata, event?.metadata, event?.data?.membership?.metadata]
    .filter((m) => m && typeof m === 'object');
  const passthrough =
    metas.map((m) => m.passthrough || m.click_user_id).find(Boolean) ||
    event?.data?.passthrough ||
    null;

  if (passthrough && /^[0-9a-f]{24}$/i.test(passthrough)) {
    const u = await User.findById(passthrough).catch(() => null);
    if (u) return u;
  }

  // Nested v1 `data.user.{id,email}` first, flat legacy fields as fallback.
  // Reading only the flat fields meant every v1 event found no user.
  const { id: whopUserId, email } = whopUserOf(event);
  if (whopUserId) {
    const u = await User.findOne({ whopUserId }).catch(() => null);
    if (u) return u;
  }

  if (email) {
    const u = await User.findOne({ email: String(email).toLowerCase().trim() }).catch(() => null);
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
  // v1 payloads put the event name in `type`; older ones used `action`.
  const eventType = event?.type || event?.action || 'unknown';

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

  const productId = planIdOf(event) || productIdOf(event);
  const subId = event?.data?.id || event?.data?.subscription_id || event?.id || null;
  const mapping = resolvePlanFromEvent(event, user);

  switch (eventType) {
  // Whop v1 renamed went_valid → activated. Without the membership.activated
  // cases a v1 membership activation hit `default` and was ignored.
  case 'payment.succeeded':
  case 'payment_succeeded':
  case 'membership.activated':
  case 'membership_activated':
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
      // No tier is invented here. This branch used to set plan='pro' for ANY
      // unrecognised paid event, so buying an unrelated Whop product — the
      // configured video-minutes add-on, say — granted Pro. An unmatched
      // purchase leaves the plan unchanged and is logged above for review.
      if (subId) user.subscription.whopSubscriptionId = subId;
      if (whopUserOf(event).id && !user.whopUserId) user.whopUserId = whopUserOf(event).id;
      if (stampTime) user.subscription.lastEventAt = stampTime;
      await user.save();

      if (eventType === 'payment.succeeded' || eventType === 'payment_succeeded') {
        await recordBillingHistory({
          user,
          event,
          mapping: null,
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

    // v1 memberships report the period end as `renewal_period_end` in Unix
    // SECONDS; toDate() normalises that, ISO strings and millis alike.
    const periodEnd = toDate(
      event?.data?.renewal_period_end ??
      event?.data?.expires_at ??
      event?.data?.current_period_end ??
      event?.expires_at ??
      event?.current_period_end ??
      null
    );
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
    if (whopUserOf(event).id && !user.whopUserId) user.whopUserId = whopUserOf(event).id;
    if (stampTime) user.subscription.lastEventAt = stampTime;
    await user.save();

    // Record the money.
    if (eventType === 'payment.succeeded' || eventType === 'payment_succeeded') {
      await recordBillingHistory({ user, event, mapping, subId, stampTime });
    }

    return { ok: true, action: eventType, userId: user._id.toString(), plan: mapping.planId, period: mapping.period };
  }

  // Whop v1 renamed went_invalid → deactivated. Without these cases a cancelled
  // or expired membership was ignored and the customer kept their paid tier.
  case 'membership.deactivated':
  case 'membership_deactivated':
  case 'membership.went_invalid':
  case 'membership_went_invalid':
  case 'subscription.cancelled':
  case 'subscription_cancelled':
  case 'payment.failed':
  case 'payment_failed': {
    user.subscription = user.subscription || {};
    user.subscription.status = 'cancelled';
    // v1 memberships report the period end as `renewal_period_end` in Unix
    // SECONDS; toDate() normalises that, ISO strings and millis alike.
    const periodEnd = toDate(
      event?.data?.renewal_period_end ??
      event?.data?.expires_at ??
      event?.data?.current_period_end ??
      event?.expires_at ??
      event?.current_period_end ??
      null
    );
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
    // 'cancelled', not 'refunded': subscription.status is enum
    // ['active','cancelled','expired','trial'], so 'refunded' failed validation
    // on save — the handler threw, Whop got a 500, and the refunded customer
    // kept their paid tier. The refund itself is recorded in BillingHistory.
    user.subscription.status = 'cancelled';
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
  verifyWebhookRequest,
  planIdOf,
  productIdOf,
  whopUserOf,
  toDate,
  getProductMap,
  resolvePlanFromEvent,
  resolveUser,
  processEvent,
  getEventTime,
};
