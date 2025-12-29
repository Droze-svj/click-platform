#!/usr/bin/env node

/**
 * Validate Free AI API Keys
 * Checks if API keys are valid and working
 */

require('dotenv').config({ path: '.env.production' });

const {
  validateAPIKey,
  getAllKeysStatus,
  getAllProviderLimits,
} = require('../server/services/freeAIModelKeyManager');

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

async function validateAllKeys() {
  console.log(`${colors.blue}🔑 Validating Free AI API Keys...${colors.reset}\n`);

  const limits = getAllProviderLimits();
  const status = await getAllKeysStatus();

  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

  for (const [provider, providerStatus] of Object.entries(status)) {
    const providerLimits = limits[provider];
    console.log(`\n${colors.yellow}${providerLimits.name}${colors.reset}`);
    console.log(`  Base URL: ${providerLimits.baseUrl}`);

    if (providerStatus.configured) {
      if (providerStatus.validated) {
        console.log(`  ${colors.green}✅ API Key: Valid${colors.reset}`);
        if (providerStatus.details) {
          if (providerStatus.details.label) {
            console.log(`     Label: ${providerStatus.details.label}`);
          }
          if (providerStatus.details.credits !== null && providerStatus.details.credits !== undefined) {
            console.log(`     Credits: ${providerStatus.details.credits}`);
          }
          if (providerStatus.details.username) {
            console.log(`     Username: ${providerStatus.details.username}`);
          }
        }
      } else {
        console.log(`  ${colors.red}❌ API Key: Invalid${colors.reset}`);
        if (providerStatus.error) {
          console.log(`     Error: ${providerStatus.error}`);
        }
      }
      console.log(`  Last Validated: ${providerStatus.lastValidated?.toISOString() || 'Never'}`);
    } else {
      console.log(`  ${colors.yellow}⚠️  API Key: Not configured${colors.reset}`);
      console.log(`     Status: ${providerStatus.message || 'No key found'}`);
    }

    // Show limits
    if (providerLimits.freeTier) {
      console.log(`  Free Tier Limits:`);
      if (providerLimits.freeTier.requestsPerDay) {
        console.log(`     Requests/day: ${providerLimits.freeTier.requestsPerDay}`);
      }
      if (providerLimits.freeTier.tokensPerDay) {
        console.log(`     Tokens/day: ${providerLimits.freeTier.tokensPerDay.toLocaleString()}`);
      }
      if (providerLimits.freeTier.credits) {
        console.log(`     Credits: $${providerLimits.freeTier.credits}`);
      }
      console.log(`     Requires Auth: ${providerLimits.freeTier.requiresAuth ? 'Yes' : 'No'}`);
    }
  }

  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

  // Summary
  const configured = Object.values(status).filter(s => s.configured).length;
  const validated = Object.values(status).filter(s => s.validated).length;
  const total = Object.keys(status).length;

  console.log(`\n${colors.blue}📊 Summary:${colors.reset}`);
  console.log(`  Total Providers: ${total}`);
  console.log(`  Configured: ${configured}/${total}`);
  console.log(`  Valid: ${validated}/${total}`);

  if (validated === total) {
    console.log(`\n${colors.green}✅ All API keys are valid!${colors.reset}`);
  } else if (configured > 0) {
    console.log(`\n${colors.yellow}⚠️  Some API keys need attention${colors.reset}`);
  } else {
    console.log(`\n${colors.yellow}💡 Tip: Run 'bash scripts/get-free-ai-api-keys.sh' to set up keys${colors.reset}`);
  }

  console.log('');
}

// Run validation
validateAllKeys().catch(error => {
  console.error(`${colors.red}Error:${colors.reset}`, error.message);
  process.exit(1);
});


