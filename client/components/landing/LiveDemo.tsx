'use client';

import Link from 'next/link';
import {
  m as Motion,
  AnimatePresence,
  animate,
  useInView,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import { ArrowRight, Sparkles, DollarSign, Dumbbell, Heart, Lightbulb, Check, X, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CaptionLine, StudioScene } from './visuals';

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
 * The visible checklist is derived from the SAME tests (see HOOK_TESTS), so
 * every row the visitor sees is a real input to the number they get.
 */
type Niche = 'finance' | 'fitness' | 'lifestyle';

const HOOK_TESTS = {
  numericLead: (t: string) => /^[0-9]/.test(t),
  negativeLead: (lower: string) => /^(stop|don'?t|never|nobody)/.test(lower),
  directLead: (lower: string) => /^(why|how|this|here'?s|the)/.test(lower),
  sweetSpot: (wordCount: number) => wordCount >= 5 && wordCount <= 12,
  hasDigit: (t: string) => /\d/.test(t),
  hype: (lower: string) => /awesome|amazing|incredible|game.?changing|life.?changing/i.test(lower),
  nicheAnchor: (t: string, nicheId: Niche) => {
    if (nicheId === 'finance') return /\$|dollar|usd|payout|salary|tax|debt|hysa|401k|roth/i.test(t);
    if (nicheId === 'fitness') return /before|after|transform|cut|lost|gain|reps|set|pr\b/i.test(t);
    return /pov|aesthetic|minimal|routine|reset|morning|evening|romanticiz/i.test(t);
  },
};

function scoreHook(text: string, nicheId: Niche): { score: number; tip: string } {
  const t = text.trim();
  if (t.length === 0) return { score: 0, tip: 'Type a hook idea to see the score.' };
  if (t.length < 6) return { score: 12, tip: 'Too short. Hooks land best at 5–12 words.' };

  let score = 40;
  const lower = t.toLowerCase();
  const words = t.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Universal patterns
  if (HOOK_TESTS.numericLead(t)) score += 10; // numeric lead ("5 things…")
  if (HOOK_TESTS.negativeLead(lower)) score += 8; // negative-frame attention grab
  if (HOOK_TESTS.directLead(lower)) score += 6;
  if (HOOK_TESTS.sweetSpot(wordCount)) score += 12; // sweet spot
  if (wordCount > 18) score -= 10;
  if (HOOK_TESTS.hasDigit(t)) score += 4; // any digit = specificity
  if (/[!?]$/.test(t)) score += 3; // punctuation energy

  // Niche-specific bonuses
  if (nicheId === 'finance') {
    if (HOOK_TESTS.nicheAnchor(t, nicheId)) score += 14;
    if (/(per|a)\s+(month|year|week|day|hour)/i.test(t)) score += 6;
  } else if (nicheId === 'fitness') {
    if (HOOK_TESTS.nicheAnchor(t, nicheId)) score += 14;
    if (/(weeks?|months?|days?)/i.test(lower) && /\d/.test(t)) score += 6;
  } else if (nicheId === 'lifestyle') {
    if (HOOK_TESTS.nicheAnchor(t, nicheId)) score += 12;
    if (/(i\s+|me\s+|my\s+)/i.test(lower.slice(0, 16))) score += 6; // first-person early
  }

  // Cliché penalty — generic openers we tell the AI to avoid.
  if (HOOK_TESTS.hype(lower)) score -= 8;

  score = Math.max(8, Math.min(99, Math.round(score)));

  // Tip — the most useful single change for this hook.
  let tip = 'Solid. Tighten the verbs and you could go higher.';
  if (score < 35) tip = 'Lead with a number or a specific verb. Drop softeners like "really" or "kind of".';
  else if (wordCount < 5) tip = 'Add one specific detail — a number, a name, a timeframe.';
  else if (wordCount > 12) tip = 'Cut it to 12 words or fewer. A hook has to land in about two seconds.';
  else if (nicheId === 'finance' && !/\$|\d/.test(t)) tip = 'Anchor with a dollar amount in the first 4 words. Finance hooks live or die on specificity.';
  else if (nicheId === 'fitness' && !/before|after|\d/i.test(t)) tip = 'Promise a transformation or include a number (weeks, reps, lbs).';
  else if (nicheId === 'lifestyle' && !/pov|i\s+|my\s+/i.test(lower.slice(0, 16))) tip = 'Lifestyle wins with POV framing. Try opening with "I" or "POV:".';
  else if (score >= 80) tip = 'Strong hook. Clear, specific and short.';

  return { score, tip };
}

type CheckState = 'pass' | 'fail' | 'pending';
interface HookCheck {
  id: string;
  label: string;
  hint: string;
  state: CheckState;
}

const NICHE_ANCHOR_COPY: Record<Niche, { label: string; hint: string }> = {
  finance: { label: 'A money detail', hint: 'A $ amount, salary, tax, debt, 401k…' },
  fitness: { label: 'A visible result', hint: 'Before/after, lbs lost, reps, a PR…' },
  lifestyle: { label: 'A point of view', hint: 'POV, a routine, a reset, an aesthetic…' },
};

function hookChecks(text: string, nicheId: Niche): HookCheck[] {
  const t = text.trim();
  const lower = t.toLowerCase();
  const wordCount = t ? t.split(/\s+/).filter(Boolean).length : 0;
  const pending = t.length === 0;
  const state = (ok: boolean): CheckState => (pending ? 'pending' : ok ? 'pass' : 'fail');
  return [
    {
      id: 'opener',
      label: 'Strong first word',
      hint: 'Open on a number, “Stop”, “Why”, “This”…',
      state: state(HOOK_TESTS.numericLead(t) || HOOK_TESTS.negativeLead(lower) || HOOK_TESTS.directLead(lower)),
    },
    {
      id: 'length',
      label: '5–12 words',
      hint: pending ? 'Short enough to read in two seconds' : `Yours is ${wordCount} word${wordCount === 1 ? '' : 's'}`,
      state: state(HOOK_TESTS.sweetSpot(wordCount)),
    },
    { id: 'specific', label: 'A concrete number', hint: 'Digits read as proof; vague words don’t', state: state(HOOK_TESTS.hasDigit(t)) },
    { id: 'niche', ...NICHE_ANCHOR_COPY[nicheId], state: state(HOOK_TESTS.nicheAnchor(t, nicheId)) },
    { id: 'hype', label: 'No hype words', hint: 'Skip “amazing”, “game-changing”…', state: state(!HOOK_TESTS.hype(lower)) },
  ];
}

const HOOK_PLACEHOLDERS: Record<Niche, string> = {
  finance: 'Type a hook — e.g. "I saved $4,237 in 90 days with one HYSA trick"',
  fitness: 'Type a hook — e.g. "Lost 12 lbs in 8 weeks without giving up pizza"',
  lifestyle: 'Type a hook — e.g. "POV: the 10-minute morning that changed my week"',
};

/**
 * Per-niche preset hooks. A visitor who doesn't want to type can click
 * a chip and the scorer instantly lights up. One "weak" example per niche
 * lets the visitor see the score drop and the rewrite appear — the contrast
 * is the "aha" moment.
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

function band(score: number): { label: string; ring: string; text: string; glow: string; edge: string } {
  if (score >= 80)
    return { label: 'Strong', ring: 'stroke-emerald-400', text: 'text-emerald-500', glow: 'bg-emerald-500/30', edge: 'border-emerald-500/40' };
  if (score >= 60)
    return { label: 'Good', ring: 'stroke-primary-400', text: 'text-primary-500', glow: 'bg-primary-500/30', edge: 'border-primary-500/40' };
  if (score >= 35)
    return { label: 'Needs work', ring: 'stroke-amber-400', text: 'text-amber-500', glow: 'bg-amber-500/25', edge: 'border-amber-500/40' };
  if (score > 0)
    return { label: 'Rewrite it', ring: 'stroke-rose-400', text: 'text-rose-500', glow: 'bg-rose-500/25', edge: 'border-rose-500/40' };
  return {
    label: 'Waiting',
    ring: 'stroke-surface-300',
    text: 'text-surface-400 dark:text-slate-500',
    glow: 'bg-primary-500/10',
    edge: 'border-surface-900/10 dark:border-white/10',
  };
}

/** Caption size on the phone shrinks as the hook gets longer, like a real burn-in. */
function captionSize(wordCount: number): string {
  if (wordCount <= 5) return 'text-[17px] sm:text-[24px]';
  if (wordCount <= 9) return 'text-[13px] sm:text-[19px]';
  if (wordCount <= 14) return 'text-[11px] sm:text-[15px]';
  return 'text-[9px] sm:text-[12px]';
}

function CheckIcon({ state }: { state: CheckState }) {
  if (state === 'pass') {
    return (
      <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]">
        <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  if (state === 'fail') {
    return (
      <span className="w-6 h-6 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/40 flex items-center justify-center shrink-0">
        <X className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  return <span className="w-6 h-6 rounded-full border-2 border-dashed border-surface-900/20 dark:border-white/20 shrink-0" aria-hidden="true" />;
}

const STATE_TEXT: Record<CheckState, string> = { pass: 'passed', fail: 'missing', pending: 'not checked yet' };

export function LiveDemo() {
  const reduce = !!useReducedMotion();
  const [nicheId, setNicheId] = useState<Niche>('finance');
  const [hook, setHook] = useState('');
  const hookInputRef = useRef<HTMLTextAreaElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stageInView = useInView(stageRef, { margin: '-10% 0px' });

  // "+N" badge when the visitor improves their hook by 5 points or more.
  const [scoreDelta, setScoreDelta] = useState<{ id: number; value: number } | null>(null);
  const prevScoreRef = useRef(0);
  const deltaIdRef = useRef(0);

  const niche = NICHES.find((n) => n.id === nicheId) ?? NICHES[0];
  const result = scoreHook(hook, nicheId);
  const tone = band(result.score);
  const checks = hookChecks(hook, nicheId);
  const passed = checks.filter((c) => c.state === 'pass').length;
  const rewriteSuggestion =
    result.score > 0 && result.score < 70 && hook.trim().length >= 6 ? rewriteHook(hook, nicheId) : null;

  // Phone caption: the visitor's own words, highlighted one at a time.
  const typedWords = hook.trim() ? hook.trim().split(/\s+/) : [];
  const captionWords = typedWords.length ? typedWords : ['Your', 'hook', 'shows', 'up', 'here'];
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduce || !stageInView) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 340);
    return () => window.clearInterval(id);
  }, [reduce, stageInView]);
  const activeWord = reduce || !typedWords.length ? -1 : tick % (captionWords.length + 3);

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

  const applyLine = (text: string) => {
    setHook(text);
    hookInputRef.current?.focus();
  };

  return (
    <section id="demo" aria-labelledby="demo-heading" className="px-4 sm:px-6 py-20 md:py-28 font-inter relative scroll-mt-20">
      <div className="max-w-3xl mx-auto text-center mb-12 md:mb-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-500 mb-4">Try it</p>
        <h2 id="demo-heading" className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.98] text-balance text-surface-900 dark:text-white mb-5">
          Check a hook before you film it
        </h2>
        <p className="text-surface-600 dark:text-slate-300 text-base md:text-lg leading-relaxed">
          The first seconds decide whether people keep watching. Type an opening line and see how it reads on screen, what is working and the one thing to fix.
        </p>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="click-vessel !rounded-[2rem] p-5 sm:p-8 lg:p-10 shadow-[0_40px_120px_-50px_rgba(79,70,229,0.55)]">
          <div className="grid grid-cols-1 gap-8 lg:gap-x-12 lg:gap-y-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
            {/* ── Writing surface ─────────────────────────────────────────── */}
            <div className="lg:col-start-1 lg:row-start-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-500 dark:text-slate-400">Your niche</span>
                <div role="group" aria-label="Niche" className="inline-flex p-1 rounded-full bg-surface-900/5 dark:bg-white/5 border border-surface-900/5 dark:border-white/10">
                  {NICHES.map(({ id, label, Icon }) => {
                    const active = id === nicheId;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setNicheId(id)}
                        className={`relative inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50 ${
                          active ? 'text-white dark:text-surface-900' : 'text-surface-600 dark:text-slate-300 hover:text-surface-900 dark:hover:text-white'
                        }`}
                      >
                        {active && (
                          <Motion.span
                            layoutId="hook-niche-pill"
                            aria-hidden="true"
                            className="absolute inset-0 rounded-full bg-surface-900 dark:bg-white shadow-sm"
                            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                          />
                        )}
                        <Icon className="relative w-3.5 h-3.5" aria-hidden="true" />
                        <span className="relative">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label htmlFor="hook-scorer-input" className="block text-[11px] font-bold uppercase tracking-[0.2em] text-surface-500 dark:text-slate-400 mb-3">
                Your opening line
              </label>
              <div className="relative group">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-px rounded-[1.4rem] opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(110deg,var(--click-energy-lead),var(--click-energy-mid),var(--click-energy-warm))' }}
                />
                <textarea
                  id="hook-scorer-input"
                  ref={hookInputRef}
                  rows={2}
                  value={hook}
                  onChange={(e) => setHook(e.target.value.replace(/\n/g, ' '))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  placeholder={HOOK_PLACEHOLDERS[nicheId]}
                  maxLength={140}
                  spellCheck={false}
                  className="relative block w-full resize-none px-5 py-4 rounded-[1.35rem] bg-[var(--click-canvas-base)] border border-surface-900/10 dark:border-white/10 text-lg md:text-2xl font-bold tracking-tight leading-snug text-surface-900 dark:text-white placeholder:font-medium placeholder:text-base md:placeholder:text-lg placeholder:tracking-normal placeholder:text-surface-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-transparent transition-colors"
                />
              </div>
              <div className="flex items-center justify-between gap-3 mt-2.5 px-1 text-[11px] font-bold tabular-nums text-surface-400 dark:text-slate-500">
                <span>{typedWords.length} word{typedWords.length === 1 ? '' : 's'}</span>
                <span>{hook.length}/140</span>
              </div>

              <div className={`mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors duration-300 ${tone.edge} bg-surface-900/[0.02] dark:bg-white/[0.03]`}>
                <Lightbulb className={`w-4 h-4 mt-0.5 shrink-0 transition-colors ${tone.text}`} aria-hidden="true" />
                <p className="text-sm text-surface-600 dark:text-slate-300 leading-snug" aria-live="polite">
                  <span className="font-bold text-surface-900 dark:text-white">Tip: </span>
                  {result.tip}
                </p>
              </div>

              <div className="mt-5">
                <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-surface-500 dark:text-slate-400 mb-2.5">Or try one</span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_HOOKS[nicheId].map((p) => {
                    const weak = p.label === 'Weak';
                    return (
                      <button
                        key={p.text}
                        type="button"
                        onClick={() => applyLine(p.text)}
                        className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border text-left transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50 ${
                          weak
                            ? 'border-rose-500/25 bg-rose-500/5 text-rose-600 dark:text-rose-300 hover:border-rose-500/60'
                            : 'border-surface-900/10 dark:border-white/10 bg-surface-900/[0.02] dark:bg-white/[0.03] text-surface-700 dark:text-slate-200 hover:border-primary-500/50'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${weak ? 'bg-rose-500' : 'bg-emerald-500'}`} aria-hidden="true" />
                        <span className="sr-only">{p.label} example: </span>
                        &ldquo;{p.text}&rdquo;
                      </button>
                    );
                  })}
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
                    <div className="mt-5 relative rounded-2xl p-[1px]" style={{ background: 'linear-gradient(110deg,var(--click-energy-lead),var(--click-energy-mid),var(--click-energy-warm))' }}>
                      <div className="rounded-[calc(1rem-1px)] bg-[var(--click-canvas-base)] p-4 md:p-5">
                        <p className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-primary-600 dark:text-primary-300">
                          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                          Example rewrite (the numbers are placeholders)
                        </p>
                        <p className="text-base md:text-lg font-black tracking-tight text-surface-900 dark:text-white leading-snug">&ldquo;{rewriteSuggestion}&rdquo;</p>
                        <button
                          type="button"
                          onClick={() => applyLine(rewriteSuggestion)}
                          className="click-btn-energy mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50"
                        >
                          Use this rewrite
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </Motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Phone preview + score ───────────────────────────────────── */}
            <div ref={stageRef} className="lg:col-start-2 lg:row-start-1 lg:row-span-2 min-w-0">
            <div className="lg:sticky lg:top-28 relative flex items-center justify-center py-4 lg:py-0 min-h-[400px] sm:min-h-[500px] lg:min-h-[560px]">
              <span aria-hidden="true" className={`absolute w-[260px] h-[260px] sm:w-[360px] sm:h-[360px] rounded-full blur-[70px] transition-colors duration-700 ${tone.glow}`} />
              <span
                aria-hidden="true"
                className="absolute w-[290px] h-[290px] sm:w-[400px] sm:h-[400px] rounded-full border border-dashed border-surface-900/10 dark:border-white/10 motion-safe:animate-[spin_40s_linear_infinite]"
              />

              <div className="relative flex items-center gap-3 sm:gap-5">
                {/* phone */}
                <div className="relative shrink-0 w-[172px] sm:w-[236px] aspect-[9/16] rounded-[2rem] sm:rounded-[2.4rem] p-[7px] bg-gradient-to-b from-slate-700 via-slate-900 to-black shadow-[0_40px_100px_-30px_rgba(79,70,229,0.55),0_30px_60px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
                  <div className="relative w-full h-full rounded-[1.6rem] sm:rounded-[1.95rem] overflow-hidden bg-black" aria-hidden="true">
                    <StudioScene vignette={0.35} />
                    <div className="absolute top-0 inset-x-0 p-3 space-y-2.5">
                      <div className="h-[3px] rounded-full bg-white/25 overflow-hidden">
                        <Motion.div
                          className="h-full bg-white rounded-full"
                          initial={false}
                          animate={reduce || !typedWords.length ? { width: '0%' } : { width: ['0%', '100%'] }}
                          transition={reduce ? { duration: 0 } : { duration: (captionWords.length + 3) * 0.34, repeat: Infinity, ease: 'linear' }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 to-fuchsia-500 ring-1 ring-white/40" />
                          <span className="hidden sm:inline text-[10px] font-bold text-white/90">@yourchannel</span>
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-black/40 backdrop-blur text-[9px] font-bold text-white/90 tracking-wider whitespace-nowrap">0:00–0:02</span>
                      </div>
                    </div>
                    {/* right-rail actions */}
                    <div className="absolute right-2.5 bottom-[9%] hidden sm:flex flex-col gap-2.5">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="w-6 h-6 rounded-full bg-white/15 backdrop-blur ring-1 ring-white/20" />
                      ))}
                    </div>
                    {/* the visitor's hook, burned in */}
                    <div className={`absolute inset-x-2.5 sm:inset-x-4 top-[36%] ${captionSize(captionWords.length)} ${typedWords.length ? '' : 'opacity-50'}`}>
                      <CaptionLine words={captionWords} activeWord={activeWord} look="pill" />
                    </div>
                    <div className="absolute bottom-0 inset-x-0 h-1/4 bg-gradient-to-t from-black/70 to-transparent" />
                    <p className="hidden sm:block absolute bottom-3 left-3 right-12 text-[9px] font-semibold text-white/70 leading-snug">
                      What viewers see before they decide to stay
                    </p>
                  </div>
                </div>

                {/* score card */}
                <div className="relative shrink-0 w-[124px] sm:w-[150px] rounded-2xl p-3 sm:p-3.5 bg-white/90 dark:bg-[#12101f]/90 backdrop-blur-xl border border-surface-900/10 dark:border-white/10 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)] flex flex-col items-center">
                  <div className="relative w-[84px] h-[84px] sm:w-[104px] sm:h-[104px]" role="img" aria-label={`Hook score ${result.score} out of 100, ${tone.label}`}>
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                      <circle cx="18" cy="18" r="15.915" fill="none" className="stroke-surface-900/10 dark:stroke-white/10" strokeWidth="3" />
                      <Motion.circle
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="none"
                        className={`${tone.ring} transition-colors duration-500`}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray="100, 100"
                        initial={false}
                        animate={{ strokeDashoffset: 100 - result.score }}
                        transition={reduce ? { duration: 0 } : { duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
                      <span className="text-[26px] sm:text-[32px] font-black text-surface-900 dark:text-white tabular-nums leading-none">
                        <AnimatedNumber value={result.score} format={(n) => String(n)} reduce={reduce} />
                      </span>
                      <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-surface-400 dark:text-slate-500 mt-1">of 100</span>
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
                          className="absolute -top-2 left-1/2 -ml-4 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black tabular-nums pointer-events-none"
                        >
                          +{scoreDelta.value}
                        </Motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className={`mt-2 text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-colors ${tone.text}`} aria-hidden="true">
                    {tone.label}
                  </span>
                  <span className="mt-0.5 text-[10px] font-semibold text-surface-500 dark:text-slate-400 tabular-nums" aria-hidden="true">
                    {passed}/{checks.length} checks
                  </span>
                </div>
              </div>
            </div>
            </div>

            {/* ── What it checks ──────────────────────────────────────────── */}
            <div className="lg:col-start-1 lg:row-start-2 min-w-0 border-t border-surface-900/10 dark:border-white/10 pt-6">
              <div className="flex items-baseline justify-between gap-3 mb-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-surface-500 dark:text-slate-400">What it checks</h3>
                <span className="text-xs font-bold tabular-nums text-surface-500 dark:text-slate-400">
                  {passed} of {checks.length} passed
                </span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
                {checks.map((c) => (
                  <li key={c.id} className="flex items-start gap-3">
                    <CheckIcon state={c.state} />
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-bold leading-tight transition-colors ${
                          c.state === 'pending' ? 'text-surface-500 dark:text-slate-400' : 'text-surface-900 dark:text-white'
                        }`}
                      >
                        {c.label}
                        <span className="sr-only">: {STATE_TEXT[c.state]}</span>
                      </p>
                      <p className="text-xs text-surface-500 dark:text-slate-400 leading-snug mt-0.5">{c.hint}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-surface-600 dark:text-slate-300 leading-relaxed">
                <span className="font-bold text-surface-900 dark:text-white">{niche.label}: </span>
                {niche.insight}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-5 flex items-start justify-center gap-2 text-xs text-surface-500 dark:text-slate-400 text-center max-w-2xl mx-auto leading-relaxed">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          This simplified checker runs in your browser and only looks at the wording. Inside Click, hook analysis looks at your actual video and script.
        </p>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/register?plan=free"
          className="click-btn-energy inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50"
        >
          Run it on your own videos, free
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
