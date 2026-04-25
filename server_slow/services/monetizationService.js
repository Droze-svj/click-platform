const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');
const whopService = require('./whopMonetizationService');
const shopifyService = require('./shopifyMonetizationService');
const MonetizationPlan = require('../models/MonetizationPlan');

/**
 * Task 8.2: Multi-Provider Monetization Bridge (Refined)
 * Unified service for Whop and Shopify with persistence support.
 */

/**
 * AI-driven detection of "High Intent" moments for CTAs (CENTRALIZED)
 */
async function detectCheckoutTriggers(transcript) {
  if (!geminiConfigured) {
    logger.warn('Gemini not configured, using fallback triggers');
    return [{
      startTime: 15,
      reason: 'Standard mid-roll trigger (AI Fallback)',
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
 * Fetch products from the specified provider
 */
async function fetchProducts(provider = 'whop') {
  try {
    if (provider === 'whop') {
      return await whopService.fetchWhopProducts();
    } else if (provider === 'shopify') {
      return await shopifyService.fetchShopifyProducts();
    } else {
      logger.warn(`Unknown monetization provider requested: ${provider}`);
      return [];
    }
  } catch (error) {
    logger.error(`Failed to fetch products for provider ${provider}`, { error: error.message });
    return [];
  }
}

/**
 * Generate and PERSIST a monetization plan for content
 */
async function generateAndPersistPlan(userId, contentId, transcript, options = {}) {
  const { provider = 'whop', customProducts = [] } = options;

  try {
    // 1. Detect triggers via AI
    const rawTriggers = await detectCheckoutTriggers(transcript);
    
    // 2. Fetch products
    const availableProducts = customProducts.length > 0 
      ? customProducts 
      : await fetchProducts(provider || 'whop');
    
    // 3. Map available products to triggers and format for DB
    const triggers = availableProducts.length > 0
      ? rawTriggers.map((trig, index) => {
        const product = availableProducts[index % availableProducts.length];
        const checkoutUrl = product.checkout_url || (product.id ? `https://${provider}.com/checkout/${product.id}` : '#');
        
        return {
          startTime: trig.startTime,
          duration: 10,
          intentScore: trig.intentScore,
          reason: trig.reason,
          productId: product.id,
          productName: product.name,
          productPrice: product.price,
          productCurrency: product.currency || 'USD',
          checkoutUrl,
          overlayConfig: {
            type: 'checkout-qr',
            text: `Get ${product.name}`,
            price: product.price,
            style: 'neural-glass',
            position: { x: 50, y: 70 },
            provider
          }
        };
      })
      : [];

    // 4. Save to Database (Upsert per content/user)
    const plan = await MonetizationPlan.findOneAndUpdate(
      { userId, contentId },
      {
        provider: provider || 'whop',
        triggers,
        status: 'draft',
        metadata: { transcriptUsed: transcript.substring(0, 1000) },
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    logger.info('Monetization plan persisted', { planId: plan._id, userId, contentId });
    return plan;
  } catch (error) {
    logger.error('Failed to generate and persist monetization plan', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Update an existing monetization plan (allows for manual trigger editing)
 */
async function updateMonetizationPlan(userId, planId, updates) {
  try {
    const plan = await MonetizationPlan.findOne({ _id: planId, userId });
    if (!plan) throw new Error('Plan not found or unauthorized');

    if (updates.triggers) plan.triggers = updates.triggers;
    if (updates.status) plan.status = updates.status;
    if (updates.provider) plan.provider = updates.provider;

    await plan.save();
    return plan;
  } catch (error) {
    logger.error('Failed to update monetization plan', { error: error.message, planId });
    throw error;
  }
}

/**
 * Get the latest monetization plan for a piece of content
 */
async function getPlanByContent(userId, contentId) {
  return MonetizationPlan.findOne({ userId, contentId }).sort({ updatedAt: -1 });
}

/**
 * Autonomous Yield Optimization Pivot (Phase 21)
 * Detects misalignment between content sentiment and product inlays.
 */
async function triggerYieldOptimizationPivot(userId, contentId) {
  try {
    const plan = await MonetizationPlan.findOne({ userId, contentId });
    if (!plan || plan.status === 'locked') return { pivoted: false, reason: 'Plan locked or missing' };

    const communityAgentService = require('./communityAgentService');
    const sentimentEngine = require('./sentimentEngine');
    
    // 1. Get current community resonance for products
    const communityStatus = await communityAgentService.getStatus(userId);
    const topArchetypes = communityStatus.telemetry?.lastPulse?.archetypes || [];

    // 2. Identify the highest resonance product category
    // Logic: Cross-reference archetypes with available products
    const availableProducts = await fetchProducts(plan.provider);
    
    let bestProduct = null;
    let maxResonance = 0;

    for (const prod of availableProducts) {
      // Heuristic: If product name/description matches a "Resonance Archetype"
      const resonanceMatch = topArchetypes.find(a => 
        prod.name.toLowerCase().includes(a.toLowerCase()) || 
        (prod.description && prod.description.toLowerCase().includes(a.toLowerCase()))
      );
      
      const score = resonanceMatch ? 0.95 : 0.70; // High resonance vs baseline
      if (score > maxResonance) {
        maxResonance = score;
        bestProduct = prod;
      }
    }

    // 3. Phase 21: 15% Yield Gap Logic
    const currentProductResonance = 0.8; // Baseline for current plan
    const yieldGap = maxResonance - currentProductResonance;

    if (yieldGap >= 0.15 && bestProduct) {
      logger.info('Phase 21: Autonomous Yield Pivot Triggered', { 
        userId, 
        contentId, 
        yieldGap,
        newProduct: bestProduct.name 
      });

      // Pivot the plan
      plan.triggers = plan.triggers.map(trig => ({
        ...trig,
        productId: bestProduct.id,
        productName: bestProduct.name,
        productPrice: bestProduct.price,
        checkoutUrl: bestProduct.checkout_url || trig.checkoutUrl
      }));
      
      plan.metadata.pivoted = true;
      plan.metadata.pivotReason = `Yield Gap detected: ${Math.round(yieldGap * 100)}%`;
      await plan.save();

      return { pivoted: true, newProduct: bestProduct.name, yieldGap };
    }

    return { pivoted: false, reason: 'Yield gap below threshold' };
  } catch (error) {
    logger.error('Yield Optimization Pivot failed', { error: error.message, contentId });
    return { pivoted: false, error: error.message };
  }
}

module.exports = {
  detectCheckoutTriggers,
  fetchProducts,
  generateAndPersistPlan,
  updateMonetizationPlan,
  getPlanByContent,
  triggerYieldOptimizationPivot
};
