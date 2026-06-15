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
    voice: 'Confident, specific, math-forward. Dollar amounts beat percentages. Inclusive of starting points — debt-payoff and emergency-fund first, investing second.',
    angles: ['Mistake countdown (e.g. "5 IRA mistakes")', 'Income breakdown', 'Tax loophole', 'Cost-of-X reveal', 'Side-hustle month-by-month', 'Debt-payoff plan (defensive finance)', 'Emergency-fund build from $0', 'Living-on-low-income money mechanics'],
    triggers: ['Dollar specificity ($4,237 not "around $4k")', 'Time-to-money ("in 90 days")', 'Risk reframe'],
    avoid: ['"Get rich quick" framing', 'Stock picks without disclaimer', 'Crypto pump language', 'Assuming high-income or risk-tolerant audience'],
    keywords: ['HYSA', 'Roth', '401k match', 'tax bracket', 'compound interest', 'dividend', 'emergency fund', 'debt snowball', 'avalanche method'],
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
  // ── Expansion niches (added pass 6) — same shape as the originals so the
  // prompt block, posting windows, and keyword targeting all just work. ──
  crypto: {
    voice: 'Sober, data-first. Cite on-chain numbers, not vibes. Educator energy over hype.',
    angles: ['On-chain whale move breakdown', 'Tax / regulatory landmines', 'Protocol mechanism explained simply', 'Real-yield vs ponzi-yield', 'Long-time-horizon "boring wins" thesis'],
    triggers: ['Specific dollar flows ($217M into X)', 'Wallet-address-level proof', 'Cycle-aware framing (post-halving, pre-cycle)', 'Risk-first reframes'],
    avoid: ['"To the moon" / pump language', 'Unbacked price predictions', 'Insider language without explaining the term'],
    keywords: ['on-chain', 'TVL', 'cold storage', 'self-custody', 'real yield', 'cycle', 'liquidity', 'narrative', 'tokenomics'],
  },
  parenting: {
    voice: 'Warm, non-judgmental, evidence-aware. Talk to the parent, not at them. Inclusive of every family shape.',
    angles: ['Pediatrician-said-this myth-bust', 'Developmental milestone reframe', 'Real-day chaos POV', 'Gear-that-actually-works review', 'Co-parent dynamics (any family shape)', 'Single-parent reality check', 'Two-mom / two-dad family moments', 'Grandparent-as-caregiver POV', 'Step-parent / blended-family scenarios'],
    triggers: ['Age-specific specificity ("at 14 months…")', 'Permission-giving language', 'Honest-mess footage (lived-in vs aspirational)'],
    avoid: ['Sanctimommy framing', 'Fear-based clickbait about child harm', 'One-size-fits-all parenting rules', 'Assuming two-parent / cisgender / heteronormative household by default'],
    keywords: ['developmental', 'sleep regression', 'sensory', 'gentle parenting', 'milestone', 'nap', 'wonder week', 'transition', 'co-parenting', 'blended family'],
  },
  beauty: {
    voice: 'Knowledgeable best-friend energy. Concrete ingredients + technique > brand worship. Inclusive of every skin type, age, gender, and condition.',
    angles: ['Ingredient deep-dive (what retinol actually does)', 'Dupe reveal w/ side-by-side', 'Get-ready-with-me + technique callout', 'Skin-type-specific routine', 'Before/after w/ honest timeline', 'Barrier repair / skin-condition focus (eczema, rosacea, acne)', 'Men\'s skincare basics', 'Mature-skin routine (40+)', 'Deeper-skin-tone-specific shade matching', 'Minimal / "skinimalism" routine'],
    triggers: ['Specific %s ("2% salicylic")', 'Texture/finish callouts on camera', 'Honest pricing breakdown', 'Skin-type + age-range disclosure'],
    avoid: ['"This changed my life" with no detail', 'Hidden affiliate framing', 'Filtered before-after that misleads', 'Defaulting to one body / gender / age / skin tone as the assumed viewer'],
    keywords: ['retinol', 'niacinamide', 'glaze', 'lid', 'crease', 'undertone', 'glass skin', 'cool-toned', 'dewy', 'matte', 'barrier repair', 'ceramides'],
  },
  wellness: {
    voice: 'Calm, grounded, evidence-respecting but not clinical. Permission to start small. Aware that wellness shows up differently across cultures and bodies.',
    angles: ['Stress physiology explained simply', 'Tiny-habit stack (2-minute version)', 'Sleep architecture deep-dive', 'Nervous-system reset technique', 'Burnout recovery roadmap', 'Culturally-rooted wellness practice (e.g. Ayurveda, TCM, Indigenous) with respect, not appropriation', 'Faith-based wellness (prayer, fasting, Sabbath rhythms) when relevant', 'Disability-aware wellness (chair-based, low-spoon)', 'Wellness on a budget'],
    triggers: ['Cited mechanisms (cortisol, vagus nerve, HRV)', 'Permission-to-suck framing for hard days', 'Habit-stacking with existing routine'],
    avoid: ['"Everything is trauma" overreach', 'Healing absolutism', 'Selling a course inside a free video', 'Defaulting to Western individualist framing as universal'],
    keywords: ['nervous system', 'HRV', 'vagal tone', 'somatic', 'glymphatic', 'reset', 'co-regulation', 'parasympathetic', 'cultural practice', 'rest ethic'],
  },
  science: {
    voice: 'Curious explainer. Awe + specificity. Translate jargon without dumbing down the idea.',
    angles: ['Counterintuitive finding from recent paper', 'How does X actually work (steel-man the curiosity)', 'Common-knowledge debunk with source', 'Why-this-matters tie-back', 'Visualization of a scale humans can\'t intuit'],
    triggers: ['Recent-paper citation w/ year', 'Scale comparisons ("a teaspoon = a billion stars")', 'Hands-on demo or simulation'],
    avoid: ['"Scientists hate this" framing', 'Overclaiming preliminary results', 'Single-study-as-fact'],
    keywords: ['hypothesis', 'replication', 'effect size', 'mechanism', 'first-principles', 'order of magnitude', 'p<0.05', 'meta-analysis'],
  },
  gaming: {
    voice: 'High-energy, community-aware. Specifics about builds, patches, meta. Insider literacy.',
    angles: ['Patch winners/losers', 'Build guide w/ rotation', 'Tier list with reasoning', 'Speedrun trick / glitch', 'Esports moment breakdown'],
    triggers: ['Patch number specificity (e.g. "14.21 changed…")', 'Exact APM / KDA / damage numbers', 'Frame-perfect callouts'],
    avoid: ['"This game is dead" doomposting', 'Spoilers in title without warning', 'Gatekeeping vocab'],
    keywords: ['meta', 'patch', 'nerf', 'buff', 'comp', 'rotation', 'macro', 'micro', 'tilt', 'matchup', 'frame data'],
  },
  other: {
    voice: 'Adapt to creator energy. Default to specific + visual.',
    angles: ['Reveal', 'Walkthrough', 'Comparison', 'Listicle'],
    triggers: ['Specificity', 'Visual proof', 'Concrete numbers'],
    avoid: ['Generic motivational content'],
    keywords: [],
  },
};

