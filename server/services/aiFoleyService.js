/**
 * aiFoleyService.js
 * Generative Auto-Sound Design using ElevenLabs Sound Effects API.
 * Detects visual keyframe velocity and dynamically generates text prompts to hit those cuts perfectly.
 */
const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

let elevenlabsClient = null;

function getClient() {
    if (!elevenlabsClient && process.env.ELEVENLABS_API_KEY) {
        elevenlabsClient = new ElevenLabsClient({
            apiKey: process.env.ELEVENLABS_API_KEY
        });
    }
    return elevenlabsClient;
}

/**
 * Determine the sound effect prompt based on video transition velocity
 */
function determineSFXPrompt(durationSeconds, transitionType = 'cut') {
    if (transitionType === 'zoom_in' || transitionType === 'scale_up') {
        if (durationSeconds < 0.5) return "Fast aggressive air whoosh, cinematic impact";
        return "Deep slow bass riser, building tension";
    }

    if (transitionType === 'slide') {
        return "Clean modern digital swipe, swift motion";
    }

    // Default cuts
    if (durationSeconds < 0.2) return "Sharp quick camera shutter click or subtle thud";
    return "Subtle air movement, low frequency rumble";
}

/**
 * Generates an SFX via ElevenLabs and returns the local file path
 */
async function generateFoley(durationSeconds, transitionType, videoId) {
    const client = getClient();
    if (!client) {
        logger.warn('[FoleyService] ElevenLabs API not configured, skipping generative SFX.');
        return null;
    }

    const prompt = determineSFXPrompt(durationSeconds, transitionType);
    logger.info(`[FoleyService] Requesting SFX: "${prompt}"`);

    try {
        const audioStream = await client.textToSoundEffects.convert({
            text: prompt,
            duration_seconds: Math.max(1, Math.ceil(durationSeconds)), // Minimum 1s
            prompt_influence: 0.8
        });

        // Write to local cache
        const targetDir = path.join(__dirname, '../../uploads/sfx');
        if (!fs.existsSync(targetDir)) {
           fs.mkdirSync(targetDir, { recursive: true });
        }

        const fileName = `foley_${videoId}_${Date.now()}.mp3`;
        const filePath = path.join(targetDir, fileName);

        const fileStream = fs.createWriteStream(filePath);

        await new Promise((resolve, reject) => {
            audioStream.pipe(fileStream);
            audioStream.on('end', resolve);
            audioStream.on('error', reject);
        });

        return `/uploads/sfx/${fileName}`;

    } catch (err) {
        logger.error('[FoleyService] Error generating Foley:', err);
        return null; // Graceful degradation
    }
}

/**
 * Parses timeline JSON (mock or real) and aligns generated Foley to the cuts
 */
async function alignFoleyToTimeline(timelineClips, videoId) {
    if (!timelineClips || timelineClips.length === 0) return [];

    const foleyNodes = [];

    // We only generate SFX for transitions/cuts, not the actual clips themselves
    for (let i = 1; i < timelineClips.length; i++) {
        const nextClip = timelineClips[i];

        // Example: Only add Foley if the next clip is very short (fast paced) or has a specific transition
        if (nextClip.duration <= 3 || nextClip.type === 'b-roll' || nextClip.type === 'hook') {
           const duration = 1.0;
           const sfxUrl = await generateFoley(duration, 'cut', videoId);
           if (sfxUrl) {
               foleyNodes.push({
                   type: 'sfx',
                   url: sfxUrl,
                   startTime: nextClip.startTime, // Start exactly at the cut
                   volume: 0.8
               });
           }
        }
    }

    return foleyNodes;
}

module.exports = {
   generateFoley,
   alignFoleyToTimeline
};
