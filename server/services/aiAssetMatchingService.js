const Content = require('../models/Content');
const logger = require('../utils/logger');

/**
 * Match transcript keywords with relevant B-roll assets
 */
async function getSmartBRollSuggestions(transcript) {
    try {
        // Simple Keyword Extraction (in a real app, this would use an LLM)
        const keywords = transcript.toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 5) // Simple heuristic
            .slice(0, 10);

        logger.info('Extracting keywords for B-roll matching', { keywords });

        // Search for assets matching keywords
        const assets = await Content.find({
            type: 'broll',
            $or: [
                { title: { $regex: keywords.join('|'), $options: 'i' } },
                { tags: { $in: keywords } }
            ]
        }).limit(5);

        return {
            success: true,
            suggestions: assets.map(a => ({
                assetId: a._id,
                title: a.title,
                url: a.originalFile.url,
                matchScore: 0.85 // Mock score
            }))
        };
    } catch (error) {
        logger.error('Smart B-roll matching error', { error: error.message });
        throw error;
    }
}

module.exports = {
    getSmartBRollSuggestions
};