// ── Niche posting windows ──────────────────────────────────────────────────
// Empirical "best windows" by niche, expressed as 24h hour ranges in the
// creator's local timezone. Used by /scheduling/optimal-windows alongside
// platform peak hours and the creator's historical engagement-by-hour to
// produce the top-3 recommended slots.
const NICHE_POSTING_WINDOWS = {
  health:        [{ start: 6,  end: 9,  label: 'Morning routine window' }, { start: 17, end: 20, label: 'Post-workout evening'  }],
  finance:       [{ start: 7,  end: 10, label: 'Pre-market commute'    }, { start: 19, end: 22, label: 'Post-dinner planning'   }],
  education:     [{ start: 8,  end: 11, label: 'Study-mode mornings'   }, { start: 16, end: 19, label: 'After-school review'    }],
  technology:    [{ start: 9,  end: 12, label: 'Workday peak'          }, { start: 20, end: 23, label: 'Evening tinkering'      }],
  lifestyle:     [{ start: 7,  end: 9,  label: 'Routine reveals'       }, { start: 19, end: 22, label: 'Wind-down hours'        }],
  business:      [{ start: 7,  end: 10, label: 'Pre-meeting scroll'    }, { start: 12, end: 14, label: 'Lunch break'             }],
  entertainment: [{ start: 18, end: 22, label: 'Prime-time'            }, { start: 22, end: 24, label: 'Late-night doomscroll' }],
  // Expansion niches — windows derived from how the audience consumes
  // content (e.g. crypto traders read pre-market; parents are awake at
  // dawn nap windows; gamers peak after work and on weekends).
  crypto:        [{ start: 7,  end: 10, label: 'Pre-market trader scroll' }, { start: 21, end: 24, label: 'Late-night degen hours' }],
  parenting:     [{ start: 5,  end: 8,  label: 'Pre-dawn nap window'   }, { start: 20, end: 23, label: 'After-bedtime decompress' }],
  beauty:        [{ start: 6,  end: 9,  label: 'Get-ready window'       }, { start: 19, end: 22, label: 'Evening skincare hour'  }],
  wellness:      [{ start: 6,  end: 9,  label: 'Morning reset'          }, { start: 20, end: 23, label: 'Wind-down ritual hour'   }],
  science:       [{ start: 11, end: 14, label: 'Lunch curiosity'        }, { start: 20, end: 23, label: 'Evening explainer time'  }],
  gaming:        [{ start: 16, end: 19, label: 'After-school session'   }, { start: 21, end: 24, label: 'Prime gaming hours'      }],
  other:         [{ start: 7,  end: 9,  label: 'Morning commute'       }, { start: 19, end: 22, label: 'Evening prime'           }],
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

/**
 * Niche-specific CTA overrides. Each entry is merged ON TOP of CTA_LIBRARY
 * by `getKnowledgeSlice`, so unspecified categories fall through to the
 * global pool. Add a niche here only when its CTAs genuinely land harder
 * than the generic ones — otherwise the global pool is fine.
 *
 * Finance leans DM-for-document and save-for-tax-season. Beauty leans
 * link-in-bio and save-for-shopping. Parenting drops the hard sell and
 * prioritises share-with-another-parent. Crypto stays cautious (no
 * "buy this", always "do your own research"). Gaming uses pin-the-comment
 * / part-2-on-stream framing.
 */
const CTA_LIBRARY_BY_NICHE = {
  finance: {
    save:    ['Save this — you will use it at tax time.', 'Bookmark this for your next 401k decision.'],
    dm:      ['DM "401K" and I will send you the spreadsheet.', 'DM "TAX" for the deduction checklist.'],
    comment: ['What income bracket should I run this for next? Drop it below.', 'Which mistake hits hardest? 1, 2, or 3?'],
  },
  crypto: {
    save:    ['Save this — re-read it during the next pump.', 'Bookmark for the next time the timeline is euphoric.'],
    dm:      ['DM "ONCHAIN" and I will send the dashboard link.', 'DM "SETUP" for the cold-storage checklist.'],
    comment: ['Not financial advice — what would you do here?', 'Which cycle phase do you think we are in? Drop it.'],
    follow:  ['More breakdowns like this on the page — no shilling, no pumps.'],
  },
  beauty: {
    click:   ['Every product linked in bio — no affiliates, just what worked.', 'Full routine with prices in bio.'],
    save:    ['Save this — you will want it on your next Sephora trip.', 'Save before the shade sells out.'],
    share:   ['Tag the friend who keeps asking what you use.'],
  },
  parenting: {
    share:   ['Send this to a friend who is in the trenches with you.', 'Tag the parent who needed to hear this today.'],
    save:    ['Save this for your next 3am self.', 'Bookmark for the next sleep regression.'],
    comment: ['What worked for you? Other parents are reading.', 'No advice without context — what age is your kid?'],
  },
  wellness: {
    save:    ['Save this for the day you cannot get out of bed.', 'Bookmark for your next stressful week.'],
    dm:      ['DM "RESET" for the 5-minute version of this.', 'DM "SLEEP" for the protocol PDF.'],
  },
  gaming: {
    follow:  ['Pinned comment has the full build.', 'Part 2 going live on stream tonight.'],
    comment: ['What rank are you running this in? Drop it below.', 'Drop your build and I will react to it next stream.'],
    save:    ['Save before the next patch nerfs this.'],
  },
};

// ── Niche-specific retention curve overrides ─────────────────────────────
//
// Pacing varies by niche even within "short-form". A finance explainer
// needs an authority signal early; a beauty get-ready-with-me can breathe;
// gaming punchlines need to hit before the patch-attention dies. Only
// override where the difference vs the default actually matters — every
// other niche uses RETENTION_CURVES['short-form'] as-is.
const RETENTION_CURVES_BY_NICHE = {
  finance: {
    'short-form': [
      { mark: '0–2s',   rule: 'Drop a specific dollar number in the first sentence — not a vague "save more". Specificity = credibility.' },
      { mark: '2–5s',   rule: 'Show the spreadsheet, statement, or chart on screen. Trust collapses without visual proof for money claims.' },
      { mark: '5–15s',  rule: 'One mistake or tactic per video. Do not stack 3 lessons — half the audience will skip the second one anyway.' },
      { mark: '15–25s', rule: 'Mid-roll: name the cost of getting it wrong. Loss-aversion is the strongest retention lever in finance content.' },
      { mark: '25–end', rule: 'Land with the bracket / band / age range this applies to. Specificity > catch-all.' },
    ],
  },
  education: {
    'short-form': [
      { mark: '0–2s',   rule: 'Open with the promise as a question the viewer is already asking. "Why X?" beats "Today I will teach you Y".' },
      { mark: '2–5s',   rule: 'Show the destination — the finished thing they will be able to do — before the steps.' },
      { mark: '5–15s',  rule: 'Step 1 must show visible progress. Educational drop-off is highest when step 1 feels like setup.' },
      { mark: '15–25s', rule: 'Insert a callback to step 1 inside step 3. Memory consolidation = re-watch + share.' },
      { mark: '25–end', rule: 'Single takeaway in a quotable sentence. Educators win when one line gets clipped into a tweet.' },
    ],
  },
  beauty: {
    'short-form': [
      { mark: '0–2s',   rule: 'Lead with the finished face/look or a counterintuitive ingredient claim. Skin transformations need an endpoint.' },
      { mark: '2–5s',   rule: 'Quick texture / pigment swatch close-up. Beauty viewers verify with their eyes before they trust.' },
      { mark: '5–15s',  rule: 'One technique at a time, slow enough to copy. Filmed-on-phone POV outperforms over-produced.' },
      { mark: '15–25s', rule: 'Reveal a dupe or a hack the audience did not see coming. This is the share moment.' },
      { mark: '25–end', rule: 'Show side-by-side under different lighting (overhead vs window). Anti-filter signals win trust.' },
    ],
  },
  gaming: {
    'short-form': [
      { mark: '0–2s',   rule: 'Open mid-action or on the moment of impact — never on a menu. The first frame must be loud.' },
      { mark: '2–5s',   rule: 'Caption the patch number / rank / build context so viewers know the stakes immediately.' },
      { mark: '5–15s',  rule: 'Pacing under 1.4s per cut. Frame data matters — slow clips feel dead in this niche.' },
      { mark: '15–25s', rule: 'Pattern interrupt: meme overlay, callback to a missed mechanic, or a chat reaction.' },
      { mark: '25–end', rule: 'Close with a "try this in your next match" — turns watch into action.' },
    ],
  },
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
  'nl':      { name: 'Dutch',                          register: 'Direct, natural, conversational but professional.', hashtagScript: 'latin', regionalNotes: '' },
  'pl':      { name: 'Polish',                         register: 'Engaging, friendly and culturally aware.', hashtagScript: 'latin', regionalNotes: '' },
  'tr':      { name: 'Turkish',                        register: 'Warm, sincere, and dynamic.', hashtagScript: 'latin', regionalNotes: '' },
};

function normaliseLanguage(l) {
  if (!l || typeof l !== 'string') return 'en';
  const lower = l.toLowerCase();
  const nameToCode = {
    english: 'en',
    spanish: 'es',
    french: 'fr',
    german: 'de',
    italian: 'it',
    portuguese: 'pt',
    russian: 'ru',
    japanese: 'ja',
    korean: 'ko',
    chinese: 'zh-Hans',
    arabic: 'ar',
    hindi: 'hi',
    dutch: 'nl',
    polish: 'pl',
    turkish: 'tr'
  };
  if (nameToCode[lower]) return nameToCode[lower];
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

  // Resolve niche-specific overrides on top of the global pools. Each CTA
  // category and retention curve category individually falls through to
  // the global default when the niche doesn't override it — so we never
  // *lose* coverage by adding a niche entry, only refine it.
  const nicheCtaOverrides = CTA_LIBRARY_BY_NICHE[n] || {};
  const ctas = { ...CTA_LIBRARY, ...nicheCtaOverrides };
  const nicheRetentionOverrides = RETENTION_CURVES_BY_NICHE[n] || {};
  const retention = nicheRetentionOverrides[lengthClass] || RETENTION_CURVES[lengthClass];

  return {
    niche: n,
    platform: p,
    stage,
    language: lang,
    nichePlaybook: np,
    platformPlaybook: pp,
    languageProfile: lp,
    retention,
    hooks: HOOK_FRAMEWORKS,
    ctas,
    // Surface which CTA categories were customised so prompt builders can
    // call those out explicitly when relevant (e.g. "use a finance-specific
    // DM CTA" rather than the generic one).
    nicheCtaOverrideCategories: Object.keys(nicheCtaOverrides),
    // Whether this niche has a custom retention curve at this length. The
    // prompt builder uses this to label the section accurately.
    retentionIsNicheSpecific: Boolean(nicheRetentionOverrides[lengthClass]),
  };
}

/**
 * Format a UserStyleProfile snapshot for prompt injection. Reads the top
 * 3 picks across the facets the creator has demonstrated taste in (font,
 * caption style, transitions, pacing averages, etc.) and emits a
 * compact "match this creator's taste" block. If the profile is empty
 * (new user), returns an empty array — the prompt skips the section.
 */
function buildStyleProfileBlock(profile) {
  if (!profile || typeof profile !== 'object') return [];
  const sections = [];
  const picks = (facet) => {
    const counts = profile[facet];
    let keys;
    if (Array.isArray(counts)) {
      // Canonical shape: UserStyleProfile stores each facet as a counter array
      // [{ key, count }]. (Object.entries on this would yield array INDICES.)
      keys = counts
        .filter((c) => c && c.key)
        .slice()
        .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))
        .slice(0, 3)
        .map((c) => c.key);
    } else if (counts && typeof counts === 'object') {
      // Legacy/defensive: plain object map { key: count }.
      keys = Object.entries(counts)
        .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
        .slice(0, 3)
        .map(([k]) => k);
    } else {
      return null;
    }
    keys = keys.filter(Boolean);
    return keys.length ? keys.join(' · ') : null;
  };
  const fonts = picks('fonts');
  const captionStyles = picks('captionStyles');
  const transitions = picks('transitions');
  const motions = picks('motions');
  const colorGrades = picks('colorGrades');
  const niches = picks('niches');
  const platforms = picks('platforms');

  const lines = [];
  if (fonts)         lines.push(`Preferred fonts: ${fonts}`);
  if (captionStyles) lines.push(`Preferred caption styles: ${captionStyles}`);
  if (transitions)   lines.push(`Preferred transitions: ${transitions}`);
  if (motions)       lines.push(`Preferred motion graphics: ${motions}`);
  if (colorGrades)   lines.push(`Preferred color grades: ${colorGrades}`);
  if (niches)        lines.push(`Default niches: ${niches}`);
  if (platforms)     lines.push(`Default platforms: ${platforms}`);

  // Pacing averages — these come from the creator's actual edit history. The
  // model nests them under `averages`; fall back to a flat shape defensively.
  const avg = (profile.averages && typeof profile.averages === 'object') ? profile.averages : profile;
  if (typeof avg.avgCutDuration === 'number')   lines.push(`Average cut length: ${avg.avgCutDuration.toFixed(1)}s (match this pacing)`);
  if (typeof avg.avgFontSize === 'number')      lines.push(`Average font size: ${Math.round(avg.avgFontSize)}px`);
  if (typeof avg.avgCaptionLength === 'number') lines.push(`Average caption length: ${Math.round(avg.avgCaptionLength)} chars`);

  if (lines.length === 0) return [];
  sections.push('── Creator style profile (bias output toward these) ──');
  sections.push(...lines);
  sections.push('');
  return sections;
}

