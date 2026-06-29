/**
 * Whop webhook handler — POST /api/webhooks/whop
 *
 * Mounted in server/index.js with `express.raw({ type: 'application/json' })`
 * BEFORE the global express.json() so the HMAC signature verifies against
 * the unparsed body.
 *
 * Configure in your Whop dashboard:
 *   - URL:    ${APP_URL}/api/webhooks/whop
 *   - Events: payment.succeeded, membership.went_valid,
 *             membership.went_invalid, subscription.cancelled, payment.failed
 *   - Secret: paste into WHOP_WEBHOOK_SECRET env var
 */

const express = require('express');
const logger = require('../../utils/logger');
const User = require('../../models/User');
const WebhookEvent = require('../../models/WebhookEvent');
const { verifySignature, processEvent } = require('../../services/whopWebhookService');

const router = express.Router();

/**
 * Best-effort idempotency: returns true if this is the first time we've
 * seen (provider, eventId). Uses MongoDB's unique index as the race-safe
 * "claim" — the duplicate insert throws E11000, which we treat as "already
 * processed, skip." If the eventId is missing we skip the check (and log)
 * rather than reject — better to risk a rare double-apply than to lose a
 * legit event with malformed metadata.
 */
async function claimEvent(provider, eventId, eventType) {
  if (!eventId) return { claimed: true, missingId: true };
  try {
    await WebhookEvent.create({ provider, eventId, eventType, processed: false });
    return { claimed: true };
  } catch (err) {
    if (err && err.code === 11000) {
      // Already claimed. Only a record that was actually PROCESSED is a true
      // duplicate to skip; an unprocessed one means a prior attempt died between
      // claim and apply (or two retries raced) — let this attempt re-process so a
      // paid entitlement is never permanently dropped. Re-applies are idempotent
      // for our handlers (set subscription.status=active, etc.).
      try {
        const existing = await WebhookEvent.findOne({ provider, eventId }).select('processed').lean();
        if (existing && existing.processed) return { claimed: false, duplicate: true };
        return { claimed: true, retryUnprocessed: true };
      } catch (lookupErr) {
        logger.warn('[whop-webhook] claim lookup failed, allowing through', { error: lookupErr.message });
        return { claimed: true, claimError: lookupErr.message };
      }
    }
    // Unexpected DB error — err on the side of processing so a Mongo blip
    // doesn't drop a payment event.
    logger.warn('[whop-webhook] claimEvent error, allowing through', { error: err.message });
    return { claimed: true, claimError: err.message };
  }
}

// Mark the claimed event processed (idempotent) once apply succeeded, so future
// retries of the SAME event become safe no-ops.
async function markProcessed(provider, eventId, result) {
  if (!eventId) return;
  try {
    await WebhookEvent.updateOne({ provider, eventId }, { $set: { processed: true, result } });
  } catch (err) {
    logger.warn('[whop-webhook] markProcessed failed', { eventId, error: err.message });
  }
}

router.post('/', async (req, res) => {
  const signature =
    req.headers['x-whop-signature'] ||
    req.headers['X-Whop-Signature'] ||
    req.headers['whop-signature'] ||
    '';
  const secret = process.env.WHOP_WEBHOOK_SECRET || '';

  // Body is a Buffer because the parent app mounts express.raw on this path.
  const rawBody = req.body && Buffer.isBuffer(req.body) ? req.body : Buffer.from('');

  if (!secret) {
    logger.error('[whop-webhook] WHOP_WEBHOOK_SECRET not configured — rejecting');
    return res.status(503).json({ error: 'webhook-not-configured' });
  }

  if (!verifySignature(rawBody, signature, secret)) {
    logger.warn('[whop-webhook] signature mismatch', {
      hasSignature: Boolean(signature),
      bodyLen: rawBody.length,
    });
    return res.status(401).json({ error: 'invalid-signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch (err) {
    logger.warn('[whop-webhook] invalid JSON', { error: err.message });
    return res.status(400).json({ error: 'invalid-json' });
  }

  // Idempotency claim. Whop's canonical event id lives at event.id; some
  // payloads only carry id under data.id, so accept both.
  const eventId = event?.id || event?.data?.id || null;
  const eventType = event?.action || event?.type || 'unknown';
  const claim = await claimEvent('whop', eventId, eventType);
  if (!claim.claimed && claim.duplicate) {
    logger.info('[whop-webhook] duplicate event, skipping', { eventId, eventType });
    return res.json({ received: true, duplicate: true, eventId });
  }

  try {
    const result = await processEvent(event, { User });
    if (!result.ok) {
      // 200 even on user-not-found — Whop will retry indefinitely on
      // non-2xx, and we don't want to retry forever for an event that
      // truly has no matching user.
      logger.info('[whop-webhook] event-skipped', result);
      return res.json({ received: true, ...result });
    }
    // Apply succeeded → mark processed so retries of this exact event no-op.
    await markProcessed('whop', eventId, result);
    logger.info('[whop-webhook] event-applied', result);
    return res.json({ received: true, ...result });
  } catch (err) {
    logger.error('[whop-webhook] processing error', { error: err.message, stack: err.stack });
    // Return 500 so Whop retries — handler-side bug, not an event-level no-op.
    return res.status(500).json({ error: 'processing-error' });
  }
});

module.exports = router;
// Exported for tests (two-phase idempotency).
module.exports.claimEvent = claimEvent;
module.exports.markProcessed = markProcessed;
