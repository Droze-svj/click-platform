// Webhook Conversion Service
// Handle conversions from external sources (Google Analytics, Shopify, etc.)

const { trackConversion } = require('./conversionTrackingService');
const ClickTracking = require('../models/ClickTracking');
const logger = require('../utils/logger');

/**
 * Process conversion webhook from external source
 */
async function processConversionWebhook(webhookData) {
  try {
    const {
      source = 'external',
      conversionType,
      conversionValue,
      currency = 'USD',
      conversionId,
      customerId,
      orderId,
      productId,
      quantity = 1,
      utm = {},
      metadata = {}
    } = webhookData;

    // Find matching click by UTM parameters
    let click = null;
    if (utm.campaign || utm.source) {
      const clickQuery = {
        'utm.campaign': utm.campaign,
        'utm.source': utm.source || 'social',
        'click.timestamp': { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      };

      click = await ClickTracking.findOne(clickQuery)
        .sort({ 'click.timestamp': -1 })
        .lean();
    }

    if (!click) {
      logger.warn('No matching click found for conversion webhook', { utm, conversionId });
      // Could create a conversion without click tracking
      return null;
    }

    // Track conversion
    const conversion = await trackConversion(click.postId, {
      clickId: click._id,
      conversionType: conversionType || 'purchase',
      conversionValue,
      currency,
      conversionId,
      customerId,
      orderId,
      productId,
      quantity,
      metadata: {
        ...metadata,
        source,
        webhook: true
      }
    });

    logger.info('Conversion webhook processed', { conversionId, postId: click.postId });
    return conversion;
  } catch (error) {
    logger.error('Error processing conversion webhook', { error: error.message, webhookData });
    throw error;
  }
}

/**
 * Process Google Analytics conversion
 */
async function processGoogleAnalyticsConversion(gaData) {
  try {
    const {
      clientId,
      transactionId,
      value,
      currency = 'USD',
      items = []
    } = gaData;

    // Extract UTM from GA data
    const utm = {
      source: gaData.utm_source,
      medium: gaData.utm_medium || 'social',
      campaign: gaData.utm_campaign,
      term: gaData.utm_term,
      content: gaData.utm_content
    };

    const conversion = await processConversionWebhook({
      source: 'google_analytics',
      conversionType: 'purchase',
      conversionValue: value,
      currency,
      conversionId: transactionId,
      customerId: clientId,
      orderId: transactionId,
      productId: items[0]?.item_id,
      quantity: items.reduce((sum, item) => sum + (item.quantity || 1), 0),
      utm,
      metadata: {
        items,
        gaClientId: clientId
      }
    });

    return conversion;
  } catch (error) {
    logger.error('Error processing Google Analytics conversion', { error: error.message });
    throw error;
  }
}

/**
 * Process Shopify conversion
 */
async function processShopifyConversion(shopifyData) {
  try {
    const {
      order_id,
      total_price,
      currency = 'USD',
      customer_id,
      line_items = []
    } = shopifyData;

    // Extract UTM from Shopify order
    const utm = {
      source: shopifyData.utm_source,
      medium: shopifyData.utm_medium || 'social',
      campaign: shopifyData.utm_campaign,
      term: shopifyData.utm_term,
      content: shopifyData.utm_content
    };

    const conversion = await processConversionWebhook({
      source: 'shopify',
      conversionType: 'purchase',
      conversionValue: parseFloat(total_price),
      currency,
      conversionId: order_id.toString(),
      customerId: customer_id?.toString(),
      orderId: order_id.toString(),
      productId: line_items[0]?.product_id?.toString(),
      quantity: line_items.reduce((sum, item) => sum + (item.quantity || 1), 0),
      utm,
      metadata: {
        line_items,
        shopifyOrderId: order_id
      }
    });

    return conversion;
  } catch (error) {
    logger.error('Error processing Shopify conversion', { error: error.message });
    throw error;
  }
}

module.exports = {
  processConversionWebhook,
  processGoogleAnalyticsConversion,
  processShopifyConversion
};


