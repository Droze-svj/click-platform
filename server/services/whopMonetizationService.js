/**
 * Whop Monetization Provider Service
 * Focuses on direct API interaction with Whop.
 */

const logger = require('../utils/logger');
const https = require('https');

const WHOP_API_URL = process.env.WHOP_API_URL || 'https://api.whop.com/api/v2';
const WHOP_API_KEY = process.env.WHOP_API_KEY;

/**
 * Fetch products from Whop storefront
 */
async function fetchWhopProducts() {
  if (!WHOP_API_KEY) {
    logger.warn('WHOP_API_KEY not found, using demo products');
    return [
      { id: 'whop_prod_demo_1', name: 'Elite AI Course', price: 99, currency: 'USD', checkout_url: 'https://whop.com/checkout/demo-1' },
      { id: 'whop_prod_demo_2', name: 'Viral Content Masterclass', price: 47, currency: 'USD', checkout_url: 'https://whop.com/checkout/demo-2' },
      { id: 'whop_prod_demo_3', name: 'The Inner Circle', price: 199, currency: 'USD', checkout_url: 'https://whop.com/checkout/demo-3' }
    ];
  }

  return new Promise((resolve) => {
    const options = {
      headers: {
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'accept': 'application/json'
      }
    };

    https.get(`${WHOP_API_URL}/biz/products`, options, (res) => {
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
    }).on('error', (err) => {
      logger.error('Whop API request failed', { error: err.message });
      resolve([]);
    });
  });
}

module.exports = {
  fetchWhopProducts
};
