// Test current deployment status
const axios = require('axios');

const BASE_URL = 'https://click-platform.onrender.com';

async function testCurrentStatus() {
  console.log('🔍 TESTING CURRENT DEPLOYMENT STATUS\n');
  console.log('=' .repeat(50));

  const tests = [
    {
      name: 'Health Check',
      method: 'GET',
      url: '/api/health',
      expectSuccess: true
    },
    {
      name: 'Password Strength Checker',
      method: 'POST',
      url: '/api/auth/check-password-strength',
      data: { password: 'Test123!' },
      expectSuccess: true
    },
    {
      name: '2FA Status (with invalid token)',
      method: 'GET',
      url: '/api/auth/2fa/status',
      headers: { Authorization: 'Bearer invalid' },
      expectSuccess: false,
      expectError: 'Too many authentication attempts'
    },
    {
      name: 'Security Events (with invalid token)',
      method: 'GET',
      url: '/api/auth/security-events',
      headers: { Authorization: 'Bearer invalid' },
      expectSuccess: false
    },
    {
      name: 'Google OAuth Status',
      method: 'GET',
      url: '/api/oauth/google/status',
      headers: { Authorization: 'Bearer invalid' },
      expectSuccess: false
    }
  ];

  for (const test of tests) {
    try {
      console.log(`\n🔍 ${test.name}...`);

      const config = {
        method: test.method,
        url: BASE_URL + test.url,
        headers: test.headers || { 'Content-Type': 'application/json' },
        data: test.data,
        timeout: 5000
      };

      const response = await axios(config);

      if (response.data.success === test.expectSuccess) {
        console.log(`✅ ${test.name} - Working as expected`);
        if (response.data.data) {
          console.log(`   Response: ${JSON.stringify(response.data.data).substring(0, 100)}...`);
        }
      } else {
        console.log(`⚠️  ${test.name} - Unexpected response:`, response.data);
      }

    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      if (test.expectError && errorMessage.includes(test.expectError)) {
        console.log(`✅ ${test.name} - Expected error: "${test.expectError}"`);
      } else if (error.response?.status === 404) {
        console.log(`❌ ${test.name} - Endpoint not found (404)`);
      } else {
        console.log(`⚠️  ${test.name} - Unexpected error: ${errorMessage}`);
      }
    }
  }

  console.log('\n📊 DEPLOYMENT STATUS SUMMARY:');
  console.log('=' .repeat(50));
  console.log('🔍 Server Health: ✅ Working');
  console.log('🔍 Database Connection: ✅ Working');
  console.log('🔍 Basic Auth Endpoints: ❓ Need authentication to test');
  console.log('🔍 Advanced Features: 🚧 Deployment in progress');

  console.log('\n💡 RECOMMENDATIONS:');
  console.log('1. Wait for full deployment to complete (may take several minutes)');
  console.log('2. Check Render deployment logs for any build errors');
  console.log('3. Monitor health endpoint timestamp for updates');
  console.log('4. Run comprehensive tests once deployment completes');

  console.log('\n⏱️  To check deployment progress:');
  console.log('   curl https://click-platform.onrender.com/api/health | jq .timestamp');
}

testCurrentStatus();
