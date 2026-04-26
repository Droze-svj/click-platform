/**
 * marketingKnowledge.js
 *
 * Click's "unlimited insight on marketing" lives here. This module is a single
 * source of truth that every AI-facing route can pull from to inject niche- and
 * platform-specific guidance into system prompts. It replaces the stock
 * "you are a helpful marketing assistant" boilerplate with concrete, opinionated
 * playbooks based on what actually performs.
 *
 * Usage
 *   const { getKnowledgeSlice, buildSystemPrompt } = require('../services/marketingKnowledge');
 *   const slice = getKnowledgeSlice({ niche: 'finance', platform: 'tiktok', stage: 'script' });
 *   const system = buildSystemPrompt({ persona: 'script-writer', niche, platform, stage });
 */

// ── Universal hook frameworks (proven across niches) ──────────────────────
const HOOK_FRAMEWORKS = [
  { id: 'curiosity-gap',   pattern: 'Open with a surprising claim, then withhold the answer until 0:08+. Forces a re-watch loop.', example: 'Most people get this wrong about [topic] — and it costs them [outcome].' },
  { id: 'pattern-break',   pattern: 'Lead with a visual/audio cue that contradicts viewer expectation in the first 0.6s.', example: 'Hard cut to "STOP" lower-third over a calm B-roll.' },
  { id: 'before-after',    pattern: 'Show endpoint first, then rewind to setup. Compresses payoff distance.', example: 'I went from 0 to 100k in 90 days. Here is exactly what changed.' },
  { id: 'enemy-frame',     pattern: 'Name a common practice you reject. Polarizing → high comment density.', example: 'Stop posting daily. It is the slowest way to grow in 2026.' },
  { id: 'problem-promise', pattern: 'State pain in plain language, then promise a single specific solution.', example: 'If your videos cap at 1k views, the issue is not the algorithm — it is your first 2 seconds.' },
  { id: 'list-tease',      pattern: 'Number the payoff. "3 things", "7 mistakes". Cognitively cheap to consume.', example: '5 captions you should never use on TikTok.' },
  { id: 'quote-cold-open', pattern: 'Open on a written quote held for 1.5s, no voice — eyes lock to read.', example: '"Your retention is your real follower count." — held centered.' },
  { id: 'data-flex',       pattern: 'Lead with a specific number ($, %, or count). Specificity beats authority claims.', example: '83% of accounts under 10k post the wrong content type.' },
];

// ── Retention curves (where viewers drop in 30-60s short-form) ────────────
const RETENTION_CURVES = {
  'short-form': [
    { mark: '0–2s',   rule: 'Eliminate every word that is not the hook. No "Hey guys" / "Today I want to talk about". Get to the promise.' },
    { mark: '2–5s',   rule: 'Show the proof or visual that backs the hook. If it is a claim, viewers need a reason to keep watching.' },
    { mark: '5–15s',  rule: 'Begin payoff. Keep cuts under 1.8s on average. Add a captioned key-phrase every 2–3s.' },
    { mark: '15–25s', rule: 'Mid-roll re-hook: a callback to the opening promise or an unexpected twist. Recovers ~12% of departures.' },
    { mark: '25–end', rule: 'Land the takeaway in one sentence. Optional CTA — soft "follow for X" outperforms "comment your thoughts".' },
  ],
  'long-form': [
    { mark: '0–10s',  rule: 'Pre-roll hook + table of contents. Tell them what they are getting and why it is worth 8 minutes.' },
    { mark: '10–60s', rule: 'Establish credibility with a single concrete proof — never with credentials.' },
    { mark: '1–3min', rule: 'First payoff. Reward early viewers so they signal positive watch-time to the algorithm.' },
    { mark: '3min+',  rule: 'Pacing dips here. Insert a pattern interrupt (cut to b-roll, on-screen graphic, or zoom punch) every 30s.' },
  ],
};

