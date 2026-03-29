const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');
const https = require('https');

/**
 * Task 8.2: Whop/Shopify Monetization Bridge
 * Connects video content to direct sales triggers.
 */

const WHOP_API_URL = process.env.WHOP_API_URL || 'https://api.whop.com/api/v2';
const WHOP_API_KEY = process.env.WHOP_API_KEY;

/**
 * Fetch products from Whop storefront
 */
async function fetchWhopProducts() {
  if (!WHOP_API_KEY) {
    logger.warn('WHOP_API_KEY not found, using demo products');
    return [
      { id: 'whop_prod_demo_1', name: 'Elite AI Course', price: 99, currency: 'usd', checkout_url: 'https://whop.com/checkout/demo-1' },
      { id: 'whop_prod_demo_2', name: 'Viral Content Masterclass', price: 47, currency: 'usd', checkout_url: 'https://whop.com/checkout/demo-2' },
      { id: 'whop_prod_demo_3', name: 'The Inner Circle', price: 199, currency: 'usd', checkout_url: 'https://whop.com/checkout/demo-3' }
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
          resolve(result.products || []);
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

/**
 * AI-driven detection of "High Intent" moments for CTAs
 */
async function detectCheckoutTriggers(transcript) {
  if (!geminiConfigured) {
    // Fallback: search for keywords
    // Fallback: search for keywords
    return [{
      startTime: 15,
      reason: 'Standard mid-roll trigger',
      intentScore: 0.7
    }];
  }

  try {
    const prompt = `Analyze this video transcript and identify moments (start times in seconds) that are "High Intent" for a sale or Call-To-Action.
Look for mentions of results, benefits, or direct calls to "join" or "get".

Transcript: ${transcript}

Return a JSON object with a "triggers" array. Each trigger has:
- startTime (number, seconds)
- reason (why this is high intent)
- intentScore (0 to 1, where 1 is absolute peak intent)

Return only valid JSON.`;

    const content = await geminiGenerate(prompt, { maxTokens: 400 });
    const result = JSON.parse(content || '{}');
    return result.triggers || [];
  } catch (error) {
    logger.error('Checkout trigger detection failed', { error: error.message });
    return [];
  }
}

/**
 * Generate dynamic checkout overlays (Task 8.2)
 */
async function generateMonetizationPlan(transcript, products = []) {
  try {
    const triggers = await detectCheckoutTriggers(transcript);
    const availableProducts = products.length > 0 ? products : await fetchWhopProducts();

    // Map the most relevant product to the best trigger
    const monetizationSteps = triggers.map((trigger, index) => {
      const product = availableProducts[index % availableProducts.length];
      return {
        id: `whop-cta-${Date.now()}-${index}`,
        startTime: trigger.startTime,
        duration: 8,
        product,
        intentScore: trigger.intentScore,
        reason: trigger.reason,
        overlayConfig: {
          type: 'checkout-qr',
          text: `Get ${product.name} - $${product.price}`,
          style: 'glass',
          position: { x: 50, y: 75 }
        }
      };
    });

    return {
      monetizationSteps,
      products: availableProducts,
      totalTriggers: monetizationSteps.length
    };
  } catch (error) {
    logger.error('Monetization plan generation failed', { error: error.message });
    throw error;
  }
}

module.exports = {
  fetchWhopProducts,
  detectCheckoutTriggers,
  generateMonetizationPlan
};
