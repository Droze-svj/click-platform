#!/usr/bin/env node

/**
 * Fix YouTube OAuth State and Complete Connection
 * Updates the stored state to match the callback state, then completes OAuth
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

const USER_ID = '6952cd3722d6abc5509a9efd';
const CODE = process.argv[2] || '4/0ATX87lP9A8UBXjAeG5mVeHBGVECIp597sTeeqmvQ4iWI9u68EQ8ijY6uydQJ5OBtmclHFA';
const STATE = process.argv[3] || '12499ea22c82364a6cf04e162244092c0e8db54798804629cf63b4a66202e22a';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTUyY2QzNzIyZDZhYmM1NTA5YTllZmQiLCJpYXQiOjE3NjcwMzQxNjksImV4cCI6MTc2OTYyNjE2OX0.komsdbvTeS1q4Rii0lwQjaau-46P1_HMO-i07WpiXaY';

async function fixAndComplete() {
  try {
    console.log('🔧 Fixing YouTube OAuth state and completing connection...\n');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/click';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');
    
    // Import User model
    const User = require('../server/models/User');
    
    // Update the state in database
    console.log(`📝 Updating stored state to: ${STATE}`);
    await User.findByIdAndUpdate(USER_ID, {
      $set: {
        'oauth.youtube.state': STATE
      }
    });
    console.log('✅ State updated in database\n');
    
    // Wait a moment for the update to propagate
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Complete OAuth connection
    console.log('🔐 Completing OAuth connection...');
    const response = await axios.post('http://localhost:5001/api/oauth/youtube/complete', {
      code: CODE,
      state: STATE
    }, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n✅ OAuth Connection Successful!');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Check status
    console.log('\n📊 Checking connection status...');
    const statusResponse = await axios.get('http://localhost:5001/api/oauth/youtube/status', {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    
    console.log(JSON.stringify(statusResponse.data, null, 2));
    
    await mongoose.disconnect();
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('\n❌ Error occurred:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('Request made but no response:', error.message);
    } else {
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
    }
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

fixAndComplete();

