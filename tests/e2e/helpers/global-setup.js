// Global Setup for E2E Tests

async function globalSetup(config) {
  console.log('🚀 Starting E2E test suite...');
  
  // Set up test environment
  process.env.NODE_ENV = 'test';
  process.env.E2E_TESTING = 'true';
  
  // Wait for services to be ready
  const maxRetries = 30;
  const delay = 2000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(process.env.E2E_API_URL || 'http://localhost:5001/api/health');
      if (response.ok) {
        console.log('✅ Backend server is ready');
        break;
      }
    } catch (error) {
      if (i === maxRetries - 1) {
        console.warn('⚠️ Backend server may not be ready, tests may fail');
      } else {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.log('✅ Global setup complete');
}

module.exports = globalSetup;



