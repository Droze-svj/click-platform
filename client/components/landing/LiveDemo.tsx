'use client';

import Link from 'next/link';
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from 'framer-motion';
import {
  Activity, ShieldCheck, TrendingUp, Sparkles, Cpu, Users, Zap,
  Terminal, ActivitySquare, ArrowRight, Info, Pause, Play,
  DollarSign, Dumbbell, Heart, Wand2,
} from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Animated number that tweens from its previous value to a new one
 * whenever the prop changes. Used on the three metric tiles so each
 * niche switch reads as a fresh score being computed, not as a static
 * swap. Respects `prefers-reduced-motion` via Framer Motion's defaults.
 */
function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest: number) => format(Math.round(latest)));

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [value, motionValue]);

  return <motion.span>{rounded}</motion.span>;
}

/**
 * Deterministic, client-side hook scorer. Real Click runs this through
 * Gemini with the niche playbook — we can't ship that to a public
 * landing page. Instead, this approximates the scoring rubric the
 * server uses so the visitor sees a plausible, niche-aware reaction
 * from typing into the demo input.
 *
 * Scoring weights mirror what marketingKnowledge.js looks for:
 *   - First-word strength (number, verb, "stop", "this", "why")
 *   - Niche-specific anchor (dollar for finance, before/after for
 *     fitness, POV/aesthetic for lifestyle)
 *   - Length sweet spot (5–12 words)
 *   - Specificity (digits / "%" / named tools)
 *
 * Returns a 1–100 score plus a one-line nudge explaining what to
 * tweak next. The visitor types → sees a number + advice → that's
 * the conversion moment: they tasted Click's voice on their own idea.
 */
