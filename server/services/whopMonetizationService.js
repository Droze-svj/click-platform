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

module.exports = {
  fetchWhopProducts
};
