/**
 * Creativity Engine Service
 * Prevents creative stagnation and drives originality for 2026.
 * - Content diversity scoring (Shannon entropy across topics, formats, tones)
 * - Repetition detection (hooks, topics, formats)
 * - 10 novel angles via lateral thinking provocations
 * - Curated inspiration drops from proven marketing frameworks
 */

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

const LATERAL_PROVOCATIONS = [
  'What if the opposite of your usual topic was the real story?',
  'What does your audience secretly believe but is afraid to say out loud?',
  'What would a contrarian expert in your niche argue right now?',
  'What\'s the most boring aspect of your niche — and why is it actually fascinating?',
  'What would this topic look like from the perspective of a 10-year-old?',
  'What\'s the thing nobody in your niche talks about but everyone experiences?',
  'What myth in your niche did you believe until recently?',
  'What crossover exists between your niche and something completely unrelated?',
  'What would happen if you did the exact opposite of the most common advice?',
  'What does your audience misunderstand about your niche most often?',
];

const INSPIRATION_DROPS = {
  video: [
    { framework: 'Curiosity Gap Method', principle: 'Create a knowledge gap the viewer cannot resist filling.', execution: 'Open with a provocative question your audience assumes they know the answer to — then reveal they\'re wrong by second 20.', example: '"You\'ve been doing [habit] wrong for years. Here\'s what data actually shows..."' },
    { framework: 'Parasocial Bridge', principle: 'Collapse creator-audience distance through radical transparency.', execution: 'Film a 60-second unscripted "thinking out loud" segment — raw problem-solving, no b-roll, no music.', example: 'Show yourself genuinely stuck on a problem, then work through it live.' },
    { framework: '3-Act Retention Arc', principle: 'Structure content like a film: status quo, disruption, resolution.', execution: 'Act 1: audience\'s current reality. Act 2: surprising disruption. Act 3: specific actionable resolution.', example: '"Most advice says X. (Act 1) Here\'s why X fails 73% of the time. (Act 2) Do Y instead: here\'s exactly how. (Act 3)"' },
  ],
  social: [
    { framework: 'Reciprocity Stack', principle: 'Give value in increasing tiers before any ask.', execution: 'Post 3 consecutive high-value pieces (tip → tool → template) with zero CTA. On post 4, make your ask.', example: 'Day 1: tip. Day 2: tool. Day 3: template. Day 4: ask.' },
    { framework: 'Pattern Interrupt Sequencing', principle: 'Break the scroll trance with visual or linguistic surprise.', execution: 'Lead with the last sentence of your usual post structure. Visually invert your brand palette. Start mid-sentence.', example: '"—and that\'s why it changed everything. Wait, let me start over."' },
  ],
};

function shannonEntropy(values) {
  if (!values.length) return 0;
  const freq = {};
  values.forEach((v) => { freq[v] = (freq[v] || 0) + 1; });
  const n = values.length;
  return -Object.values(freq).reduce((sum, count) => { const p = count / n; return sum + p * Math.log2(p); }, 0);
}

function entropyToScore(entropy, maxPossible) {
  if (maxPossible === 0) return 100;
  return Math.min(100, Math.round((entropy / maxPossible) * 100));
}

async function analyzeCreativityScore(userId, recentContent = []) {
  try {
    if (!recentContent.length) return { score: 0, verdict: 'No content to analyse', breakdown: {}, suggestions: [] };

    const topics   = recentContent.map((c) => (c.topic || c.title || '').toLowerCase().split(' ').slice(0, 2).join('-'));
    const formats  = recentContent.map((c) => c.type || c.format || 'unknown');
    const platforms = recentContent.map((c) => c.platform || 'unknown');
    const tones    = recentContent.map((c) => c.tone || 'neutral');

    const topicScore   = entropyToScore(shannonEntropy(topics),   Math.log2(Math.max(new Set(topics).size, 1)));
    const formatScore  = entropyToScore(shannonEntropy(formats),  Math.log2(Math.max(new Set(formats).size, 1)));
    const platformScore = entropyToScore(shannonEntropy(platforms), Math.log2(Math.max(new Set(platforms).size, 1)));
    const toneScore    = entropyToScore(shannonEntropy(tones),    Math.log2(Math.max(new Set(tones).size, 1)));

    const overallScore = Math.round(topicScore * 0.40 + formatScore * 0.30 + platformScore * 0.20 + toneScore * 0.10);

    let verdict;
    if (overallScore >= 80) verdict = '🎨 Highly original — your audience stays engaged';
    else if (overallScore >= 60) verdict = '💡 Good diversity — room to experiment more';
    else if (overallScore >= 40) verdict = '⚠️ Moderate repetition — refresh your approach';
    else verdict = '🔴 High repetition detected — your audience is tuning out';

    const suggestions = [];
    if (topicScore < 50) suggestions.push('Explore 3 new topic angles using the Curiosity Gap Method');
    if (formatScore < 50) suggestions.push('Try a format unused in 2 weeks (carousel, live, text-only)');
    if (platformScore < 50) suggestions.push('Repurpose your best piece to 2 platforms you haven\'t posted on this month');
    if (toneScore < 50) suggestions.push('Experiment with a contrarian or humorous tone in your next post');

    return { score: overallScore, verdict, breakdown: { topicScore, formatScore, platformScore, toneScore }, uniqueContentCount: recentContent.length, suggestions, generatedAt: new Date().toISOString() };
  } catch (error) {
    logger.error('analyzeCreativityScore error', { error: error.message, userId });
    return { score: 50, verdict: 'Analysis unavailable', breakdown: {}, suggestions: [] };
  }
}

