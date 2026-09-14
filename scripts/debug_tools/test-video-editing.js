#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Test script to trigger video editing operations and generate debug logs
async function testVideoEditing() {
  console.log('🚀 Starting video editing tests...');

  const baseURL = 'http://localhost:3010'; // Next.js client
  const apiURL = 'http://localhost:5001';  // Backend server

  // Check if servers are running
  try {
    const response = await fetch(`${apiURL}/api/docs`);
    console.log('✅ Backend server is running');
  } catch (error) {
    console.error('❌ Backend server not accessible:', error.message);
    return;
  }

  // Test basic API connectivity first
  console.log('🔍 Testing API connectivity...');
  try {
    // Test the video advanced endpoints with mock data to trigger debug logs
    // These will likely fail due to auth, but should generate debug logs

    console.log('🗜️  Testing video compression endpoint...');
    const compressResponse = await fetch(`${apiURL}/api/video/advanced/compress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: 'test-video-123',
        quality: 'medium',
        format: 'mp4'
      })
    });
    console.log(`Compression response: ${compressResponse.status} ${compressResponse.statusText}`);

    console.log('✂️  Testing video trimming endpoint...');
    const trimResponse = await fetch(`${apiURL}/api/video/advanced/trim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: 'test-video-123',
        startTime: 0,
        duration: 5
      })
    });
    console.log(`Trim response: ${trimResponse.status} ${trimResponse.statusText}`);

    console.log('📤 Testing video export endpoint...');
    const exportResponse = await fetch(`${apiURL}/api/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'video',
        format: 'mp4',
        options: { videoId: 'test-video-123' }
      })
    });
    console.log(`Export response: ${exportResponse.status} ${exportResponse.statusText}`);

  } catch (error) {
    console.error('❌ API test error:', error.message);
  }

  // Wait for logs to be written
  console.log('⏳ Waiting for debug logs to be written...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('✅ Video editing API tests completed!');
  console.log('📊 Check the debug logs at .cursor/debug.log for detailed information');
  console.log('💡 To generate more comprehensive logs, try using the actual frontend interface');
}

// Run the tests
testVideoEditing().catch(console.error);