// ── Platform-specific best practices ─────────────────────────────────────
const PLATFORM_PLAYBOOKS = {
  tiktok: {
    aspectRatio: '9:16',
    idealLength: '15–34s (sweet spot is the "complete" range, not the "watched" range)',
    hookWindow: '0.6s',
    captionStyle: 'High-contrast, sentence-case, 1–4 words per chunk, snap to syllable.',
    cta: 'Soft. "Save this" or "Follow for part 2" outperforms "Like and subscribe".',
    hashtags: '3–5 max. Mix one broad (#fyp), 1–2 niche (#financetok), 1 trend-of-the-week.',
    soundStrategy: 'Use a trending sound at low volume under your VO when possible — boosts FYP eligibility.',
    avoid: ['Watermarks from other apps', 'Vertical letterboxing', 'Whisper-quiet first frame'],
  },
  instagram: {
    aspectRatio: '9:16 for Reels, 4:5 for feed',
    idealLength: '7–15s for highest replay rate; 30–60s for educational',
    hookWindow: '0.8s',
    captionStyle: 'Larger text, brand-coloured pill background. Caps for emphasis only.',
    cta: 'Drive to comment ("Reply A or B"), DMs ("DM me \'guide\'"), or save.',
    hashtags: '5–10. Niche > broad. Avoid banned-list tags.',
    soundStrategy: 'Original audio + a small clip of trending audio at the start tends to outperform pure trending.',
    avoid: ['TikTok-style green-screen with watermark', 'Swearing in caption (suppresses reach)'],
  },
  'youtube-shorts': {
    aspectRatio: '9:16',
    idealLength: '24–58s (Shorts cap is 60s — pacing for ~50s lets you punch a CTA without rushing)',
    hookWindow: '1.2s',
    captionStyle: 'Bold yellow/white serif, anchored to the lower third. Avoid covering faces.',
    cta: 'Channel-page CTA: "More on the main channel" works better than "subscribe".',
    hashtags: '#Shorts as the FIRST tag in description, then 2–3 niche.',
    soundStrategy: 'YT prioritises original audio for Shorts → trending sounds matter less here than on TikTok.',
    avoid: ['Reposting TikTok with watermark', 'Cliffhanger that does not resolve in 60s'],
  },
  youtube: {
    aspectRatio: '16:9',
    idealLength: '8–14 minutes is the monetization sweet spot (mid-roll-eligible at 8min+)',
    hookWindow: '15s (stays watchable)',
    captionStyle: 'Burned subtitles optional; auto-captions OK. Lower-thirds for guests/sources.',
    cta: 'End-screen subscribe + suggested next video. CTA at 60–90% mark, not the end.',
    hashtags: '3 in description, first one is the strongest niche tag.',
    soundStrategy: 'Music ducked to -22 LUFS under VO. Avoid copyrighted backing tracks.',
    avoid: ['Clickbait titles that contradict the video', 'Long static intros (>5s)'],
  },
  twitter: {
    aspectRatio: '16:9 or 1:1',
    idealLength: '30–90s. Native video gets ~2x reach over linked YouTube.',
    hookWindow: '1.5s',
    captionStyle: 'Burned captions critical (autoplay is muted). Bottom-anchored.',
    cta: 'Pin the tweet, quote-tweet a viral thread for distribution.',
    hashtags: 'One, max. Twitter penalises hashtag spam.',
    soundStrategy: 'N/A — assume muted playback.',
    avoid: ['Calls to "comment below" (use replies)', 'Aspect ratios outside 16:9 / 1:1'],
  },
  linkedin: {
    aspectRatio: '1:1 or 4:5',
    idealLength: '30–90s for organic reach; 60–180s for thought-leadership',
    hookWindow: '2s',
    captionStyle: 'Burned captions. Professional sans-serif. No memes.',
    cta: 'Drive to a long-form post or article. "Comment for the doc" works.',
    hashtags: '3–5 industry-specific. No trending tags.',
    soundStrategy: 'Music optional. Most users autoplay muted.',
    avoid: ['TikTok-style cuts (feels cheap on LI)', 'Personal-brand humblebrags'],
  },
};

