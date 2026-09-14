const path = require('path');
const fs = require('fs');

const imports = [
  'express',
  'jsonwebtoken',
  'speakeasy',
  'qrcode',
  '@supabase/supabase-js',
  '../middleware/enhancedRateLimiter',
  '../middleware/security',
  '../validators/authValidator',
  '../services/emailService',
  '../utils/passwordPolicy',
  '../utils/logger'
];

console.log('Testing auth.js imports individually...');

for (const imp of imports) {
  try {
    console.log(`Testing import: ${imp}`);
    let target = imp;
    if (imp.startsWith('.')) {
      target = path.resolve(__dirname, 'server/routes', imp);
    }
    const result = require(target);
    console.log(`✅ Success: ${imp} (type: ${typeof result})`);
  } catch (err) {
    console.log(`❌ FAILED: ${imp} - ${err.message}`);
  }
}

console.log('Test complete.');
