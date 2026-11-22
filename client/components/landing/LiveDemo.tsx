'use client';

import Link from 'next/link';
import { m as Motion, AnimatePresence, animate, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowRight, Sparkles, DollarSign, Dumbbell, Heart, Wand2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Animated number that tweens from its previous value to a new one whenever
 * the prop changes. Jumps straight to the value under prefers-reduced-motion.
 */
function AnimatedNumber({ value, format, reduce }: { value: number; format: (n: number) => string; reduce: boolean }) {
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, (latest: number) => format(Math.round(latest)));

  useEffect(() => {
    if (reduce) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.6, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, motionValue, reduce]);

  return <Motion.span>{rounded}</Motion.span>;
}

/**
 * Deterministic, client-side hook scorer. Inside Click, hook analysis runs
 * server-side on the actual video and script (POST /api/video/hook-analysis);
 * we can't ship that to anonymous traffic. This wording-only approximation
 * gives the visitor a plausible, niche-aware reaction to their own line.
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
  else if (score >= 80) tip = 'Strong hook. Clear, specific and short.';

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

// Niche tabs for the checker. `insight` is general craft advice for the niche,
// not a measured result.
const NICHES: { id: Niche; label: string; Icon: typeof DollarSign; insight: string }[] = [
  {
    id: 'finance',
    label: 'Finance',
    Icon: DollarSign,
    insight: 'Finance hooks tend to work better when a specific dollar amount appears in the first few words.',
  },
  {
    id: 'fitness',
    label: 'Fitness',
    Icon: Dumbbell,
    insight: 'Fitness shorts tend to hold attention when they get to the demonstration quickly instead of a long intro.',
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle',
    Icon: Heart,
    insight: 'Lifestyle audiences scroll fast, so a clear point of view and readable captions in the first seconds matter.',
  },
];

function band(score: number): { label: string; ring: string; text: string } {
  if (score >= 80) return { label: 'Strong', ring: 'stroke-emerald-500', text: 'text-emerald-500' };
  if (score >= 60) return { label: 'Good', ring: 'stroke-primary-500', text: 'text-primary-500' };
  if (score >= 35) return { label: 'Needs work', ring: 'stroke-amber-500', text: 'text-amber-500' };
  if (score > 0) return { label: 'Rewrite it', ring: 'stroke-rose-500', text: 'text-rose-500' };
  return { label: 'Waiting', ring: 'stroke-surface-300', text: 'text-surface-400 dark:text-slate-500' };
}

export function LiveDemo() {
  const reduce = !!useReducedMotion();
  const [nicheId, setNicheId] = useState<Niche>('finance');
  const [hook, setHook] = useState('');
  const hookInputRef = useRef<HTMLInputElement | null>(null);

  // "+N" badge when the visitor improves their hook by 5 points or more.
  const [scoreDelta, setScoreDelta] = useState<{ id: number; value: number } | null>(null);
  const prevScoreRef = useRef(0);
  const deltaIdRef = useRef(0);

  const niche = NICHES.find((n) => n.id === nicheId) ?? NICHES[0];
  const result = scoreHook(hook, nicheId);
  const tone = band(result.score);
  const rewriteSuggestion =
    result.score > 0 && result.score < 70 && hook.trim().length >= 6 ? rewriteHook(hook, nicheId) : null;

  useEffect(() => {
    const prev = prevScoreRef.current;
    prevScoreRef.current = result.score;
    const delta = result.score - prev;
    if (delta < 5 || hook.trim().length === 0 || reduce) return;
    deltaIdRef.current += 1;
    const id = deltaIdRef.current;
    setScoreDelta({ id, value: delta });
    const timer = window.setTimeout(() => setScoreDelta((d) => (d && d.id === id ? null : d)), 1200);
    return () => window.clearTimeout(timer);
  }, [result.score, hook, reduce]);

  return (
    <section id="demo" aria-labelledby="demo-heading" className="px-4 sm:px-6 py-16 md:py-24 font-inter relative scroll-mt-20">
      <div className="max-w-3xl mx-auto text-center mb-10 md:mb-12">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-500 mb-4">Try it</p>
        <h2 id="demo-heading" className="text-3xl md:text-5xl font-black tracking-tighter leading-tight text-balance text-surface-900 dark:text-white mb-4">
          Check a hook before you film it
        </h2>
        <p className="text-surface-600 dark:text-slate-300 text-base md:text-lg leading-relaxed">
          The first seconds decide whether people keep watching. Type an opening line and get a score and one thing to fix. This simplified checker runs in your browser and only looks at the wording; inside Click, hook analysis looks at your actual video and script.
        </p>
      </div>

      <div className="max-w-4xl mx-auto click-vessel p-5 sm:p-8 md:p-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/25 flex items-center justify-center text-fuchsia-500 shrink-0">
              <Wand2 className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-bold text-surface-900 dark:text-white">Your niche</span>
          </div>
          <div role="group" aria-label="Niche" className="flex flex-wrap gap-2">
            {NICHES.map(({ id, label, Icon }) => {
              const active = id === nicheId;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setNicheId(id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50 ${
                    active
                      ? 'bg-surface-900 dark:bg-white text-white dark:text-black border-surface-900 dark:border-white'
                      : 'bg-transparent text-surface-600 dark:text-slate-300 border-surface-200 dark:border-white/10 hover:border-primary-500/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-5 md:items-start">
          <div className="flex-1 min-w-0">
            <label htmlFor="hook-scorer-input" className="block text-xs font-bold uppercase tracking-widest text-surface-500 dark:text-slate-400 mb-2">
              Your opening line
            </label>
            <input
              id="hook-scorer-input"
              ref={hookInputRef}
              type="text"
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              placeholder={HOOK_PLACEHOLDERS[nicheId]}
              maxLength={140}
              className="w-full px-5 py-4 rounded-2xl bg-surface-page dark:bg-black/40 border-2 border-surface-200 dark:border-white/10 text-sm md:text-base text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-colors"
            />
            <div className="flex items-start justify-between gap-3 mt-2 px-1">
              <p className="text-xs text-surface-600 dark:text-slate-300 leading-snug" aria-live="polite">
                <span className="font-bold text-surface-900 dark:text-white">Tip: </span>
                {result.tip}
              </p>
              <span className="text-[10px] font-bold text-surface-400 dark:text-slate-500 tabular-nums shrink-0 pt-0.5">{hook.length}/140</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-surface-500 dark:text-slate-400 mr-1">Or try</span>
              {PRESET_HOOKS[nicheId].map((p) => (
                <button
                  key={p.text}
                  type="button"
                  onClick={() => {
                    setHook(p.text);
                    hookInputRef.current?.focus();
                  }}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50 ${
                    p.label === 'Weak'
                      ? 'border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400 hover:border-rose-500/60'
                      : 'border-primary-500/30 bg-primary-500/5 text-primary-600 dark:text-primary-300 hover:border-primary-500/60'
                  }`}
                >
                  <span className="sr-only">{p.label} example: </span>
                  &ldquo;{p.text}&rdquo;
                </button>
              ))}
            </div>
          </div>

          <div className="flex md:flex-col items-center gap-4 md:gap-2 md:pl-6 md:border-l md:border-surface-100 md:dark:border-white/10 md:w-36 shrink-0">
            <div className="relative w-24 h-24 shrink-0" role="img" aria-label={`Hook score ${result.score} out of 100, ${tone.label}`}>
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="15.915" fill="none" className="stroke-surface-200 dark:stroke-white/10" strokeWidth="3" />
                <Motion.circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  className={tone.ring}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="100, 100"
                  initial={false}
                  animate={{ strokeDashoffset: 100 - result.score }}
                  transition={reduce ? { duration: 0 } : { duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
                <span className="text-2xl font-black text-surface-900 dark:text-white tabular-nums leading-none">
                  <AnimatedNumber value={result.score} format={(n) => String(n)} reduce={reduce} />
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-surface-400 dark:text-slate-500 mt-1">of 100</span>
              </div>
              <AnimatePresence>
                {scoreDelta && (
                  <Motion.span
                    key={scoreDelta.id}
                    aria-hidden="true"
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: 1, y: -24 }}
                    exit={{ opacity: 0, y: -40 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black tabular-nums pointer-events-none"
                  >
                    +{scoreDelta.value}
                  </Motion.span>
                )}
              </AnimatePresence>
            </div>
            <span className={`text-xs font-bold uppercase tracking-widest ${tone.text}`} aria-hidden="true">{tone.label}</span>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {rewriteSuggestion && (
            <Motion.div
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: reduce ? 0 : 0.3 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl bg-gradient-to-br from-primary-500/10 to-fuchsia-500/10 border border-primary-500/30 p-4 md:p-5">
                <p className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-primary-600 dark:text-primary-300">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  Example rewrite (the numbers are placeholders)
                </p>
                <p className="text-sm md:text-base font-bold text-surface-900 dark:text-white leading-relaxed">&ldquo;{rewriteSuggestion}&rdquo;</p>
                <button
                  type="button"
                  onClick={() => {
                    setHook(rewriteSuggestion);
                    hookInputRef.current?.focus();
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-300 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50 rounded"
                >
                  Use this rewrite
                  <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            </Motion.div>
          )}
        </AnimatePresence>

        <p className="text-sm text-surface-600 dark:text-slate-300 leading-relaxed border-t border-surface-100 dark:border-white/10 pt-5">
          <span className="font-bold text-surface-900 dark:text-white">{niche.label}: </span>
          {niche.insight}
        </p>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/register?plan=free"
          className="inline-flex items-center gap-2 text-sm font-bold text-primary-600 dark:text-primary-300 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50 rounded"
        >
          Run it on your own videos, free
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
