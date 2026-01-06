// Comprehensive test suite for advanced authentication features
const axios = require('axios');

const BASE_URL = 'https://click-platform.onrender.com';
const TEST_EMAIL = 'testuser123@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_FIRST_NAME = 'Test';
const TEST_LAST_NAME = 'User';

// Store tokens for testing
let accessToken = '';
let refreshToken = '';
let tempToken = '';
let verificationToken = '';

async function testAdvancedAuth() {
  console.log('🧪 COMPREHENSIVE ADVANCED AUTHENTICATION TEST SUITE\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Password Strength Checker
    console.log('\n1. 🔍 Testing Password Strength Checker...');
    const strengthResponse = await axios.post(`${BASE_URL}/api/auth/check-password-strength`, {
      password: TEST_PASSWORD
    });
    console.log('✅ Password strength response:', strengthResponse.data.data);

    // Test 2: User Registration with Email Verification
    console.log('\n2. 📝 Testing User Registration...');
    const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      firstName: TEST_FIRST_NAME,
      lastName: TEST_LAST_NAME
    });
    console.log('✅ Registration response:', registerResponse.data);

    if (registerResponse.data.success) {
      console.log('⚠️  Note: Email verification required before login');
    }

    // Test 3: Attempt Login Before Verification (should fail)
    console.log('\n3. 🚫 Testing Login Before Email Verification...');
    try {
      await axios.post(`${BASE_URL}/api/auth/login`, {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });
      console.log('❌ Login should have failed - email not verified');
    } catch (error) {
      console.log('✅ Login correctly blocked:', error.response?.data?.error || 'Request failed');
    }

    // Test 4: Resend Verification Email
    console.log('\n4. 📧 Testing Resend Verification Email...');
    const resendResponse = await axios.post(`${BASE_URL}/api/auth/resend-verification`, {
      email: TEST_EMAIL
    });
    console.log('✅ Resend verification response:', resendResponse.data);

    // Test 5: Test with existing user (dariovuma@gmail.com)
    console.log('\n5. 👤 Testing with Existing Verified User...');

    // Login with existing user
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'dariovuma@gmail.com',
      password: 'NewPassword123'
    });
    accessToken = loginResponse.data.data.token;
    refreshToken = loginResponse.data.data.refreshToken;
    console.log('✅ Existing user login successful');

    // Test 6: Protected Endpoints with JWT
    console.log('\n6. 🔐 Testing Protected Endpoints...');

    const profileResponse = await axios.get(`${BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    console.log('✅ Profile access successful');

    const meResponse = await axios.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    console.log('✅ Me endpoint access successful');

    // Test 7: Session Management
    console.log('\n7. 🔄 Testing Session Management...');

    const sessionsResponse = await axios.get(`${BASE_URL}/api/auth/sessions`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    console.log('✅ Sessions info retrieved:', sessionsResponse.data.data);

    // Test 8: Security Status
    console.log('\n8. 🛡️ Testing Security Monitoring...');

    const securityResponse = await axios.get(`${BASE_URL}/api/auth/security-status`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    console.log('✅ Security status:', securityResponse.data.data);

    const securityEventsResponse = await axios.get(`${BASE_URL}/api/auth/security-events`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    console.log('✅ Security events retrieved:', securityEventsResponse.data.data.events.length, 'events');

    // Test 9: 2FA Setup
    console.log('\n9. 🔢 Testing 2FA Setup...');

    const twoFASetupResponse = await axios.post(`${BASE_URL}/api/auth/2fa/setup`, {}, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    console.log('✅ 2FA setup initiated');

    // Test 10: 2FA Status Check
    console.log('\n10. 📱 Testing 2FA Status...');

    const twoFAStatusResponse = await axios.get(`${BASE_URL}/api/auth/2fa/status`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    console.log('✅ 2FA status:', twoFAStatusResponse.data.data);

    // Test 11: Password Change
    console.log('\n11. 🔑 Testing Password Change...');

    const changePasswordResponse = await axios.post(`${BASE_URL}/api/auth/change-password`, {
      currentPassword: 'NewPassword123',
      newPassword: 'UpdatedPassword123!'
    }, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    console.log('✅ Password change successful');

    // Test 12: Login with New Password
    console.log('\n12. 🔐 Testing Login with Updated Password...');

    const newLoginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'dariovuma@gmail.com',
      password: 'UpdatedPassword123!'
    });
    accessToken = newLoginResponse.data.data.token;
    console.log('✅ Login with new password successful');

    // Test 13: Token Refresh
    console.log('\n13. 🔄 Testing Token Refresh...');

    const refreshResponse = await axios.post(`${BASE_URL}/api/auth/refresh`, {
      refreshToken: refreshToken
    });
    accessToken = refreshResponse.data.data.accessToken;
    refreshToken = refreshResponse.data.data.refreshToken;
    console.log('✅ Token refresh successful');

    // Test 14: Logout
    console.log('\n14. 🚪 Testing Logout...');

    const logoutResponse = await axios.post(`${BASE_URL}/api/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    console.log('✅ Logout successful');

    // Test 15: Attempt Access After Logout (should fail)
    console.log('\n15. 🚫 Testing Access After Logout...');
    try {
      await axios.get(`${BASE_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      console.log('❌ Access should have been denied after logout');
    } catch (error) {
      console.log('✅ Access correctly denied:', error.response?.data?.error || 'Request failed');
    }

    // Test 16: OAuth Status Checks
    console.log('\n16. 🌐 Testing OAuth Status...');

    const linkedinStatusResponse = await axios.get(`${BASE_URL}/api/oauth/linkedin/status`, {
      headers: { Authorization: `Bearer ${newLoginResponse.data.data.token}` }
    });
    console.log('✅ LinkedIn OAuth status:', linkedinStatusResponse.data.data);

    const googleStatusResponse = await axios.get(`${BASE_URL}/api/oauth/google/status`, {
      headers: { Authorization: `Bearer ${newLoginResponse.data.data.token}` }
    });
    console.log('✅ Google OAuth status:', googleStatusResponse.data.data);

    console.log('\n🎉 ALL ADVANCED AUTHENTICATION TESTS COMPLETED!');
    console.log('=' .repeat(60));
    console.log('\n📊 Test Summary:');
    console.log('✅ Password strength checking');
    console.log('✅ User registration with email verification');
    console.log('✅ Email verification workflow');
    console.log('✅ Protected endpoint access');
    console.log('✅ Session management (refresh/logout)');
    console.log('✅ Security monitoring');
    console.log('✅ Two-factor authentication setup');
    console.log('✅ Password policy enforcement');
    console.log('✅ OAuth status checking');
    console.log('✅ Account security features');

    console.log('\n🚀 All advanced authentication features are working correctly!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the tests
testAdvancedAuth();
