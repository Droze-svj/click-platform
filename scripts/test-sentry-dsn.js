const fs = require('fs');
const path = require('path');

// Basic env parser in case dotenv is missing in root
function loadEnv() {
  const envPaths = [path.join(__dirname, '../.env.nosync'), path.join(__dirname, '../.env')];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      content.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
      });
    }
  }
}

if (!process.env.SENTRY_DSN) loadEnv();

async function testSentry() {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    console.error('❌ SENTRY_DSN not found in environment variables.');
    process.exit(1);
  }

  console.log(`📡 Initializing Sentry with DSN: ${dsn.substring(0, 20)}...`);
  
  const Sentry = require('@sentry/node');
  
  try {
    Sentry.init({
      dsn: dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 1.0,
    });
    
    console.log('🚀 Sentry initialized. Triggering exception...');
    
    // Explicitly capture an exception
    const testError = new Error('Sovereign Verification Exception: Testing SENTRY_DSN via CLI script');
    const eventId = Sentry.captureException(testError);
    
    console.log(`✅ Exception captured! Event ID: ${eventId}`);
    console.log('⏳ Waiting 5 seconds for Sentry to flush events...');
    
    await Sentry.close(5000);
    
    console.log('🎉 Sentry verification sequence complete. Check your Sentry dashboard.');
  } catch (err) {
    console.error('❌ Failed to verify Sentry:', err.message);
    process.exit(1);
  }
}

testSentry();
