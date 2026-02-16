const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

/**
 * AI Writing & Copywriting Mastery Service
 */
class AIAgentWritingService {
  async generateMasterScript(topic, tone = 'energetic', role = 'expert') {
    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, using high-quality fallback');
      return this.generateFallbackScript(topic, tone, role);
    }

    try {
      logger.info('Generating master script with Google AI', { topic, tone, role });

      const roleInstructions = {
        expert: "You are the Authoritative Expert. Your tone is confident, data-driven, and slightly instructional.",
        skeptic: "You are the Provocative Skeptic. Your tone is challenging, cynical of mainstream advice.",
        hypeman: "You are the High-Energy Hype-Man. Your tone is fast-paced, enthusiastic, and focused on extreme possibilities."
      };

      const prompt = `Topic: ${topic}
Tone: ${tone}
Role: ${role}

Requirements:
1. Hook (0-3s): Must be a clinical pattern-interrupt that stops the scroll.
2. Value/Body (3-25s): Deliver 3 high-impact nuggets. No fluff.
3. Psychological CTA (25-30s): Use a 'Micro-Commitment' or 'Frictionless' call to action.

Format as JSON:
{
  "hook": "...",
  "body": "...",
  "cta": "...",
  "estimatedReadTime": 28,
  "hooks_used": ["Pattern Interrupt", "Loss Aversion", etc],
  "psychological_triggers": ["Curiosity Gap", "Social Proof", etc]
}

Return only valid JSON.`;

      const fullPrompt = `You are an Elite Viral Scriptwriter. ${roleInstructions[role] || roleInstructions.expert}\n\n${prompt}`;
      const response = await geminiGenerate(fullPrompt, { temperature: 0.8, maxTokens: 1000 });

      const scriptData = JSON.parse(response || '{}');

      return {
        success: true,
        script: scriptData
      };
    } catch (error) {
      logger.error('Script generation error', { error: error.message });
      throw error;
    }
  }

  async extractViralQuotes(transcript) {
    if (!geminiConfigured) {
      return {
        success: true,
        quotes: [
          { text: 'Consistency is the currency of the digital age.', score: 0.94, duration: 4.2 },
          { text: 'The difference between a tool and a platform is community.', score: 0.82, duration: 5.1 }
        ]
      };
    }

    try {
      logger.info('Extracting weighted quotes via Google AI', { charCount: transcript?.length || 0 });

      const prompt = `Analyze this transcript and extract exactly 3 VIRAL QUOTES.
A viral quote must be under 10 words, have high emotional weight, and function as a standalone 'Value Nugget'.

Transcript: "${transcript}"

Format as JSON:
{
  "quotes": [
    {"text": "...", "score": 0.95, "reason": "Universal truth trigger"},
    ...
  ]
}

Return only valid JSON.`;

      const fullPrompt = `You are a Neural Trend Analyst specializing in short-form virality.\n\n${prompt}`;
      const response = await geminiGenerate(fullPrompt, { temperature: 0.5, maxTokens: 800 });

      const data = JSON.parse(response || '{"quotes":[]}');

      return {
        success: true,
        quotes: data.quotes || []
      };
    } catch (error) {
      logger.error('Quote extraction error', { error: error.message });
      throw error;
    }
  }

  generateFallbackScript(topic, tone, role) {
    return {
      success: true,
      script: {
        hook: `Think you know everything about ${topic}? You're only seeing 10% of the picture.`,
        body: `In the next 20 seconds, I'm revealing the clinical architecture behind ${topic} that top performers use to dominate the market.`,
        cta: 'Check the link in my bio for the full V3 Elite methodology.',
        estimatedReadTime: 25,
        mood: tone
      }
    };
  }
}

module.exports = new AIAgentWritingService();