// ── Niche playbooks ──────────────────────────────────────────────────────
const NICHE_PLAYBOOKS = {
  health: {
    voice: 'Authoritative but not preachy. Cite a study or specific protocol.',
    angles: ['Common myths debunked', 'Before/after transformation', 'Doctor-said-this', 'Habit stacks (under 5 min/day)', 'Bloodwork / data reveal'],
    triggers: ['Specific numbers (g, mg, %)', 'Counterintuitive findings', 'Side-effect callouts'],
    avoid: ['Medical claims without source', 'Body-shaming framing', 'Diet absolutism'],
    keywords: ['protein synthesis', 'cortisol', 'longevity', 'biomarkers', 'circadian'],
  },
  finance: {
    voice: 'Confident, specific, math-forward. Dollar amounts beat percentages.',
    angles: ['Mistake countdown (e.g. "5 IRA mistakes")', 'Income breakdown', 'Tax loophole', 'Cost-of-X reveal', 'Side-hustle month-by-month'],
    triggers: ['Dollar specificity ($4,237 not "around $4k")', 'Time-to-money ("in 90 days")', 'Risk reframe'],
    avoid: ['"Get rich quick" framing', 'Stock picks without disclaimer', 'Crypto pump language'],
    keywords: ['HYSA', 'Roth', '401k match', 'tax bracket', 'compound interest', 'dividend'],
  },
  education: {
    voice: 'Clear, structured, patient. Promise one thing per video.',
    angles: ['"Things they did not teach you"', 'Step-by-step walkthroughs', 'Comparison (A vs B)', 'Common-mistake roundup', 'Cheatsheet reveal'],
    triggers: ['Specific tool names', 'Time-savings callouts', 'Visual diagrams on screen'],
    avoid: ['Lecture-mode (face-only talking head)', 'Buzzwords without examples'],
    keywords: ['framework', 'mental model', 'step-by-step', 'system', 'workflow'],
  },
  technology: {
    voice: 'Sharp, opinionated, demos > theory. Show working software.',
    angles: ['Tool battle (X vs Y)', 'Build-in-public update', 'Stack reveal', 'Workflow speed-up', 'Future predictions backed by data'],
    triggers: ['Latency / speed numbers', 'Side-by-side speed comparisons', 'Hands-on screen recording'],
    avoid: ['Slide-deck-only videos', 'Hyperbolic "X killer" titles'],
    keywords: ['stack', 'pipeline', 'latency', 'open source', 'workflow'],
  },
  lifestyle: {
    voice: 'Aspirational but achievable. POV framing performs.',
    angles: ['Day-in-the-life', 'Routine reveal', 'Get-ready-with-me', 'Aesthetic transformation', 'Minimalism / maximalism'],
    triggers: ['Concrete habits (not vibes)', 'Cost reveals', 'Time-stamps'],
    avoid: ['Vague "live your best life" framing', 'Excess gear promotion'],
    keywords: ['routine', 'system', 'ritual', 'morning', 'evening', 'reset'],
  },
  business: {
    voice: 'Operator, not guru. Numbers and concrete tactics.',
    angles: ['Revenue breakdown', 'Tactic that returned X', 'Mistake post-mortem', 'Hiring story', 'Pricing reveal'],
    triggers: ['Real revenue numbers', 'Customer count', 'CAC / LTV / churn'],
    avoid: ['"Mindset" content with no tactic', '"7-figure" without proof'],
    keywords: ['MRR', 'churn', 'CAC', 'pipeline', 'retention', 'positioning'],
  },
  entertainment: {
    voice: 'Personality-forward. Pace + punchlines > information density.',
    angles: ['Reaction', 'Recap with hot take', 'Storytime', 'Skit / character', 'Behind-the-scenes'],
    triggers: ['Strong facial expressions', 'Audio jump scares', 'Callback gags'],
    avoid: ['Slow setups', 'Inside jokes that exclude new viewers'],
    keywords: ['reaction', 'POV', 'storytime', 'caught on camera', 'wait for it'],
  },
  other: {
    voice: 'Adapt to creator energy. Default to specific + visual.',
    angles: ['Reveal', 'Walkthrough', 'Comparison', 'Listicle'],
    triggers: ['Specificity', 'Visual proof', 'Concrete numbers'],
    avoid: ['Generic motivational content'],
    keywords: [],
  },
};

// ── CTA library ──────────────────────────────────────────────────────────
const CTA_LIBRARY = {
  save:     ['Save this for the next time it happens.', 'You will want this when…'],
  follow:   ['More like this on the page.', 'Part 2 drops tomorrow.'],
  share:    ['Send this to the friend who needs it.', 'Tag someone who would relate.'],
  comment:  ['Reply A or B and I will follow up.', 'What did I miss? Drop it below.'],
  dm:       ['DM me "[keyword]" for the doc.', 'DM "GUIDE" for the swipe file.'],
  click:    ['Link in bio for the full breakdown.', 'Full version on the channel.'],
};