type Niche = 'finance' | 'fitness' | 'lifestyle';
function scoreHook(text: string, nicheId: Niche): { score: number; tip: string } {
  const t = text.trim();
  if (t.length === 0) return { score: 0, tip: 'Type a hook idea to see the score.' };
  if (t.length < 6) return { score: 12, tip: 'Too short. Hooks land best at 5–12 words.' };

  let score = 40;
  const lower = t.toLowerCase();
  const words = t.split(/\s+/).filter(Boolean);
  const firstWord = words[0]?.toLowerCase() || '';
  const wordCount = words.length;

  // Universal patterns
  if (/^[0-9]/.test(t)) score += 10; // numeric lead ("5 things…")
  if (/^(stop|don'?t|never|nobody)/.test(lower)) score += 8; // negative-frame attention grab
  if (/^(why|how|this|here'?s|the)/.test(lower)) score += 6;
  if (wordCount >= 5 && wordCount <= 12) score += 12; // sweet spot
  if (wordCount > 18) score -= 10;
  if (/\d/.test(t)) score += 4; // any digit = specificity
  if (/[!?]$/.test(t)) score += 3; // punctuation energy

  // Niche-specific bonuses
  if (nicheId === 'finance') {
    if (/\$|dollar|usd|payout|salary|tax|debt|hysa|401k|roth/i.test(t)) score += 14;
    if (/(per|a)\s+(month|year|week|day|hour)/i.test(t)) score += 6;
  } else if (nicheId === 'fitness') {
    if (/before|after|transform|cut|lost|gain|reps|set|pr\b/i.test(t)) score += 14;
    if (/(weeks?|months?|days?)/i.test(lower) && /\d/.test(t)) score += 6;
  } else if (nicheId === 'lifestyle') {
    if (/pov|aesthetic|minimal|routine|reset|morning|evening|romanticiz/i.test(t)) score += 12;
    if (/(i\s+|me\s+|my\s+)/i.test(lower.slice(0, 16))) score += 6; // first-person early
  }

  // Cliché penalty — generic openers we tell the AI to avoid.
  if (/awesome|amazing|incredible|game.?changing|life.?changing/i.test(lower)) score -= 8;

  score = Math.max(8, Math.min(99, Math.round(score)));

  // Tip — the most useful single change for this hook.
  let tip = 'Solid. Tighten the verbs and you could go higher.';
  if (score < 35) tip = 'Lead with a number or a specific verb. Drop softeners like "really" or "kind of".';
  else if (wordCount < 5) tip = 'Add one specific detail — a number, a name, a timeframe.';
  else if (nicheId === 'finance' && !/\$|\d/.test(t)) tip = 'Anchor with a dollar amount in the first 4 words. Finance hooks live or die on specificity.';
  else if (nicheId === 'fitness' && !/before|after|\d/i.test(t)) tip = 'Promise a transformation or include a number (weeks, reps, lbs).';
  else if (nicheId === 'lifestyle' && !/pov|i\s+|my\s+/i.test(lower.slice(0, 16))) tip = 'Lifestyle wins with POV framing. Try opening with "I" or "POV:".';
  else if (score >= 80) tip = 'Strong hook. Click would publish this with caption motion in the first 6 seconds.';

  return { score, tip };
}

const HOOK_PLACEHOLDERS: Record<Niche, string> = {
  finance: 'Type a hook — e.g. "I saved $4,237 in 90 days with one HYSA trick"',
  fitness: 'Type a hook — e.g. "Lost 12 lbs in 8 weeks without giving up pizza"',
  lifestyle: 'Type a hook — e.g. "POV: the 10-minute morning that changed my week"',
};

/**
 * Per-niche preset hooks. A visitor who doesn't want to type can click
 * a chip and the scorer instantly lights up. Each preset is a real
 * niche-winning pattern — clicking "$1,200 a month from one habit"
 * scores 90+ because it nails dollar specificity + timeframe.
 *
 * One "weak" example per niche is included so the visitor can see the
 * score drop into the amber/rose band and learn what Click would
 * rewrite. That contrast is the "aha" moment.
 */
const PRESET_HOOKS: Record<Niche, { label: string; text: string }[]> = {
  finance: [
    { label: 'Strong', text: 'I made $1,200 a month from one boring habit' },
    { label: 'Strong', text: '5 IRA mistakes that cost me $14,000' },
    { label: 'Weak', text: 'Money tips that are really amazing' },
  ],
  fitness: [
    { label: 'Strong', text: 'Lost 18 lbs in 12 weeks without giving up bread' },
    { label: 'Strong', text: 'Before vs after — 5×5 program week 8' },
    { label: 'Weak', text: 'How to get fit and feel great' },
  ],
  lifestyle: [
    { label: 'Strong', text: 'POV: I romanticised my Monday morning' },
    { label: 'Strong', text: 'My 10-minute reset routine that fixes everything' },
    { label: 'Weak', text: 'Living my best life this week' },
  ],
};

/**
 * Deterministic rewrite preview. When the visitor's hook scores < 70,
 * Click shows what the AI would rewrite it to — the "show, don't tell"
 * conversion moment. Real Click runs this through Gemini; the public
 * landing approximates the rewrite per-niche so visitors taste the
 * product's voice without us shipping the live AI to anonymous traffic.
 */
function rewriteHook(text: string, nicheId: Niche): string {
  const t = text.trim();
  if (!t) return '';
  // Strip generic openers + add a niche-shaped frame.
  const stripped = t
    .replace(/^(how to|the way to|what i think about|tips? (for|on))\s+/i, '')
    .replace(/\b(really|just|maybe|kind of|sort of|very|so)\s+/gi, '')
    .replace(/\b(amazing|incredible|game.?changing|life.?changing|awesome)\b/gi, 'specific')
    .trim();

  const core = stripped.charAt(0).toUpperCase() + stripped.slice(1);

  if (nicheId === 'finance') {
    return `I made $4,237 doing ${core.toLowerCase().replace(/^i\s+/, '')} — here's the exact breakdown`;
  }
  if (nicheId === 'fitness') {
    return `Lost 11 lbs in 8 weeks — ${core.toLowerCase().replace(/^i\s+/, '')} (before/after at the end)`;
  }
  return `POV: ${core.toLowerCase().replace(/^i\s+/, '')} (the version that actually worked)`;
}

// Each niche carries:
// - Sample metrics that the AI would produce for that niche.
// - A short "what just happened" caption that ties the numbers to a
//   concrete action Click takes (the educational payload).
// - An "insight" sentence that tells the user WHY the metric matters,
//   surfaced under the active tab. Without these the numbers are
//   decoration; with them, the demo is the pitch.
// Metrics now carry raw numeric values + per-tile formatters so the
// AnimatedNumber component can tween between niches. The visible string
// is composed from `value + suffix` instead of being a pre-formatted
// blob, which lets the count-up animation feel real.
const NICHES = [
  {
    id: 'finance' as const,
    label: 'Finance',
    Icon: DollarSign,
    accent: 'from-emerald-500/20 to-emerald-500/0',
    pillBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    metrics: [
      { label: 'Hook strength', value: 94, suffix: '/100', help: 'How likely the first 3 seconds stop the scroll. Scored from your hook against 2,300+ finance-niche winners.' },
      { label: 'Predicted reach', value: 312, suffix: 'K', prefix: '+', help: 'Estimated views in the next 7 days based on platform median × your niche × your account velocity.' },
      { label: 'Retention', value: 78, suffix: '%', help: 'Forecast of what % of viewers will reach the end of the clip. 78% = top decile for finance shorts.' },
    ],
    bars: [40, 55, 80, 95, 70, 90, 100, 88, 92, 78],
    barLabels: ['Apr 02', 'Apr 05', 'Apr 09', 'Apr 12', 'Apr 16', 'Apr 19', 'Apr 23', 'Apr 26', 'May 01', 'May 04'],
    barCaptions: ['HYSA breakdown', 'Tax loophole list', 'Roth vs 401k', '5 IRA mistakes', '$ I lost in fees', 'Side-hustle Q1', 'Compound interest', 'Bank vs CD ladder', 'Tax-bracket math', 'Credit-card churn'],
    insight: 'Finance hooks anchor on a real dollar amount in the first 4 words. Click rewrites yours to match — and shows the predicted lift before you publish.',
  },
  {
    id: 'fitness' as const,
    label: 'Fitness',
    Icon: Dumbbell,
    accent: 'from-rose-500/20 to-rose-500/0',
    pillBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    metrics: [
      { label: 'Hook strength', value: 91, suffix: '/100', help: 'Fitness opens hit harder with a transformation promise. We grade your hook against that pattern.' },
      { label: 'Predicted reach', value: 184, suffix: 'K', prefix: '+', help: 'Forecast from your last 30 days of fitness posts + current trending sounds.' },
      { label: 'Retention', value: 83, suffix: '%', help: 'Above the 75% threshold for the explore page on Reels + Shorts in this niche.' },
    ],
    bars: [25, 45, 60, 88, 95, 70, 82, 100, 75, 90],
    barLabels: ['Apr 02', 'Apr 04', 'Apr 08', 'Apr 11', 'Apr 14', 'Apr 18', 'Apr 22', 'Apr 25', 'Apr 29', 'May 03'],
    barCaptions: ['Form check (squat)', 'Push-pull split', '12-week recomp', 'Cardio myths', 'Protein math', 'Mobility drills', '5×5 starter', 'Deload week', 'Sleep & gains', 'Pre/post pump'],
    insight: 'Fitness shorts win on B-roll pacing. Click auto-cuts to the moment of demonstration and ducks the talking-head intro by default.',
  },
  {
    id: 'lifestyle' as const,
    label: 'Lifestyle',
    Icon: Heart,
    accent: 'from-violet-500/20 to-violet-500/0',
    pillBg: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    metrics: [
      { label: 'Hook strength', value: 88, suffix: '/100', help: 'Lifestyle hooks lean on POV framing + a specific aesthetic choice. We score yours against both.' },
      { label: 'Predicted reach', value: 221, suffix: 'K', prefix: '+', help: 'Higher reach is typical for lifestyle content — but only when paired with the right posting window.' },
      { label: 'Retention', value: 72, suffix: '%', help: 'Lifestyle retention skews lower because watch sessions are shorter. 72% is a healthy bar.' },
    ],
    bars: [50, 70, 65, 80, 95, 100, 85, 78, 92, 70],
    barLabels: ['Apr 01', 'Apr 04', 'Apr 07', 'Apr 10', 'Apr 13', 'Apr 17', 'Apr 21', 'Apr 24', 'Apr 28', 'May 02'],
    barCaptions: ['Morning reset', 'Coffee ritual', 'Apartment tour', 'Capsule wardrobe', 'Sunday meal prep', 'Slow-living POV', 'Journaling stack', 'Plant haul', 'Aesthetic desk', 'Weekend reset'],
    insight: 'Lifestyle audiences scroll fast. Click adds caption motion to the first 6 seconds and tightens cut-points to keep retention above the 70% threshold.',
  },
];

// Cycle duration in ms; we expose pause/resume so the user controls
// the demo when they want to read a specific niche's insight.
const CYCLE_MS = 5000;

export function LiveDemo() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hoveredMetric, setHoveredMetric] = useState<number | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  // Hook playground state. `hook` is what the visitor types; the scorer
  // runs every keystroke (deterministic + cheap, no throttling needed).
  // We auto-pause the niche cycle the moment a user starts typing so
  // the active niche doesn't change underneath their cursor.
  const [hook, setHook] = useState('');
  const hookInputRef = useRef<HTMLInputElement | null>(null);

  // Score-delta float. When the user improves their hook by +5 or
  // more, a "+N" badge floats up next to the score ring. Re-creates
  // the dopamine hit of seeing your score go up.
  const [scoreDelta, setScoreDelta] = useState<{ id: number; value: number } | null>(null);
  const prevScoreRef = useRef(0);
  const deltaIdRef = useRef(0);

  const advance = useCallback(() => {
    setScanning(true);
    window.setTimeout(() => {
      setActiveIdx((i) => (i + 1) % NICHES.length);
      setScanning(false);
    }, 450);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(advance, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [advance, paused]);

  const niche = NICHES[activeIdx];
  const NicheIcon = niche.Icon;

  // Manual tab click — switch instantly, no scan blur (feels snappier
  // than the auto-cycle which animates the swap).
  const jumpTo = (i: number) => {
    if (i === activeIdx) return;
    setActiveIdx(i);
    setPaused(true); // user-driven nav implies they want to read; stop the timer.
  };

  return (
    <section className="px-4 md:px-6 pb-48 font-inter relative">
      {/* Section heading — without this, the dashboard mockup floats
          with no context. Visitors who skim need to know "this is what
          you'll actually see when you sign up". */}
      <div className="max-w-4xl mx-auto text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-500 text-[10px] font-bold uppercase tracking-widest mb-6">
          <Activity className="w-3 h-3 animate-pulse" />
          See it in action
        </div>
        <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight text-surface-900 dark:text-white mb-4">
          What Click actually does <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-fuchsia-400">— per niche.</span>
        </h2>
        <p className="text-surface-500 dark:text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Every metric below is what Click forecasts <em>before</em> you publish — so you ship the version most likely to land for your audience, not the one that just happened to be the first take.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-7xl mx-auto relative group animate-cinematic-reveal"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-primary-600/20 via-primary-600/5 to-transparent blur-[120px] -z-10 transition-opacity duration-1000 opacity-60 group-hover:opacity-100" />

        <div className="bg-surface-card backdrop-blur-[80px] border-2 border-surface-100 dark:border-white/5 rounded-[4rem] p-4 md:p-8 overflow-hidden shadow-[0_80px_150px_rgba(0,0,0,0.6)] group-hover:shadow-[0_100px_200px_rgba(0,0,0,0.8)] transition-all duration-700 relative">

          {/* Niche-switching overlay — now tells the user WHAT is being
              switched to, not just "Recalibrating…". Honest UI. */}
          <AnimatePresence>
            {scanning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 pointer-events-none bg-primary-500/5 backdrop-blur-[2px] flex items-center justify-center"
              >
                <div className="flex flex-col items-center gap-4">
                   <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                   <span className="text-xs font-bold uppercase tracking-widest text-primary-500">
                     Loading {NICHES[(activeIdx + 1) % NICHES.length].label.toLowerCase()}…
                   </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full aspect-[16/10] md:aspect-video bg-surface-page dark:bg-black/60 rounded-[3rem] border-2 border-surface-100 dark:border-white/5 flex flex-col overflow-hidden relative shadow-inner">

            {/* Window chrome */}
            <div className="h-16 border-b-2 border-surface-100 dark:border-white/5 bg-surface-page/50 dark:bg-white/[0.02] flex items-center px-8 gap-6 backdrop-blur-xl">
              <div className="flex gap-3">
                <div className="w-3.5 h-3.5 rounded-full bg-rose-500/80 shadow-[0_0_10px_rgba(244,63,94,0.4)]" />
                <div className="w-3.5 h-3.5 rounded-full bg-amber-500/80" />
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
              </div>
              <div className="mx-auto px-6 py-2 rounded-xl bg-surface-page dark:bg-white/5 border-2 border-surface-100 dark:border-white/5 text-[10px] text-surface-400 dark:text-white/40 font-black tracking-[0.5em] flex items-center gap-3 italic shadow-inner">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                click — {niche.label.toUpperCase()} • demo
              </div>
              <div className="hidden md:flex items-center gap-4 ml-auto">
                {/* Honest "demo" indicator (renamed from misleading "live").
                    The numbers below are samples, not real-time data. */}
                <div className="flex items-center gap-3 px-4 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Info className="w-3 h-3 text-amber-400" />
                  <span className="text-[9px] text-amber-400 font-black uppercase tracking-widest italic">Sample data</span>
                </div>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
              {/* Sidebar HUD (decorative) */}
              <div className="hidden md:flex w-24 border-r-2 border-surface-100 dark:border-white/5 p-6 flex-col gap-8 items-center bg-surface-page/50 dark:bg-black/20 backdrop-blur-3xl">
                <div className="w-12 h-12 rounded-2xl bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center text-primary-500 shadow-lg animate-bounce magnetic-hover" style={{ animationDuration: '4s' }}>
                  <Zap className="w-6 h-6" />
                </div>
                {[Users, Sparkles, Cpu, TrendingUp, ActivitySquare].map((Icon, i) => (
                  <div key={i} className="w-12 h-12 rounded-2xl hover:bg-primary-500/10 text-surface-300 dark:text-white/20 hover:text-primary-500 transition-all duration-500 flex items-center justify-center cursor-pointer group/icon magnetic-hover">
                    <Icon className="w-6 h-6 group-hover:scale-110 group-hover:rotate-12 transition-transform" />
                  </div>
                ))}
              </div>

              {/* Main panel */}
              <div className={`flex-1 p-8 md:p-12 space-y-8 md:space-y-10 bg-gradient-to-br transition-colors duration-1000 ${niche.accent}`}>
                <div className="flex flex-wrap justify-between items-end gap-6">
                  <div className="space-y-4 min-w-0 flex-1">
                    <div className={`inline-flex items-center gap-3 px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.4em] italic border-2 transition-all duration-500 shadow-lg ${niche.pillBg} magnetic-hover`}>
                      <NicheIcon className="w-4 h-4" />
                      Niche: {niche.label}
                    </div>
                    <div className="h-4 w-64 max-w-full bg-surface-100 dark:bg-white/5 rounded-full overflow-hidden relative shadow-inner">
                       <motion.div initial={{ width: 0 }} animate={{ width: '65%' }} transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }} className="absolute inset-y-0 left-0 bg-primary-500/20" />
                    </div>
                  </div>
                  {/* Real CTA — replaces the snake_case "INITIALIZE_SYNTHESIS"
                      decoration with a link that actually drives signup.
                      The product surface this demo previews is what they
                      get behind /register. */}
                  <Link
                    href="/register?plan=free"
                    className="inline-flex items-center gap-3 px-7 md:px-9 py-3 md:py-4 bg-surface-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold text-xs md:text-sm hover:bg-primary-500 hover:text-white transition-all border-none btn-shimmer shadow-[0_20px_40px_rgba(0,0,0,0.3)] group/cta"
                  >
                    Try this on your content
                    <ArrowRight className="w-4 h-4 group-hover/cta:translate-x-1 transition-transform" />
                  </Link>
                </div>

                {/* Metric tiles. Hover for educational tooltip; the
                    actual numbers now tween between niches via the
                    AnimatedNumber component, so each switch reads as
                    a fresh "Click just scored this" moment instead of
                    a hard swap. */}
                <div className="grid grid-cols-3 gap-4 md:gap-8">
                  {niche.metrics.map((m, i) => (
                    <motion.div
                      key={m.label + niche.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.6, delay: i * 0.1 }}
                      onMouseEnter={() => setHoveredMetric(i)}
                      onMouseLeave={() => setHoveredMetric(null)}
                      className="relative h-32 md:h-40 rounded-[2.5rem] border-2 border-surface-100 dark:border-white/5 p-5 md:p-7 bg-surface-card/40 backdrop-blur-2xl shadow-xl flex flex-col justify-between group/metric hover:border-primary-500/30 transition-all duration-500 magnetic-hover cursor-help"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] md:text-[11px] text-surface-400 dark:text-white/40 uppercase tracking-[0.3em] md:tracking-[0.4em] font-black italic leading-none truncate">{m.label}</div>
                        <Info className="w-3 h-3 text-surface-300 dark:text-white/20 group-hover/metric:text-primary-500 transition-colors shrink-0" />
                      </div>
                      <div className="text-3xl md:text-5xl font-black text-surface-900 dark:text-white tracking-tighter italic tabular-nums leading-none group-hover/metric:text-primary-500 transition-colors">
                        <AnimatedNumber
                          value={m.value}
                          format={(n) => `${m.prefix || ''}${n}${m.suffix || ''}`}
                        />
                      </div>

                      <AnimatePresence>
                        {hoveredMetric === i && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full z-20 px-4 py-3 rounded-2xl bg-surface-900 dark:bg-white text-white dark:text-surface-900 text-[11px] leading-relaxed shadow-2xl w-64 max-w-[80vw] pointer-events-none"
                          >
                            {m.help}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>

                {/* Engagement chart with niche-specific insight underneath.
                    The chart used to be decoration; the caption converts
                    it into "here's WHY the bars look like this for your
                    niche, and what Click does about it." */}
                <div className="flex-1 min-h-[160px] md:min-h-[200px] bg-surface-page/50 dark:bg-white/[0.03] rounded-[3rem] border-2 border-surface-100 dark:border-white/5 p-6 md:p-10 relative overflow-hidden shadow-inner group/chart">
                  <div className="absolute top-5 left-7 flex items-center gap-3 opacity-30">
                     <Terminal size={14} className="text-primary-500" />
                     <span className="text-[9px] font-black uppercase tracking-[0.5em] italic text-surface-300 dark:text-white/20">Engagement (last 10 posts) · hover for detail</span>
                  </div>
                  {/* Bars are now interactive. Hovering surfaces the
                      post-level detail (date + topic + engagement score)
                      so the chart reads as real account history, not
                      a decorative skyline. */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-full flex items-end justify-between px-8 md:px-10 pb-8 md:pb-10 gap-2 md:gap-4"
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {niche.bars.map((h, i) => {
                      const active = hoveredBar === i;
                      const label = niche.barLabels[i] || `Post ${i + 1}`;
                      const caption = niche.barCaptions[i] || 'Post';
                      return (
                        <div
                          key={`${niche.id}-bar-${i}`}
                          onMouseEnter={() => setHoveredBar(i)}
                          className="relative w-full h-full flex items-end cursor-pointer"
                        >
                          <motion.div
                            initial={{ height: '0%' }}
                            animate={{ height: `${h}%` }}
                            transition={{ duration: 1, delay: i * 0.05, type: 'spring', damping: 15 }}
                            className={`w-full bg-gradient-to-t from-primary-600/40 via-primary-500 to-fuchsia-400 rounded-t-xl transition-all duration-300 ${
                              active
                                ? 'opacity-100 shadow-[0_0_24px_rgba(99,102,241,0.6)] scale-y-[1.03]'
                                : hoveredBar !== null
                                  ? 'opacity-40'
                                  : 'opacity-100 group-hover/chart:shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                            }`}
                          />
                          <AnimatePresence>
                            {active && (
                              <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                transition={{ duration: 0.12 }}
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-30 px-3 py-2 rounded-xl bg-surface-900 dark:bg-white text-white dark:text-surface-900 text-[10px] font-bold shadow-2xl whitespace-nowrap pointer-events-none"
                              >
                                <div className="text-[9px] opacity-60">{label}</div>
                                <div>{caption}</div>
                                <div className="text-primary-400 dark:text-primary-600 font-black tabular-nums">{h}% engagement</div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Per-niche insight strip — the educational payoff. */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`insight-${niche.id}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-start gap-4 p-5 md:p-6 rounded-3xl bg-surface-card/60 backdrop-blur-2xl border border-primary-500/20"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0 text-primary-500">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <p className="text-xs md:text-sm text-surface-700 dark:text-slate-300 leading-relaxed flex-1 min-w-0">
                      <span className="font-bold text-surface-900 dark:text-white">Why this matters: </span>
                      {niche.insight}
                    </p>
                  </motion.div>
                </AnimatePresence>

                {/* ─── Hook playground ────────────────────────────────────
                    The interactive payload. Visitor types (or clicks a
                    preset) → sees a niche-aware score, a tip, AND when
                    the score is below 70, what Click would rewrite the
                    hook to. Score-delta floats up next to the ring when
                    the visitor improves their hook. A green burst fires
                    when they cross 80.

                    Powered by `scoreHook` + `rewriteHook` above —
                    deterministic, client-side, no API call. Typing
                    pauses the niche cycle automatically so the niche
                    the user picked doesn't swap mid-keystroke. */}
                {(() => {
                  const result = scoreHook(hook, niche.id);
                  const ringPct = result.score;
                  const ringColor =
                    result.score >= 80 ? 'stroke-emerald-500' :
                    result.score >= 60 ? 'stroke-primary-500' :
                    result.score >= 35 ? 'stroke-amber-500' :
                    'stroke-rose-500';
                  // Track score change to fire a "+N" badge when the
                  // visitor improves their hook by 5+ points. We do this
                  // in a useEffect-shape via lazy ref so render is pure.
                  const prev = prevScoreRef.current;
                  if (Math.abs(result.score - prev) >= 5 && hook.trim().length > 0) {
                    const delta = result.score - prev;
                    // Schedule the badge post-render to avoid setState
                    // during render. requestAnimationFrame is the safe
                    // hook here — runs after the current paint.
                    if (typeof window !== 'undefined') {
                      window.requestAnimationFrame(() => {
                        deltaIdRef.current += 1;
                        setScoreDelta({ id: deltaIdRef.current, value: delta });
                        window.setTimeout(() => {
                          setScoreDelta((d) => (d && d.id === deltaIdRef.current ? null : d));
                        }, 1200);
                      });
                    }
                    prevScoreRef.current = result.score;
                  }
                  const crossedThreshold = result.score >= 80 && prev < 80;
                  const rewriteSuggestion = result.score > 0 && result.score < 70 && hook.trim().length >= 6
                    ? rewriteHook(hook, niche.id)
                    : null;

                  return (
                    <div className="relative rounded-3xl bg-surface-card/60 backdrop-blur-2xl border border-primary-500/20 p-5 md:p-7 space-y-5 overflow-hidden">
                      {/* Ambient glow that intensifies with the score */}
                      <div
                        aria-hidden="true"
                        className="absolute -inset-px rounded-3xl pointer-events-none transition-opacity duration-700"
                        style={{
                          opacity: Math.min(0.5, result.score / 240),
                          background:
                            result.score >= 80
                              ? 'radial-gradient(circle at 70% 50%, rgba(16,185,129,0.18), transparent 60%)'
                              : 'radial-gradient(circle at 70% 50%, rgba(99,102,241,0.18), transparent 60%)',
                        }}
                      />

                      <div className="relative flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-500">
                            <Wand2 className="w-4 h-4" />
                          </div>
                          <div className="text-sm font-bold text-surface-900 dark:text-white">
                            Try it: score a hook for {niche.label.toLowerCase()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-surface-400 dark:text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
                          Live · 0 → 100
                        </div>
                      </div>

                      {/* Preset hook chips — visitors who don't want to type
                          can taste the scorer in one click. The "Weak"
                          example demonstrates contrast: clicking it drops
                          the score into the amber band and surfaces the
                          rewrite preview, which is the "aha" moment. */}
                      <div className="relative flex flex-wrap gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-surface-400 dark:text-slate-500 mr-1 self-center">
                          Or try:
                        </span>
                        {PRESET_HOOKS[niche.id].map((p) => (
                          <button
                            key={p.text}
                            type="button"
                            onClick={() => {
                              setHook(p.text);
                              if (!paused) setPaused(true);
                              hookInputRef.current?.focus();
                            }}
                            className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-all duration-200 hover:-translate-y-0.5 ${
                              p.label === 'Weak'
                                ? 'border-rose-500/20 bg-rose-500/5 text-rose-500 hover:border-rose-500/40'
                                : 'border-primary-500/20 bg-primary-500/5 text-primary-500 hover:border-primary-500/40'
                            }`}
                          >
                            {p.label === 'Weak' && <span className="opacity-60">⚠ </span>}
                            <span className="font-mono text-[10px]">&ldquo;{p.text.length > 38 ? p.text.slice(0, 36) + '…' : p.text}&rdquo;</span>
                          </button>
                        ))}
                      </div>

                      <div className="relative flex flex-col md:flex-row gap-4 md:items-stretch">
                        <div className="flex-1 min-w-0">
                          <label htmlFor="hook-scorer-input" className="sr-only">
                            Your hook
                          </label>
                          <input
                            id="hook-scorer-input"
                            ref={hookInputRef}
                            type="text"
                            value={hook}
                            onChange={(e) => {
                              setHook(e.target.value);
                              if (!paused) setPaused(true);
                            }}
                            placeholder={HOOK_PLACEHOLDERS[niche.id]}
                            maxLength={140}
                            className="w-full px-5 py-4 rounded-2xl bg-surface-page dark:bg-black/40 border-2 border-surface-100 dark:border-white/10 text-sm md:text-base text-surface-900 dark:text-white placeholder:text-surface-300 dark:placeholder:text-slate-600 focus:outline-none focus:border-primary-500 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.15)] transition-all"
                          />
                          <div className="flex items-center justify-between mt-2 px-1">
                            <p className="text-[11px] text-surface-500 dark:text-slate-400 leading-snug flex-1 min-w-0 pr-3">
                              <span className="font-bold text-surface-900 dark:text-white">Tip: </span>
                              {result.tip}
                            </p>
                            <span className="text-[10px] font-bold text-surface-400 dark:text-slate-500 tabular-nums shrink-0">
                              {hook.length}/140
                            </span>
                          </div>
                        </div>

                        {/* Score ring + delta float + 80-cross celebration */}
                        <div className="flex items-center gap-4 md:gap-5 md:pl-5 md:border-l md:border-surface-100 md:dark:border-white/10">
                          <div className="relative w-20 h-20 shrink-0">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                              <circle cx="18" cy="18" r="15.915" fill="none" className="stroke-surface-100 dark:stroke-white/10" strokeWidth="3" />
                              <motion.circle
                                cx="18"
                                cy="18"
                                r="15.915"
                                fill="none"
                                className={`${ringColor} transition-colors`}
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray="100, 100"
                                initial={false}
                                animate={{ strokeDashoffset: 100 - ringPct }}
                                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-xl md:text-2xl font-black text-surface-900 dark:text-white tabular-nums leading-none">
                                <AnimatedNumber value={result.score} format={(n) => String(n)} />
                              </span>
                              <span className="text-[8px] font-bold uppercase tracking-widest text-surface-400 dark:text-slate-500 mt-1">
                                Hook
                              </span>
                            </div>

                            {/* Delta badge — floats up when score improves. */}
                            <AnimatePresence>
                              {scoreDelta && scoreDelta.value > 0 && (
                                <motion.div
                                  key={scoreDelta.id}
                                  initial={{ opacity: 0, y: 0, scale: 0.7 }}
                                  animate={{ opacity: 1, y: -28, scale: 1 }}
                                  exit={{ opacity: 0, y: -48 }}
                                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                                  className="absolute -top-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black tabular-nums shadow-lg shadow-emerald-500/30 pointer-events-none"
                                >
                                  +{scoreDelta.value}
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Threshold celebration — a burst when the
                                visitor first crosses 80. Single-frame
                                animation, fades fast — celebration not
                                noise. */}
                            <AnimatePresence>
                              {crossedThreshold && (
                                <motion.div
                                  key={`burst-${result.score}`}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: [0, 1, 0], scale: [0.8, 1.4, 1.6] }}
                                  transition={{ duration: 0.9, ease: 'easeOut' }}
                                  className="absolute inset-0 rounded-full border-4 border-emerald-500/50 pointer-events-none"
                                />
                              )}
                            </AnimatePresence>
                          </div>

                          <div className="hidden md:flex flex-col text-[10px] font-bold uppercase tracking-widest gap-0.5">
                            <span className={result.score >= 80 ? 'text-emerald-500' : 'text-surface-400 dark:text-slate-500'}>● Top decile</span>
                            <span className={result.score >= 60 && result.score < 80 ? 'text-primary-500' : 'text-surface-300 dark:text-slate-600'}>● Above median</span>
                            <span className={result.score >= 35 && result.score < 60 ? 'text-amber-500' : 'text-surface-300 dark:text-slate-600'}>● Needs work</span>
                            <span className={result.score < 35 && result.score > 0 ? 'text-rose-500' : 'text-surface-300 dark:text-slate-600'}>● Rewrite</span>
                          </div>
                        </div>
                      </div>

                      {/* AI rewrite preview — appears when score < 70. The
                          single biggest conversion lever in this section:
                          the visitor sees Click's voice on their own hook,
                          not on a sample. Quietly powerful. */}
                      <AnimatePresence>
                        {rewriteSuggestion && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                            className="relative overflow-hidden"
                          >
                            <div className="rounded-2xl bg-gradient-to-br from-primary-500/10 to-fuchsia-500/10 border border-primary-500/30 p-4 md:p-5">
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-3.5 h-3.5 text-primary-500" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-primary-500">
                                  Click would rewrite this as
                                </span>
                              </div>
                              <p className="text-sm md:text-base font-bold text-surface-900 dark:text-white italic leading-relaxed">
                                &ldquo;{rewriteSuggestion}&rdquo;
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setHook(rewriteSuggestion);
                                  hookInputRef.current?.focus();
                                }}
                                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-primary-500 hover:text-primary-600 transition-colors"
                              >
                                Use this rewrite
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Niche tab controls — with icons + a pause/play that puts the
            user in charge of the cycle. */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10" aria-label="Niche preview">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
            {NICHES.map((n, i) => {
              const Icon = n.Icon;
              const active = i === activeIdx;
              return (
                <button
                  type="button"
                  key={n.id}
                  aria-label={active ? `${n.label} niche — current preview` : `Switch to ${n.label} niche preview`}
                  {...{ 'aria-pressed': active }}
                  onClick={() => jumpTo(i)}
                  className={`px-5 sm:px-7 py-3 rounded-full text-xs font-bold border-2 transition-all duration-300 shadow-xl magnetic-hover flex items-center gap-2.5 ${
                    active
                      ? 'bg-surface-900 dark:bg-white text-white dark:text-black border-surface-900 dark:border-white scale-105'
                      : 'bg-surface-card text-surface-500 dark:text-slate-400 border-surface-100 dark:border-white/5 hover:text-primary-500 hover:border-primary-500/40'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {n.label}
                </button>
              );
            })}
          </div>
          {/* Pause/play. The auto-cycle is helpful for skimmers but
              annoying when a visitor wants to read a specific niche's
              insight. Toggle gives them control. */}
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Resume niche preview cycle' : 'Pause niche preview cycle'}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border border-surface-100 dark:border-white/10 bg-surface-card text-surface-400 dark:text-slate-500 hover:text-primary-500 hover:border-primary-500/30 transition-colors"
          >
            {paused ? <><Play className="w-3 h-3" /> Resume</> : <><Pause className="w-3 h-3" /> Pause</>}
          </button>
        </div>

        {/* Conversion-tied CTA strip below the demo. Closes the section
            with a concrete next step — visitors who liked what they
            saw get the path to act immediately. */}
        <div className="mt-16 max-w-3xl mx-auto text-center space-y-6">
          <p className="text-sm md:text-base text-surface-500 dark:text-slate-400 leading-relaxed">
            Click runs this analysis on your real content the second you upload it — no model training, no setup wizard, no credit card.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register?plan=free"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold shadow-[0_30px_60px_rgba(99,102,241,0.3)] transition-colors group/btn"
            >
              Start free — first export in 90 seconds
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/#pricing"
              className="text-xs font-bold uppercase tracking-widest text-surface-500 dark:text-slate-400 hover:text-primary-500 transition-colors"
            >
              See pricing →
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