/**
 * Builds a ready-to-paste system prompt block for chat-completion calls.
 * `persona` controls voice; the rest is auto-derived from the slice.
 *
 * `styleProfile` (optional) — when provided, the prompt embeds the
 * creator's existing taste signals (favourite fonts, caption styles,
 * pacing averages, top-performing facets). The model is told to bias
 * suggestions toward what's already worked for THIS creator, so the
 * output adapts to their voice over time instead of starting from
 * scratch every time.
 */
function buildSystemPrompt({ persona = 'script-writer', niche, platform, stage = 'script', language = 'en', extra = '', styleProfile = null, topPerformers = null, voice = null } = {}) {
  const slice = getKnowledgeSlice({ niche, platform, stage, language });
  const np = slice.nichePlaybook;
  const pp = slice.platformPlaybook;
  const lp = slice.languageProfile;

  // Pull live 2026 trend context + recommended frameworks from the
  // global marketing knowledge base. lazy-required so a circular import
  // (or a missing module in some test setup) degrades to "no trends"
  // instead of failing the whole prompt build.
  let trendBlock = [];
  try {
    const { getOpenSourceKnowledgeInsights } = require('./globalMarketingIntelligenceService');
    if (typeof getOpenSourceKnowledgeInsights === 'function') {
      const insights = getOpenSourceKnowledgeInsights(slice.niche, 'video');
      const trends = Array.isArray(insights?.globalTrends) ? insights.globalTrends.slice(0, 5) : [];
      const frameworks = Array.isArray(insights?.recommendedFrameworks) ? insights.recommendedFrameworks.slice(0, 3) : [];
      if (trends.length > 0 || frameworks.length > 0) {
        trendBlock = [
          // Labeled as a STATIC strategic baseline — NOT live/current trends.
          // Real-time trends come from the marketing brain's web search; these
          // are evergreen principles, so we never present them as "right now".
          '── Strategic baseline (evergreen principles, NOT live trends) ──',
          ...(trends.length > 0
            ? [`Durable macro shifts to design around: ${trends.join(' · ')}.`]
            : []),
          ...(frameworks.length > 0
            ? [`High-leverage frameworks: ${frameworks.map(f => f.name || f.title).filter(Boolean).join(' · ')}.`]
            : []),
          'These are timeless baselines, not current/live trends. Do not claim any of them is "trending now". Reference one only if it organically fits the clip.',
          '',
        ];
      }
    }
  } catch (_) { /* missing module — silently skip */ }

  const personaLine = {
    'script-writer':    'You are Click — a brilliant, fast-talking short-form scriptwriter who has written for top-1% creators in this niche.',
    'caption-writer':   'You are Click — an obsessed caption strategist who has analysed the top 100 viral videos in this niche this month.',
    'edit-suggester':   'You are Click — a sharply observant senior video editor advising on cuts, motion, and overlays with a blunt, no-nonsense style.',
    'thumbnail':        'You are Click — a ruthless thumbnail and cold-open strategist. You care about CTR above all else.',
    'marketing-coach':  'You are Click — a highly energetic, direct, no-fluff marketing coach.',
    // Creative director — used when the task is to produce MULTIPLE
    // distinct creative options (variants) rather than a single best
    // answer. Output is ranked + tagged with what makes each variant
    // distinct so the creator can pick what fits their judgement.
    'creative-director': 'You are Click — a visionary creative director. Your job is to surface 3-5 genuinely different creative options for the same brief, each with a clear angle and a one-line "why this".',
  }[persona] || 'You are Click — an intensely creative and sharply opinionated marketing collaborator.';

  return [
    personaLine,
    '',
    `Niche: ${slice.niche.toUpperCase()}. Platform: ${slice.platform.toUpperCase()}. Stage: ${stage}. Language: ${lp.name.toUpperCase()}.`,
    '',
    // `voice` (when provided) carries the creator's saved tone/vocab/banned
    // overrides AND their userId for the deterministic archetype seed; it takes
    // precedence over the plain userId/niche seed. Backward-compatible: callers
    // that don't pass `voice` get the exact previous behaviour.
    getClickPersonalityRules(voice || styleProfile?.userId || niche),
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
    slice.retentionIsNicheSpecific
      ? `── Retention curve (tuned for ${slice.niche}) ──`
      : '── Retention curve ──',
    ...slice.retention.map(r => `${r.mark}: ${r.rule}`),
    slice.nicheCtaOverrideCategories?.length
      ? `\nCTA note: For this niche, prefer the ${slice.nicheCtaOverrideCategories.join(' / ')}-style CTAs from the library — generic CTAs underperform here.`
      : '',
    '',
    ...trendBlock,
    ...(styleProfile ? buildStyleProfileBlock(styleProfile) : []),
    // The learning loop's payoff — when the creator has 3+ posts of real
    // performance data, prompts get explicitly biased toward what's
    // already worked for them. Empty array for cold-start users so the
    // static playbook still leads the prompt.
    ...buildTopPerformersBlock(topPerformers),
    '── Output rules ──',
    `• Reply ENTIRELY in ${lp.name}. Do not mix English unless the niche/platform playbook explicitly calls for it.`,
    '• Be specific. Replace generic adjectives with numbers, examples, or named things.',
    '• Match the niche voice exactly — do not water it down to "professional".',
    '• If the user has not specified an angle, pick the strongest one from the playbook.',
    '• Hooks should pass the "would I keep scrolling" test in the first frame.',
    '• IMPORTANT: Ensure all output matches the unique, charismatic personality defined above without any repetition.',
    '• CRITICAL: DO NOT hallucinate or invent features, facts, or statistics that are not explicitly provided. Base your response strictly on the context.',
    extra,
  ].filter(Boolean).join('\n');
}

