/**
 * Whop Monetization Provider Service
 * Focuses on direct API interaction with Whop.
 */

const logger = require('../utils/logger');
const https = require('https');

const WHOP_API_URL = process.env.WHOP_API_URL || 'https://api.whop.com/api/v2';

async function fetchWhopProducts() {
  const WHOP_API_KEY = process.env.WHOP_API_KEY;
  // HONEST CONTRACT: with no key we return an EMPTY catalog (not fabricated
  // "demo" products with fake checkout URLs that could mislead or mis-charge).
  if (!WHOP_API_KEY) {
    logger.warn('WHOP_API_KEY not configured — returning empty product catalog');
    return [];
  }

  return new Promise((resolve) => {
    const options = {
      headers: {
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'accept': 'application/json'
      },
      timeout: 10000, // never let a hung Whop API stall the caller
    };

    const request = https.get(`${WHOP_API_URL}/biz/products`, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          // Standardize to internal format
          const standardized = (result.products || []).map(p => ({
            id: p.id,
            name: p.name,
            price: p.price || 0,
            currency: p.currency || 'USD',
            checkout_url: p.checkout_url || `https://whop.com/checkout/${p.id}`
          }));
          resolve(standardized);
        } catch (e) {
          logger.error('Failed to parse Whop products', { error: e.message });
          resolve([]);
        }
      });
    });
    request.on('timeout', () => {
      logger.error('Whop API request timed out');
      request.destroy(new Error('Whop API request timed out'));
    });
    request.on('error', (err) => {
      logger.error('Whop API request failed', { error: err.message });
      resolve([]);
    });
  });
}

/**
 * Refund a Whop payment.
 *
 * HONEST CONTRACT: this either performs a real refund and returns the
 * provider's own transaction id, or it reports failure. It never synthesizes an
 * id — a caller must not be able to mark money as returned when it wasn't.
 *
 * Returns { success, transactionId, reason, configured } rather than throwing,
 * so the caller can persist an accurate state either way.
 *
 * @param {string} receiptId Whop receipt/payment id to refund
 * @param {object} [opts]
 * @param {number} [opts.amount] partial amount; omit to refund in full
 * @returns {Promise<{success:boolean, transactionId:string|null, reason:string|null, configured:boolean}>}
 */
async function refundWhopPayment(receiptId, opts = {}) {
  const WHOP_API_KEY = process.env.WHOP_API_KEY;

  if (!WHOP_API_KEY) {
    return {
      success: false, transactionId: null, configured: false,
      reason: 'WHOP_API_KEY is not configured — refunds must be issued manually in the Whop dashboard.',
    };
  }
  if (!receiptId) {
    return {
      success: false, transactionId: null, configured: true,
      reason: 'No Whop receipt id recorded for this subscription — cannot target a refund.',
    };
  }

  const payload = JSON.stringify(opts.amount ? { amount: opts.amount } : {});

  return new Promise((resolve) => {
    const url = new URL(`${WHOP_API_URL}/receipts/${encodeURIComponent(receiptId)}/refund`);
    const request = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'accept': 'application/json',
      },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let body = {};
        try { body = JSON.parse(data || '{}'); } catch { /* non-JSON error body */ }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          const transactionId = body.id || body.refund_id || body.receipt_id || null;
          if (!transactionId) {
            // A 2xx with no id we recognize: do NOT invent one. Treat as failed
            // so it lands in the operator queue and can be reconciled by hand.
            logger.error('Whop refund succeeded but returned no recognizable id', { receiptId, body });
            return resolve({
              success: false, transactionId: null, configured: true,
              reason: 'Whop accepted the refund but returned no transaction id — verify in the dashboard.',
            });
          }
          logger.info('Whop refund issued', { receiptId, transactionId });
          return resolve({ success: true, transactionId, reason: null, configured: true });
        }

        const reason = body.error || body.message || `Whop refund failed with HTTP ${res.statusCode}`;
        logger.error('Whop refund failed', { receiptId, statusCode: res.statusCode, reason });
        resolve({ success: false, transactionId: null, reason, configured: true });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Whop refund request timed out'));
    });
    request.on('error', (err) => {
      logger.error('Whop refund request error', { receiptId, error: err.message });
      resolve({ success: false, transactionId: null, reason: err.message, configured: true });
    });

    request.write(payload);
    request.end();
  });
}

module.exports = {
  fetchWhopProducts,
  refundWhopPayment
};