// ── Language + region awareness ──────────────────────────────────────────
//
// Click is global. Three things shift per locale:
//   1. The output language itself (the AI must reply in the user's tongue).
//   2. Cultural register — same "voice" lands differently in different places.
//   3. Hashtag / handle conventions — Latin-script hashtags work everywhere
//      while Devanagari/CJK hashtags work but should be paired with Latin
//      versions for cross-platform reach.
const LANGUAGE_PROFILES = {
  'en':      { name: 'English',                        register: 'Direct, casual, mild slang OK. North-American defaults.', hashtagScript: 'latin', regionalNotes: '' },
  'es':      { name: 'Spanish',                        register: 'Warm, conversational. Default to neutral LATAM Spanish unless creator signals Spain.', hashtagScript: 'latin', regionalNotes: 'Avoid voseo unless creator is Argentine.' },
  'fr':      { name: 'French',                         register: 'Polished, witty. Avoid anglicisms when a clean French equivalent exists.', hashtagScript: 'latin', regionalNotes: '' },
  'de':      { name: 'German',                         register: 'Precise, low fluff. Compound nouns are fine — readers expect them.', hashtagScript: 'latin', regionalNotes: '' },
  'pt':      { name: 'Brazilian Portuguese',           register: 'Energetic, informal. PT-BR by default; switch to PT-PT only if creator signals Portugal.', hashtagScript: 'latin', regionalNotes: '' },
  'it':      { name: 'Italian',                        register: 'Expressive but tight. Sentence-level rhythm matters.', hashtagScript: 'latin', regionalNotes: '' },
  'ja':      { name: 'Japanese',                       register: 'Polite default (です/ます). Casual register only if niche is youth/entertainment.', hashtagScript: 'mixed', regionalNotes: 'Hashtags usually Latin; native script tags in Japanese are gaining ground.' },
  'ko':      { name: 'Korean',                         register: '존댓말 unless creator is clearly casual. Short punchy sentences perform.', hashtagScript: 'mixed', regionalNotes: 'Mix Hangul + Latin hashtags for cross-platform reach.' },
  'zh-Hans': { name: 'Simplified Chinese',             register: '简体中文, 小红书/抖音风格. Avoid繁体 even if user writes繁体.', hashtagScript: 'mixed', regionalNotes: 'Topic tags often replace hashtags on Douyin (#话题). On YouTube/IG keep Latin.' },
  'ar':      { name: 'Modern Standard Arabic',         register: 'Use MSA for cross-region reach; mention dialect only when niche is hyper-local.', hashtagScript: 'arabic', regionalNotes: 'RTL in copy. Hashtags can mix Arabic + Latin for discoverability.' },
  'hi':      { name: 'Hindi',                          register: 'Conversational Hindi-English code-mix is normal on YouTube/IG. Pure Hindi for traditional niches.', hashtagScript: 'latin', regionalNotes: 'Devanagari for body, Latin transliteration for hashtags.' },
  'ru':      { name: 'Russian',                        register: 'Direct, witty. Avoid forced anglicisms.', hashtagScript: 'cyrillic', regionalNotes: 'Hashtags can be Cyrillic; mix with Latin for cross-platform.' },
};

function normaliseLanguage(l) {
  if (!l || typeof l !== 'string') return 'en';
  const lower = l.toLowerCase();
  if (LANGUAGE_PROFILES[lower]) return lower;
  if (LANGUAGE_PROFILES[l]) return l; // preserves 'zh-Hans' camel case
  const base = lower.split('-')[0];
  if (base === 'zh') return 'zh-Hans';
  for (const code of Object.keys(LANGUAGE_PROFILES)) {
    if (code.toLowerCase().startsWith(base)) return code;
  }
  return 'en';
}

// ── Public API ───────────────────────────────────────────────────────────
function normaliseNiche(n) {
  if (!n || typeof n !== 'string') return 'other';
  const k = n.toLowerCase().trim();
  return NICHE_PLAYBOOKS[k] ? k : 'other';
}

function normalisePlatform(p) {
  if (!p || typeof p !== 'string') return 'tiktok';
  const k = p.toLowerCase().replace(/\s+/g, '-');
  return PLATFORM_PLAYBOOKS[k] ? k : 'tiktok';
}

/**
 * Returns a structured object covering everything the AI should know for a
 * given (niche, platform, stage) tuple. Stage is one of: ingest, script, edit,
 * schedule, analyze.
 */
function getKnowledgeSlice({ niche, platform, stage = 'script', language = 'en' } = {}) {
  const n = normaliseNiche(niche);
  const p = normalisePlatform(platform);
  const lang = normaliseLanguage(language);
  const np = NICHE_PLAYBOOKS[n];
  const pp = PLATFORM_PLAYBOOKS[p];
  const lp = LANGUAGE_PROFILES[lang];
  const lengthClass = ['youtube'].includes(p) ? 'long-form' : 'short-form';

  return {
    niche: n,
    platform: p,
    stage,
    language: lang,
    nichePlaybook: np,
    platformPlaybook: pp,
    languageProfile: lp,
    retention: RETENTION_CURVES[lengthClass],
    hooks: HOOK_FRAMEWORKS,
    ctas: CTA_LIBRARY,
  };
}

/**
 * Builds a ready-to-paste system prompt block for chat-completion calls.
 * `persona` controls voice; the rest is auto-derived from the slice.
 */