/**
 * Build a "what actually worked for this creator" snapshot that prompts
 * can be biased toward. Reads:
 *   - UserStyleProfile.topPerformers() across the facets that matter for
 *     copy + edit decisions (hooks, captions, color grades, transitions)
 *   - Recent ScheduledPost.analytics for top-performing hooks/CTAs by
 *     engagement score, filtered to the requested niche + platform.
 *
 * Returns null when the sample size across all signals is below `minSamples`
 * (default 3). A cold-start user gets pure-niche-playbook prompts; once
 * 3+ posts have synced analytics, the prompt block starts bending toward
 * what actually won.
 *
 * Honest constraints:
 *   - Mongo-only path. Supabase users without a Mongo doc return null
 *     gracefully; the caller falls back to the static playbook.
 *   - Cheap to call (≤ ~50ms in practice) but the caller should still
 *     short-circuit when the prompt is high-frequency (per-keystroke).
 */
async function getTopPerformingPlaybook(userId, niche, platform, opts = {}) {
  const minSamples = opts.minSamples ?? 3;
  try {
    const mongooseLib = require('mongoose');
    // UserStyleProfile.userId is ObjectId-typed — only legacy Mongo users
    // have a profile doc. Supabase users (UUIDs) still have ScheduledPost
    // rows (userId: String), so we run the analytics aggregation either
    // way and just skip the profile-derived signals for UUIDs.
    let profile = null;
    if (mongooseLib.Types.ObjectId.isValid(String(userId))) {
      const UserStyleProfile = require('../models/UserStyleProfile');
      profile = await UserStyleProfile.findOne({ userId }).lean();
    }

    // ScheduledPost.analytics path — filter by platform + (optionally)
    // the post's stored niche tag.
    //
    // 90-day window — without this, an early viral post from year one
    // skews the suggestions forever. Creators evolve; their playbook
    // should follow. The window length is intentionally generous so a
    // creator who only publishes once a month still gets enough sample.
    const ScheduledPost = require('../models/ScheduledPost');
    const platformFilter = platform ? { platform } : {};
    const windowStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    // Combine the niche + recency filters under $and so they don't
    // collide with each other (Mongo only allows one top-level $or per
    // query). Niche filter only kicks in when the caller passed a niche
    // AND the user has posts tagged with it — pre-denormalisation rows
    // (no niche field) pass through. Without this, a creator who
    // pivots niches (fitness → finance) would forever be biased toward
    // their old top performers.
    const recencyClause = {
      $or: [
        { postedAt: { $gte: windowStart } },
        { postedAt: { $exists: false } },
      ],
    };
    const nicheClause = niche
      ? { $or: [{ niche }, { niche: { $exists: false } }, { niche: null }] }
      : null;
    const filter = {
      userId: String(userId),
      status: 'posted',
      ...platformFilter,
      'analytics.lastUpdated': { $exists: true },
      $and: nicheClause ? [recencyClause, nicheClause] : [recencyClause],
    };
    const recentPosts = await ScheduledPost.find(filter)
      .sort({ 'analytics.engagementRate.byImpressions': -1, 'analytics.engagement': -1 })
      .limit(20)
      .lean();

    // Aggregate hook angles + CTA categories that win — derived from the
    // posts' text + the niche playbook. Imperfect heuristic, but
    // directionally correct: a post that mentions "save this" landed
    // because of the save CTA, etc.
    const hookHits = {};
    const ctaHits = {};
    for (const p of recentPosts) {
      const text = (p.content?.text || '').toLowerCase();
      // CTA detection — search for the niche-specific CTA strings.
      for (const [cat, variants] of Object.entries(CTA_LIBRARY)) {
        const all = [...(variants || []), ...((CTA_LIBRARY_BY_NICHE[niche] || {})[cat] || [])];
        for (const v of all) {
          if (v && text.includes(v.toLowerCase().slice(0, 12))) {
            ctaHits[cat] = (ctaHits[cat] || 0) + 1;
            break;
          }
        }
      }
      // Hook detection — heuristic: if first sentence matches a hook
      // framework's lead pattern (number, "stop", quote-mark, "5 ", etc.).
      const firstSentence = text.split(/[.!?]/, 1)[0] || '';
      if (/^[0-9]/.test(firstSentence)) hookHits['data-flex'] = (hookHits['data-flex'] || 0) + 1;
      if (/^(stop|don'?t)/.test(firstSentence)) hookHits['enemy-frame'] = (hookHits['enemy-frame'] || 0) + 1;
      if (/^(\d+\s+(things|mistakes|ways|tips))/.test(firstSentence)) hookHits['list-tease'] = (hookHits['list-tease'] || 0) + 1;
      if (/before|after/.test(firstSentence)) hookHits['before-after'] = (hookHits['before-after'] || 0) + 1;
    }

    // Profile-based weighted facets (only meaningful if Mongo profile exists)
    const topHooks       = profile && typeof profile === 'object' && Array.isArray(profile.weightedHooks)        ? sortWeighted(profile.weightedHooks, 3)        : [];
    const topCaptions    = profile && typeof profile === 'object' && Array.isArray(profile.weightedCaptionStyles) ? sortWeighted(profile.weightedCaptionStyles, 3) : [];
    const topColorGrades = profile && typeof profile === 'object' && Array.isArray(profile.weightedColorGrades)  ? sortWeighted(profile.weightedColorGrades, 3)  : [];

    const sampleSize = recentPosts.length + (topHooks.length + topCaptions.length + topColorGrades.length);
    if (sampleSize < minSamples) return null;

    const topHookAngles = Object.entries(hookHits).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    const topCtaCategories = Object.entries(ctaHits).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);

    return {
      sampleSize,
      postsAnalysed: recentPosts.length,
      windowDays: 90,
      windowStart: windowStart.toISOString(),
      lastIngestedAt: profile?.lastIngestedAt || null,
      topHookAngles,
      topCtaCategories,
      topHooks: topHooks.map((h) => h.key),
      topCaptions: topCaptions.map((c) => c.key),
      topColorGrades: topColorGrades.map((c) => c.key),
    };
  } catch (err) {
    // Never let a prompt build fail because the learning loop errored —
    // log and fall back to the static playbook.
    const logger = require('../utils/logger');
    logger.warn('getTopPerformingPlaybook failed; falling back to static playbook', { error: err.message, userId, niche, platform });
    return null;
  }
}

function sortWeighted(arr, limit) {
  return arr
    .slice()
    .sort((a, b) => {
      const aScore = (a.performanceScore || 0) * Math.log((a.sampleSize || 0) + 1);
      const bScore = (b.performanceScore || 0) * Math.log((b.sampleSize || 0) + 1);
      return bScore - aScore;
    })
    .slice(0, limit);
}

/**
 * Render the top-performing playbook into a prompt block. Returns [] when
 * nothing's learned yet so the array spreads cleanly into the prompt.
 */
function buildTopPerformersBlock(topPerformers) {
  if (!topPerformers || !topPerformers.sampleSize) return [];
  const lines = [];
  lines.push('── What worked for THIS creator (bias output toward these) ──');
  if (topPerformers.topHookAngles?.length) lines.push(`Hook angles that landed: ${topPerformers.topHookAngles.join(' · ')}`);
  if (topPerformers.topCtaCategories?.length) lines.push(`CTA categories with proven hit rate: ${topPerformers.topCtaCategories.join(' · ')}`);
  if (topPerformers.topHooks?.length) lines.push(`Hook styles the creator has run successfully: ${topPerformers.topHooks.join(' · ')}`);
  if (topPerformers.topCaptions?.length) lines.push(`Caption styles that worked: ${topPerformers.topCaptions.join(' · ')}`);
  if (topPerformers.topColorGrades?.length) lines.push(`Color grades that performed: ${topPerformers.topColorGrades.join(' · ')}`);
  lines.push(`Signal sample size: ${topPerformers.sampleSize} (across ${topPerformers.postsAnalysed} posts + profile weights). Treat these as bias, not constraints — break the pattern when the creative brief calls for it.`);
  lines.push('');
  return lines;
}

/** A compact one-liner for low-token contexts (e.g. caption suggestions). */
function buildCompactGuidance({ niche, platform, stage = 'script', language = 'en' } = {}) {
  const slice = getKnowledgeSlice({ niche, platform, stage, language });
  const angles = (slice.nichePlaybook.angles || []).slice(0, 3).join(' · ');
  return `Reply in ${slice.languageProfile.name}. Niche=${slice.niche}, Platform=${slice.platform}. Voice: ${slice.nichePlaybook.voice} Top angles: ${angles}. Hook window: ${slice.platformPlaybook.hookWindow}. Avoid: ${(slice.nichePlaybook.avoid || []).slice(0, 2).join(', ')}.`;
}

function getSeedFromString(str) {
  let hash = 0;
  if (!str) return 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generates the unified, charismatic, and non-repetitive Click personality block.
 * To be injected into custom system prompts where buildSystemPrompt isn't used directly.
 */
function getClickPersonalityRules(userIdInput) {
  let userId = '';
  let customTone = '';
  let customVocab = [];
  let customBanned = [];

  if (userIdInput && typeof userIdInput === 'object') {
    userId = userIdInput.userId || '';
    const voice = userIdInput.brandVoice || {};
    customTone = userIdInput.tone || voice.tone || '';
    
    const vocabSrc = userIdInput.vocab || voice.vocab || userIdInput.wordChoice || voice.wordChoice || [];
    customVocab = Array.isArray(vocabSrc) ? vocabSrc : (typeof vocabSrc === 'string' ? [vocabSrc] : []);

    const bannedSrc = userIdInput.customBanned || voice.customBanned || userIdInput.banned || voice.banned || [];
    customBanned = Array.isArray(bannedSrc) ? bannedSrc : (typeof bannedSrc === 'string' ? [bannedSrc] : []);
  } else {
    userId = userIdInput;
  }

  const normalizedId = userId ? String(userId).trim() : '';
  const hash = getSeedFromString(normalizedId);
  const archetypeIndex = hash % 4;

  const ARCHETYPES = [
    {
      name: "The Hype Architect",
      vibe: "Highly energetic, magnetic, and storytelling-driven. Focuses on viewer emotions, dopamine loops, and building suspense. Uses modern, vivid content metaphors.",
      vocab: ["attention arbitrage", "retention multiplier", "scroll stopper", "viral footprint", "hook loop", "dopamine hit"],
      banned: ["in today's digital landscape", "let's dive in", "unlock the potential", "look no further", "delve"]
    },
    {
      name: "The Growth Catalyst",
      vibe: "Sharp, numbers-driven, hyper-tactical, and performance-first. Connects every creative decision directly to conversions, customer velocity, and ROI. Extremely direct.",
      vocab: ["conversion engine", "absolute cheat code", "audience velocity", "revenue yield", "unbounded upside", "frictionless leverage"],
      banned: ["dive deep", "delve", "revolutionary", "game-changer", "more than just", "unlock new heights"]
    },
    {
      name: "The Analytical Storyteller",
      vibe: "Measured, highly insightful, first-principles-based, and authoritative but conversational. Prefers clean, structured analogies over hype. Speaks like an elite industry insider.",
      vocab: ["pure signal", "cognitive friction", "narrative alignment", "first-principles framing", "mental framework", "signal-to-noise ratio"],
      banned: ["in conclusion", "here is a script", "moreover", "ultimately", "finally"]
    },
    {
      name: "The Bold Disruptor",
      vibe: "Blunt, contrarian, intensely honest, and pattern-breaking. Rejects conventional vanilla advice and challenges status quo beliefs to build immediate authority. High urgency.",
      vocab: ["retention sinkhole", "arbitrage window", "pattern breakdown", "lazy content", "algorithmic fatigue", "brutal truth"],
      banned: ["look no further", "tap into", "master the art of", "harness the power", "journey of"]
    }
  ];

  const archetype = ARCHETYPES[archetypeIndex];

  // Merge custom vocabulary
  const vocabList = [...archetype.vocab];
  customVocab.forEach(v => {
    if (v && typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed && !vocabList.includes(trimmed)) {
        vocabList.push(trimmed);
      }
    }
  });

  // Merge custom banned clichés
  const bannedList = [...archetype.banned];
  customBanned.forEach(b => {
    if (b && typeof b === 'string') {
      const trimmed = b.trim();
      if (trimmed && !bannedList.includes(trimmed)) {
        bannedList.push(trimmed);
      }
    }
  });

  // Time-of-day / Day-of-week context variation
  const hour = new Date().getHours();
  let timeVibe = "";
  if (hour >= 5 && hour < 12) {
    timeVibe = "High-energy sunrise focus: emphasize high efficiency, morning clarity, and crisp execution.";
  } else if (hour >= 12 && hour < 17) {
    timeVibe = "Peak operator efficiency: focus on rapid iteration, maximum output speed, and punchy, zero-fluff delivery.";
  } else if (hour >= 17 && hour < 22) {
    timeVibe = "Creative Director perspective: use rich, artistic metaphors, long-term brand equity focus, and aesthetic excellence.";
  } else {
    timeVibe = "Late-night builder energy: hyper-focused, raw, experimental, direct, and slightly contrarian.";
  }

  const uniqueIdContext = normalizedId ? `user ${normalizedId.slice(-6)}` : 'this specific user';
  const customToneSegment = customTone ? `\n• DYNAMIC CUSTOM TONE: ${customTone.trim()}` : '';

  return `── Click Personality & Tone (Customized for ${uniqueIdContext}) ──
• ARCHETYPE: ${archetype.name}
• YOUR VIBE: ${archetype.vibe}${customToneSegment}
• DYNAMIC CONTEXT: ${timeVibe}
• SIGNATURE VOCABULARY: Weave some of these phrases naturally into your responses: ${vocabList.map(v => `"${v}"`).join(', ')}.
• CRITICAL - BANNED CLICHÉS: Never use any of the following standard LLM phrases: ${bannedList.map(b => `"${b}"`).join(', ')}.
• NO REPETITION: Absolutely never start sentences with standard transitional hooks like "Here is your X", "Sure, I can help", or "In conclusion". Vary your sentence length and structures dynamically. Make every user interaction feel continuous yet freshly tailored.`;
}

module.exports = {
  HOOK_FRAMEWORKS,
  RETENTION_CURVES,
  RETENTION_CURVES_BY_NICHE,
  PLATFORM_PLAYBOOKS,
  NICHE_PLAYBOOKS,
  CTA_LIBRARY,
  CTA_LIBRARY_BY_NICHE,
  NICHE_POSTING_WINDOWS,
  LANGUAGE_PROFILES,
  getKnowledgeSlice,
  buildSystemPrompt,
  buildCompactGuidance,
  getClickPersonalityRules,
  getTopPerformingPlaybook,
  buildTopPerformersBlock,
  normaliseNiche,
  normalisePlatform,
  normaliseLanguage,
};
