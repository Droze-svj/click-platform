/**
 * Scratch script to verify OAuth token storage and encryption
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const OAuthService = require('../server/services/OAuthService');
const User = require('../server/models/User');

async function testOAuthStorage() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/click-platform');
    
    // 1. Find or create a test user
    let user = await User.findOne({ email: 'test_oauth@example.com' });
    if (!user) {
      user = new User({
        email: 'test_oauth@example.com',
        password: 'password123',
        name: 'OAuth Tester'
      });
      await user.save();
      console.log('Created test user');
    }

    // 2. Mock credentials
    const mockCreds = {
      accessToken: 'ya29.fake-google-access-token',
      refreshToken: '1//fake-google-refresh-token',
      extra: {
        platformUserId: 'yt-12345',
        platformUsername: 'TestChannel',
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    };

    // 3. Save credentials
    console.log('Saving YouTube credentials...');
    await OAuthService.saveSocialCredentials(user._id, 'youtube', mockCreds);

    // 4. Retrieve and verify
    console.log('Retrieving YouTube credentials...');
    const result = await OAuthService.getSocialCredentials(user._id, 'youtube');
    
    console.log('--- Verification ---');
    console.log('Platform:', 'youtube');
    console.log('Access Token (Decrypted):', result.accessToken);
    console.log('Refresh Token (Decrypted):', result.refreshToken);
    console.log('Platform User ID:', result.platformUserId);
    console.log('Platform Username:', result.platformUsername);
    console.log('Expires At:', result.expiresAt);
    
    const isSuccess = (
      result.accessToken === mockCreds.accessToken &&
      result.refreshToken === mockCreds.refreshToken &&
      result.platformUserId === mockCreds.extra.platformUserId
    );

    console.log('\nResult:', isSuccess ? '✅ SUCCESS' : '❌ FAILED');

    // Cleanup
    // await User.deleteOne({ _id: user._id });
    // console.log('Cleaned up test user');
    
    process.exit(isSuccess ? 0 : 1);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testOAuthStorage();
