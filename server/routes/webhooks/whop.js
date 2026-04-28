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
const { verifySignature, processEvent } = require('../../services/whopWebhookService');

const router = express.Router();

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

  try {
    const result = await processEvent(event, { User });
    if (!result.ok) {
      // 200 even on user-not-found — Whop will retry indefinitely on
      // non-2xx, and we don't want to retry forever for an event that
      // truly has no matching user.
      logger.info('[whop-webhook] event-skipped', result);
      return res.json({ received: true, ...result });
    }
    logger.info('[whop-webhook] event-applied', result);
    return res.json({ received: true, ...result });
  } catch (err) {
    logger.error('[whop-webhook] processing error', { error: err.message, stack: err.stack });
    // Return 500 so Whop retries — handler-side bug, not an event-level no-op.
    return res.status(500).json({ error: 'processing-error' });
  }
});

module.exports = router;
