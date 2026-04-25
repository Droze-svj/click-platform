require('dotenv').config();
const { autoEditVideo } = require('./server/services/aiVideoEditingService');
const { devVideoStore } = require('./server/utils/devStore');

async function test() {
  try {
    const keys = Array.from(devVideoStore.keys());
    if (keys.length === 0) {
      console.log('No dev videos found');
      return;
    }
    const videoId = keys[keys.length - 1]; // last one
    console.log('Testing with videoId:', videoId);
    console.log('Video data:', devVideoStore.get(videoId));
    const res = await autoEditVideo(videoId, {
      removeSilence: true,
      optimizePacing: true,
      enhanceAudio: true
    });
    console.log('Success:', res);
  } catch (e) {
    console.error('Failed:', e);
  }
}
test();
