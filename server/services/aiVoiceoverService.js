const { OpenAI } = require('openai');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const { uploadFile } = require('./storageService');

let openai = null;

function getOpenAIClient() {
    if (!openai && process.env.OPENAI_API_KEY) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
}

/**
 * Generate AI Voiceover from text
 */
async function generateVoiceover(userId, text, options = {}) {
    try {
        const {
            voice = 'alloy', // alloy, echo, fable, onyx, nova, shimmer
            speed = 1.0,
            projectId
        } = options;

        const client = getOpenAIClient();
        if (!client) throw new Error('OpenAI client not initialized');

        const outputFilename = `tts-${userId}-${Date.now()}.mp3`;
        const outputPath = path.join(__dirname, '../../uploads/audio', outputFilename);

        if (!fs.existsSync(path.dirname(outputPath))) {
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        }

        const ttsResponse = await client.audio.speech.create({
            model: 'tts-1',
            voice: voice,
            input: text,
            speed: speed
        });

        const buffer = Buffer.from(await ttsResponse.arrayBuffer());
        await fs.promises.writeFile(outputPath, buffer);

        const uploadResult = await uploadFile(outputPath, `audio/${outputFilename}`, 'audio/mpeg', {
            userId,
            projectId,
            type: 'voiceover'
        });

        logger.info('AI Voiceover generated', { userId, voice, duration: text.length });

        return {
            success: true,
            url: uploadResult.url,
            voice: voice,
            text: text
        };
    } catch (error) {
        logger.error('Voiceover generation error', { error: error.message, userId });
        throw error;
    }
}

module.exports = {
    generateVoiceover
};