async function detectRepetition(userId, recentContent = []) {
  try {
    if (recentContent.length < 3) return { repetitions: [], severity: 'none', message: 'Not enough content to detect patterns.' };

    const topicCount = {};
    const hookStart = {};
    const formatCount = {};

    recentContent.forEach((c) => {
      const topic = (c.topic || c.title || 'unknown').toLowerCase();
      topicCount[topic] = (topicCount[topic] || 0) + 1;
      const hook = (c.hook || c.title || '').toLowerCase().split(' ').slice(0, 3).join(' ');
      if (hook) hookStart[hook] = (hookStart[hook] || 0) + 1;
      const fmt = c.type || c.format || 'unknown';
      formatCount[fmt] = (formatCount[fmt] || 0) + 1;
    });

    const repetitions = [];
    Object.entries(topicCount).filter(([, n]) => n >= 3).forEach(([topic, n]) => repetitions.push({ type: 'topic', value: topic, occurrences: n, recommendation: `Retire "${topic}" for 2 weeks. Find a fresh angle.` }));
    Object.entries(hookStart).filter(([, n]) => n >= 2).forEach(([hook, n]) => repetitions.push({ type: 'hook-pattern', value: hook, occurrences: n, recommendation: `"${hook}..." hook is overused. Try starting mid-sentence or with a statistic.` }));
    const total = recentContent.length;
    Object.entries(formatCount).filter(([, n]) => (n / total) > 0.6).forEach(([fmt, n]) => repetitions.push({ type: 'format', value: fmt, occurrences: n, recommendation: `${Math.round((n/total)*100)}% of posts are ${fmt}. Break the pattern.` }));

    const severity = repetitions.length === 0 ? 'none' : repetitions.length <= 2 ? 'low' : repetitions.length <= 4 ? 'medium' : 'high';
    return { repetitions, severity, totalAnalysed: total, message: repetitions.length === 0 ? 'Great diversity! No repetition detected.' : `${repetitions.length} repetition pattern(s) detected.`, generatedAt: new Date().toISOString() };
  } catch (error) {
    logger.error('detectRepetition error', { error: error.message, userId });
    return { repetitions: [], severity: 'unknown', message: 'Analysis unavailable.' };
  }
}

async function generateFreshAngles(userId, topic, niche) {
  try {
    if (!geminiConfigured) {
      return {
        angles: LATERAL_PROVOCATIONS.map((p, i) => ({
          angle: `${p.replace('your niche', niche)}`,
          format: ['reel', 'carousel', 'text', 'video', 'poll', 'series', 'challenge', 'collab', 'data-post', 'behind-scenes'][i],
          hook: `What if everything you knew about ${topic} was slightly wrong?`,
          lateralTrigger: p,
          originalityScore: 70 + Math.floor(Math.random() * 20),
        })),
        topic, niche, source: 'lateral-thinking-library',
      };
    }

    const prompt = `You are a lateral thinking creativity director for content creators.
Topic: "${topic}" | Niche: "${niche}"
Lateral provocations: ${LATERAL_PROVOCATIONS.slice(0, 5).join(' | ')}

Generate 10 GENUINELY ORIGINAL content angle ideas. Each must be:
- Surprising and non-obvious
- Executable as social media content within 24 hours
- Using a different lateral approach

Return JSON with "angles" array. Each: angle, format, hook, lateralTrigger, originalityScore (0-100).
Seed: ${Math.random().toString(36).substring(7)}. Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 1800, temperature: 0.95 });
    const parsed = JSON.parse(response || '{}');
    return { angles: parsed.angles || [], topic, niche, generatedAt: new Date().toISOString(), source: 'ai-lateral-thinking' };
  } catch (error) {
    logger.error('generateFreshAngles error', { error: error.message, userId, topic, niche });
    return { angles: [], topic, niche, source: 'error' };
  }
}

function getInspirationDrop(niche, format = 'video') {
  const pool = INSPIRATION_DROPS[format] || INSPIRATION_DROPS.social;
  const drop = pool[Math.floor(Math.random() * pool.length)];
  return {
    ...drop,
    niche, format,
    adaptedExecution: drop.execution.replace(/\[habit\]/gi, `your ${niche} habit`),
    challengeForToday: `Apply the "${drop.framework}" to your next ${niche} ${format} post.`,
    source: 'open-source-marketing-playbook',
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { analyzeCreativityScore, detectRepetition, generateFreshAngles, getInspirationDrop, LATERAL_PROVOCATIONS, INSPIRATION_DROPS };
