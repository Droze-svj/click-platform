const { autoEditVideo } = require('../server/services/aiVideoEditingService');
const logger = require('../server/utils/logger');

async function test() {
  const videoId = 'dev-content-1776522244923'; // Use the ID from the user log
  const options = {
    removeSilence: true,
    optimizePacing: true,
    enableTextOverlays: true,
    platform: 'tiktok'
  };
  
  try {
    console.log('Starting auto-edit test for', videoId);
    const result = await autoEditVideo(videoId, options, 'dev-user-123');
    console.log('Success!', result);
  } catch (err) {
    console.error('Failed!', err);
  }
}

test();
