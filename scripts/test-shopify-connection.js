#!/usr/bin/env node

/**
 * Shopify Connection Test Script
 * Verifies that the SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN
 * are correctly configured and can fetch products from the Shopify Admin API.
 */

require('dotenv').config();
const shopifyService = require('../server/services/shopifyMonetizationService');
const logger = require('../server/utils/logger');

async function testConnection() {
  console.log('🔍 Testing Shopify Connection...');
  
  const storeUrl = process.env.SHOPIFY_STORE_URL;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!storeUrl || !accessToken) {
    console.error('❌ Missing SHOPIFY_STORE_URL or SHOPIFY_ACCESS_TOKEN in environment.');
    console.log('Please add them to your .env file:');
    console.log('SHOPIFY_STORE_URL=your-store.myshopify.com');
    console.log('SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxx');
    process.exit(1);
  }

  console.log(`📡 Connecting to: ${storeUrl}`);
  
  try {
    const products = await shopifyService.fetchShopifyProducts();
    
    if (products && products.length > 0) {
      console.log('✅ Connection Successful!');
      console.log(`📦 Fetched ${products.length} products:`);
      products.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} ($${p.price}) [ID: ${p.id}]`);
      });
      
      // Check for demo markers
      if (products[0].id.includes('demo')) {
        console.warn('⚠️  Warning: The returned products look like DEMO products.');
        console.log('Ensure your SHOPIFY_ACCESS_TOKEN is correct for live products.');
      }
    } else {
      console.error('❌ No products returned or request failed.');
      console.log('Check your store URL and Access Token permissions (Read Products).');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Connection Failed with error:');
    console.error(error.message);
    process.exit(1);
  }
}

testConnection();
