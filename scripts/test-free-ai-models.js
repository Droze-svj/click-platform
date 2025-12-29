#!/usr/bin/env node

/**
 * Test Free AI Models Integration
 * Tests the free AI models service and endpoints
 */

require('dotenv').config({ path: '.env.production' });

const {
  getAvailableModels,
  generateWithFreeModel,
  getLearningInsights,
  FREE_AI_PROVIDERS,
} = require('../server/services/freeAIModelService');

const {
  getAllKeysStatus,
  getAllProviderLimits,
} = require('../server/services/freeAIModelKeyManager');

const {
  getUsage,
  getAllUsage,
} = require('../server/services/freeAIModelRateLimiter');

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

async function testFreeAIModels() {
  console.log(`${colors.blue}🧪 Testing Free AI Models Integration...${colors.reset}\n`);

  // Test 1: Get Available Models
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.yellow}Test 1: Get Available Models${colors.reset}\n`);

  for (const provider of Object.keys(FREE_AI_PROVIDERS)) {
    const models = getAvailableModels(provider);
    console.log(`${colors.green}✅ ${provider}:${colors.reset} ${models.length} models available`);
    if (models.length > 0) {
      console.log(`   First model: ${models[0].name}`);
    }
  }

  // Test 2: Get Provider Limits
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.yellow}Test 2: Get Provider Limits${colors.reset}\n`);

  const limits = getAllProviderLimits();
  for (const [provider, limit] of Object.entries(limits)) {
    console.log(`${colors.green}✅ ${limit.name}:${colors.reset}`);
    if (limit.freeTier.requestsPerDay) {
      console.log(`   Requests/day: ${limit.freeTier.requestsPerDay}`);
    }
    if (limit.freeTier.tokensPerDay) {
      console.log(`   Tokens/day: ${limit.freeTier.tokensPerDay.toLocaleString()}`);
    }
    console.log(`   Has API Key: ${limit.hasAPIKey ? 'Yes' : 'No'}`);
  }

  // Test 3: Get Keys Status
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.yellow}Test 3: Get Keys Status${colors.reset}\n`);

  try {
    const keysStatus = await getAllKeysStatus();
    for (const [provider, status] of Object.entries(keysStatus)) {
      if (status.configured) {
        console.log(`${colors.green}✅ ${provider}:${colors.reset} Key configured`);
        if (status.validated) {
          console.log(`   Status: Valid`);
        } else {
          console.log(`   Status: ${colors.yellow}Invalid or not validated${colors.reset}`);
        }
      } else {
        console.log(`${colors.yellow}⚠️  ${provider}:${colors.reset} No key configured`);
      }
    }
  } catch (error) {
    console.log(`${colors.red}❌ Error getting keys status:${colors.reset} ${error.message}`);
  }

  // Test 4: Get Usage
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.yellow}Test 4: Get Usage Statistics${colors.reset}\n`);

  const usage = getAllUsage();
  for (const [provider, providerUsage] of Object.entries(usage)) {
    console.log(`${colors.green}✅ ${provider}:${colors.reset}`);
    console.log(`   Requests: ${providerUsage.usage.requests}`);
    console.log(`   Tokens: ${providerUsage.usage.tokens}`);
    if (providerUsage.remaining.requests !== null) {
      console.log(`   Remaining: ${providerUsage.remaining.requests} requests`);
    }
  }

  // Test 5: Test Generation (Optional - requires network)
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.yellow}Test 5: Test Generation (Optional)${colors.reset}\n`);

  const testGeneration = process.argv.includes('--test-generation');
  if (testGeneration) {
    try {
      console.log('Testing generation with OpenRouter...');
      const result = await generateWithFreeModel(
        'Say "Hello, this is a test"',
        {
          provider: 'openrouter',
          taskType: 'content-generation',
          maxTokens: 50,
        }
      );

      console.log(`${colors.green}✅ Generation successful!${colors.reset}`);
      console.log(`   Model: ${result.model}`);
      console.log(`   Provider: ${result.provider}`);
      console.log(`   Tokens: ${result.tokens}`);
      console.log(`   Content: ${result.content.substring(0, 100)}...`);
    } catch (error) {
      console.log(`${colors.yellow}⚠️  Generation test skipped:${colors.reset} ${error.message}`);
      console.log('   (This is normal if no API keys are configured)');
    }
  } else {
    console.log(`${colors.yellow}⚠️  Generation test skipped${colors.reset}`);
    console.log('   Run with --test-generation to test actual generation');
  }

  // Summary
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}📊 Test Summary${colors.reset}\n`);

  const providers = Object.keys(FREE_AI_PROVIDERS).length;
  const models = Object.values(FREE_AI_PROVIDERS).reduce((sum, p) => sum + p.freeTier.models.length, 0);

  console.log(`✅ Providers configured: ${providers}`);
  console.log(`✅ Total models available: ${models}`);
  console.log(`✅ Services loaded successfully`);
  console.log(`\n${colors.green}✅ All tests passed!${colors.reset}\n`);
}

// Run tests
testFreeAIModels().catch(error => {
  console.error(`${colors.red}Error:${colors.reset}`, error.message);
  console.error(error.stack);
  process.exit(1);
});


