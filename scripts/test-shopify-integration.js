const shopifyService = require('../server/services/shopifyMonetizationService');
const logger = require('../server/utils/logger');

async function testShopify() {
  console.log('--- Shopify Monetization Bridge Test ---');
  console.log('Store URL:', process.env.SHOPIFY_STORE_URL || '(not set, using demo)');
  
  try {
    const products = await shopifyService.fetchShopifyProducts();
    console.log(`Fetched ${products.length} products`);
    
    if (products.length > 0) {
      console.log('First product sample:');
      console.log(JSON.stringify(products[0], null, 2));
      
      const hasCheckout = products.every(p => p.checkout_url && p.checkout_url.includes('/cart/'));
      if (hasCheckout) {
        console.log('✅ Checkout URL format verified');
      } else {
        console.warn('⚠️ Some products missing standard checkout URL format');
      }
    } else {
      console.error('❌ No products returned');
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

testShopify();
