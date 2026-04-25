const logger = require('../utils/logger');
const https = require('https');

/**
 * Shopify Monetization Provider Service
 * Focuses on direct API interaction with Shopify Admin API.
 */

// Strip https:// or http:// if present in the store URL
const RAW_STORE_URL = process.env.SHOPIFY_STORE_URL || '';
const SHOPIFY_STORE_URL = RAW_STORE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

/**
 * Fetch products from Shopify storefront
 */
async function fetchShopifyProducts() {
  if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE_URL) {
    logger.warn('SHOPIFY credentials not found, using demo products');
    return [
      { id: 'shopify_prod_demo_1', name: 'Sovereign Capsule Tee', price: 35, currency: 'USD', checkout_url: 'https://demo-store.myshopify.com/cart/423423423:1' },
      { id: 'shopify_prod_demo_2', name: 'Executive AI Planner', price: 25, currency: 'USD', checkout_url: 'https://demo-store.myshopify.com/cart/534534534:1' },
      { id: 'shopify_prod_demo_3', name: 'Digital Nomad Bundle', price: 150, currency: 'USD', checkout_url: 'https://demo-store.myshopify.com/cart/645645645:1' }
    ];
  }

  return new Promise((resolve) => {
    // Standard Shopify Admin API pattern for fetching products
    const options = {
      hostname: SHOPIFY_STORE_URL,
      path: '/admin/api/2024-01/products.json?limit=10',
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          // Standardize to internal platform format
          const standardized = (result.products || []).map(p => ({
            id: p.id.toString(),
            name: p.title,
            price: p.variants?.[0]?.price || 0,
            currency: 'USD', // Usually configurable in Shopify context
            checkout_url: `https://${SHOPIFY_STORE_URL}/cart/${p.variants?.[0]?.id}:1`
          }));
          resolve(standardized);
        } catch (e) {
          logger.error('Failed to parse Shopify products', { error: e.message });
          resolve([]);
        }
      });
    }).on('error', (err) => {
      logger.error('Shopify API request failed', { error: err.message });
      resolve([]);
    });
  });
}

module.exports = {
  fetchShopifyProducts
};
