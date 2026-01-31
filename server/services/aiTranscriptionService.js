const { OpenAI } = require('openai');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

let openai = null;

function getOpenAIClient() {
    if (!openai && process.env.OPENAI_API_KEY) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
}

/**
 * Check if transcription (Whisper) is available.
 * Requires OPENAI_API_KEY to be set.
 */
function isTranscriptionConfigured() {
    const key = process.env.OPENAI_API_KEY;
    return !!(typeof key === 'string' && key.trim().length > 0);
}

/**
 * Generate Transcription for a video file
 */
async function transcribeVideo(userId, videoId, videoPath) {
    try {
        const client = getOpenAIClient();
        if (!client) {
            throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in your environment to enable transcription.');
        }

        const fullPath = videoPath.startsWith('/')
            ? path.join(__dirname, '../..', videoPath)
            : videoPath;

        if (!fs.existsSync(fullPath)) throw new Error('Video file not found for transcription');

        logger.info('Starting transcription', { videoId, userId });

        const transcription = await client.audio.transcriptions.create({
            file: fs.createReadStream(fullPath),
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['word']
        });

        return {
            success: true,
            text: transcription.text,
            words: transcription.words // Contains word-level timestamps
        };
    } catch (error) {
        logger.error('Transcription error', { error: error.message, userId });
        throw error;
    }
}

module.exports = {
    transcribeVideo,
    isTranscriptionConfigured
};