function buildSystemPrompt({ persona = 'script-writer', niche, platform, stage = 'script', language = 'en', extra = '' } = {}) {
  const slice = getKnowledgeSlice({ niche, platform, stage, language });
  const np = slice.nichePlaybook;
  const pp = slice.platformPlaybook;
  const lp = slice.languageProfile;

  const personaLine = {
    'script-writer':   'You are Click — a senior short-form scriptwriter who has written for top-1% creators in this niche.',
    'caption-writer':  'You are Click — a caption strategist who has analysed the top 100 viral videos in this niche this month.',
    'edit-suggester':  'You are Click — a senior video editor advising on cuts, motion, and overlays.',
    'thumbnail':       'You are Click — a thumbnail and cold-open strategist.',
    'marketing-coach': 'You are Click — a direct, no-fluff marketing coach.',
  }[persona] || 'You are Click — a marketing-minded creative collaborator.';

  return [
    personaLine,
    '',
    `Niche: ${slice.niche.toUpperCase()}. Platform: ${slice.platform.toUpperCase()}. Stage: ${stage}. Language: ${lp.name.toUpperCase()}.`,
    '',
    '── Language & locale ──',
    `Output language: ${lp.name}. Write all user-facing copy (script body, captions, CTAs, hashtags) in ${lp.name}.`,
    `Register: ${lp.register}`,
    lp.regionalNotes ? `Regional notes: ${lp.regionalNotes}` : '',
    `Hashtag script: ${lp.hashtagScript === 'latin' ? 'Latin script.' : lp.hashtagScript === 'arabic' ? 'Arabic + a Latin alternative for cross-platform reach.' : lp.hashtagScript === 'cyrillic' ? 'Cyrillic + a Latin alternative for cross-platform reach.' : 'Mix native script and Latin so the post indexes in both ecosystems.'}`,
    '',
    '── Niche playbook ──',
    `Voice: ${np.voice}`,
    `Proven angles: ${np.angles.join(' · ')}`,
    `Performance triggers: ${np.triggers.join(' · ')}`,
    `Avoid: ${np.avoid.join(' · ')}`,
    np.keywords?.length ? `Vocabulary that signals expertise (translate the IDEA, do not transliterate the English term): ${np.keywords.join(', ')}` : '',
    '',
    '── Platform playbook ──',
    `Aspect ratio: ${pp.aspectRatio} · Ideal length: ${pp.idealLength} · First-frame hook window: ${pp.hookWindow}`,
    `Captions: ${pp.captionStyle}`,
    `CTA strategy: ${pp.cta}`,
    `Hashtags: ${pp.hashtags}`,
    `Sound: ${pp.soundStrategy}`,
    `Avoid on this platform: ${pp.avoid.join(' · ')}`,
    '',
    '── Retention curve ──',
    ...slice.retention.map(r => `${r.mark}: ${r.rule}`),
    '',
    '── Output rules ──',
    `• Reply ENTIRELY in ${lp.name}. Do not mix English unless the niche/platform playbook explicitly calls for it.`,
    '• Be specific. Replace generic adjectives with numbers, examples, or named things.',
    '• Match the niche voice exactly — do not water it down to "professional".',
    '• If the user has not specified an angle, pick the strongest one from the playbook.',
    '• Hooks should pass the "would I keep scrolling" test in the first frame.',
    extra,
  ].filter(Boolean).join('\n');
}

/** A compact one-liner for low-token contexts (e.g. caption suggestions). */
function buildCompactGuidance({ niche, platform, stage = 'script', language = 'en' } = {}) {
  const slice = getKnowledgeSlice({ niche, platform, stage, language });
  const angles = (slice.nichePlaybook.angles || []).slice(0, 3).join(' · ');
  return `Reply in ${slice.languageProfile.name}. Niche=${slice.niche}, Platform=${slice.platform}. Voice: ${slice.nichePlaybook.voice} Top angles: ${angles}. Hook window: ${slice.platformPlaybook.hookWindow}. Avoid: ${(slice.nichePlaybook.avoid || []).slice(0, 2).join(', ')}.`;
}

module.exports = {
  HOOK_FRAMEWORKS,
  RETENTION_CURVES,
  PLATFORM_PLAYBOOKS,
  NICHE_PLAYBOOKS,
  CTA_LIBRARY,
  LANGUAGE_PROFILES,
  getKnowledgeSlice,
  buildSystemPrompt,
  buildCompactGuidance,
  normaliseNiche,
  normalisePlatform,
  normaliseLanguage,
};
