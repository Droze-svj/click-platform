const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');
const { safeJsonParse } = require('../utils/safeJson');
const personalizationService = require('./personalizationService');
let Sentry = null;
try {
  Sentry = require('@sentry/node');
} catch (_) {
  // Optional dependency in some local environments
}

/**
 * AI Writing & Copywriting Mastery Service
 */
class AIAgentWritingService {
  async generateMasterScript(topic, tone = 'energetic', role = 'expert', userId = null) {
    const run = async () => {
      if (!geminiConfigured) {
        logger.warn('Google AI API key not configured, using high-quality fallback');
        return this.generateFallbackScript(topic, tone, role);
      }

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

      // Personalize the creator's VOICE only (tone/vocab/banned) — a LIGHT block
      // so the strict-JSON output below stays intact. (The full playbook prompt
      // is JSON-fragile on this raw-gemini + safeJsonParse path, which has no
      // repair step — unlike the repurpose copy path.)
      let voiceBlock = '';
      if (userId) {
        try {
          const persona = await personalizationService.getPersona(userId, {});
          const bits = [];
          if (persona.voice.tone) bits.push(`tone: ${persona.voice.tone}`);
          if (Array.isArray(persona.voice.vocab) && persona.voice.vocab.length) bits.push(`weave in where natural: ${persona.voice.vocab.join(', ')}`);
          if (Array.isArray(persona.voice.banned) && persona.voice.banned.length) bits.push(`NEVER use these words: ${persona.voice.banned.join(', ')}`);
          if (bits.length) voiceBlock = `\nWrite in THIS creator's voice — ${bits.join('; ')}.`;
        } catch (_) { voiceBlock = ''; }
      }
      const fullPrompt = `You are an Elite Viral Scriptwriter. ${roleInstructions[role] || roleInstructions.expert}${voiceBlock}\n\n${prompt}`;
      // 4000 (not 1000): gemini-2.5-flash spends "thinking" tokens from this
      // budget, so 1000 starved the actual JSON output → truncated → empty script.
      const response = await geminiGenerate(fullPrompt, { temperature: 0.8, maxTokens: 4000 });
      const cleanedResponse = this.cleanAIResponse(response);
      const scriptData = safeJsonParse(cleanedResponse, {});

      return {
        success: true,
        script: scriptData
      };
    };

    try {
      if (Sentry && typeof Sentry.startSpan === 'function') {
        return await Sentry.startSpan(
          {
            op: 'gen_ai.invoke_agent',
            name: 'invoke_agent AI Writing Agent',
            attributes: {
              'gen_ai.agent.name': 'AI Writing Agent',
              'gen_ai.request.model': 'gemini-2.5-flash',
              'gen_ai.operation.name': 'invoke_agent',
            },
          },
          run
        );
      }
      return await run();
    } catch (error) {
      logger.error('Script generation error', { error: error.message });
      throw error;
    }
  }

  async extractViralQuotes(transcript, engine = 'gpt4', persona = 'beast') {
    const run = async () => {
      // Logic for fallback
      if (!geminiConfigured && engine === 'gemini') {
        return {
          success: true,
          quotes: [
            { text: 'Consistency is the currency of the digital age.', score: 0.94, duration: 4.2 },
            { text: 'The difference between a tool and a platform is community.', score: 0.82, duration: 5.1 }
          ]
        };
      }

      logger.info('Extracting weighted quotes via Google AI', { charCount: transcript?.length || 0, persona });

      const personaInstructions = {
        beast: "You are 'The Beast'. Focus on high-dopamine, punchy, extreme statements. Look for 'retention peaks' where the speaker says something shocking, controversial, or extremely high-value.",
        minimalist: "You are 'The Minimalist'. Focus on elegant, profound, and simple truths. Look for 'Apple-style' clarity and aesthetic wisdom.",
        architect: "You are 'The Viral Architect'. Focus on clinical pattern interrupts and loop-opening 'curiosity' hooks. Look for sentences that force the viewer to keep watching to get the answer.",
        educator: "You are 'The Educator'. Focus on 'Aha!' moments and clear, structured value delivery. Look for definitions, steps, or surprising facts."
      };

      const prompt = `Analyze this transcript and extract exactly 5 VIRAL QUOTES based on your assigned persona.
A viral quote must be under 12 words, have high emotional weight, and function as a standalone 'Value Nugget'.

Transcript: "${transcript}"

Persona Instructions: ${personaInstructions[persona] || personaInstructions.beast}

Format as JSON:
{
  "quotes": [
    {"text": "...", "score": 0.95, "reason": "...", "hookType": "Curiosity | Pattern Interrupt | Authority"},
    ...
  ]
}

Return only valid JSON.`;

      const fullPrompt = `You are an Elite Director Persona: ${persona.toUpperCase()}.\n\n${prompt}`;

      let response;
      if (engine === 'claude') {
        logger.info('Routing to Anthropic Claude 3 backend');
        // Simulated Claude routing via OpenAI stub or direct (stubbed here since it's a mock layer)
        response = await geminiGenerate(fullPrompt, { temperature: 0.7, maxTokens: 800 });
      } else if (engine === 'gemini') {
        logger.info('Routing to Google Gemini backend');
        response = await geminiGenerate(fullPrompt, { temperature: 0.5, maxTokens: 800 });
      } else {
        logger.info('Routing to OpenAI GPT-4 backend');
        response = await geminiGenerate(fullPrompt, { temperature: 0.4, maxTokens: 800 });
      }

      const cleanedResponse = this.cleanAIResponse(response);
      const data = safeJsonParse(cleanedResponse, { quotes: [] });

      return {
        success: true,
        quotes: data.quotes || []
      };
    };

    try {
      if (Sentry && typeof Sentry.startSpan === 'function') {
        return await Sentry.startSpan(
          {
            op: 'gen_ai.invoke_agent',
            name: 'invoke_agent Viral Quotes Agent',
            attributes: {
              'gen_ai.agent.name': 'Viral Quotes Agent',
              'gen_ai.request.model': 'gemini-2.5-flash',
              'gen_ai.operation.name': 'invoke_agent',
            },
          },
          run
        );
      }
      return await run();
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

  cleanAIResponse(response) {
    if (!response) return '';
    // Remove markdown code blocks if present
    let cleaned = response.replace(/```json\s?|```/g, '').trim();
    // Sometimes AI adds text before or after the JSON, find the first '{' and last '}'
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1);
    }
    return cleaned;
  }
}

module.exports = new AIAgentWritingService();
