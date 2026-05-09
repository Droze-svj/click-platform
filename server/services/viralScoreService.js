/**
 * Viral Score Service
 * 
 * Predictive engine that scores content based on 4-factor viral heuristic.
 */

const { aiCallJson } = require('../utils/aiRouter');
const { buildSystemPrompt } = require('./marketingKnowledge');

async function predictViralScore(content, ctx = {}) {
  const { niche = 'business', platform = 'tiktok' } = ctx;
  const transcript = content.transcript?.text || (Array.isArray(content.transcript) ? content.transcript.map(w => w.word).join(' ') : '');
  
  const systemPrompt = buildSystemPrompt({
    persona: 'retention-strategist',
    niche,
    platform,
    stage: 'analysis',
    extra: 'Score the content from 0-100 on Virality potential. Be critical.'
  });

  const fallback = { score: 65, reasons: ['Standard pacing detected'], improvements: ['Stronger pattern interrupts'] };

  const prompt = `
    Analyze this video transcript for ${platform} in the ${niche} niche:
    
    Transcript: "${transcript.substring(0, 2000)}"
    
    Return JSON:
    {
      "score": number (0-100),
      "breakdown": {
        "hook": number,
        "retention": number,
        "nicheResonance": number
      },
      "reasons": string[],
      "prediction": "viral" | "steady" | "low-performance",
      "actionableFix": "string"
    }
  `;

  try {
    const result = await aiCallJson(prompt, fallback, { systemPrompt, taskType: 'viral-prediction', temperature: 0.3 });
    return result || fallback;
  } catch (err) {
    return fallback;
  }
}

module.exports = { predictViralScore };
