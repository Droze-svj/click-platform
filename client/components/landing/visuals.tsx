'use client';

import { useEffect, useId, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Drawn-in-code product visuals for the landing page.
 *
 * Everything here is an ILLUSTRATION of a Click edit — no stock footage, no
 * screenshots with made-up numbers, nothing that pretends to be live data.
 * Sections that use these say so in a visible "Illustration" note.
 */

// ── Platforms Click publishes to (socialMediaService adapters) ──────────────
export const PLATFORMS = [
  { id: 'tiktok', name: 'TikTok', bg: '#000000' },
  { id: 'instagram', name: 'Instagram', bg: 'linear-gradient(135deg,#f58529 0%,#dd2a7b 50%,#8134af 100%)' },
  { id: 'youtube', name: 'YouTube', bg: '#ff0000' },
  { id: 'x', name: 'X', bg: '#000000' },
  { id: 'linkedin', name: 'LinkedIn', bg: '#0a66c2' },
  { id: 'facebook', name: 'Facebook Pages', bg: '#1877f2' },
] as const;

export type PlatformId = (typeof PLATFORMS)[number]['id'];

function Glyph({ id }: { id: PlatformId }) {
  switch (id) {
    case 'tiktok':
      return <path fill="#fff" d="M16 3c.3 2.2 1.7 3.8 4 4v3c-1.5 0-2.9-.4-4-1.2V15a6 6 0 1 1-6-6v3.2A2.8 2.8 0 1 0 12.8 15V3H16z" />;
    case 'instagram':
      return (
        <g fill="none" stroke="#fff" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="5" />
          <circle cx="12" cy="12" r="3.6" />
          <circle cx="17" cy="7" r="0.6" fill="#fff" />
        </g>
      );
    case 'youtube':
      return <path fill="#fff" d="M9.5 7.5v9l7.5-4.5z" />;
    case 'x':
      return (
        <g fill="#fff">
          <path d="M4 4h4.6l11.4 16h-4.6z" />
          <path d="M18.6 4h1.9l-6.9 7.9-1-1.3zM5.4 20H3.5l7-8 1 1.3z" />
        </g>
      );
    case 'linkedin':
      return (
        <g fill="#fff">
          <rect x="5" y="9.5" width="3" height="9.5" />
          <circle cx="6.5" cy="6.3" r="1.8" />
          <path d="M10.5 9.5h2.9v1.4c.5-.9 1.6-1.7 3.1-1.7 2.4 0 3 1.6 3 3.9V19h-3v-5.2c0-1.1-.3-1.9-1.4-1.9-1.2 0-1.6.9-1.6 1.9V19h-3z" />
        </g>
      );
    case 'facebook':
      return <path fill="#fff" d="M13.4 21v-7.2h2.4l.4-2.9h-2.8V9.1c0-.8.3-1.4 1.4-1.4H16V5.2c-.3 0-1.2-.1-2.2-.1-2.2 0-3.6 1.3-3.6 3.8v2.1H7.8v2.9h2.4V21z" />;
  }
}

export function PlatformGlyph({
  id,
  size = 32,
  className = '',
  ring = true,
}: {
  id: PlatformId;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const p = PLATFORMS.find((x) => x.id === id)!;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 ${ring ? 'ring-2 ring-[var(--click-canvas-base)]' : ''} ${className}`}
      style={{ width: size, height: size, background: p.bg }}
      title={p.name}
    >
      <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} aria-hidden="true">
        <Glyph id={id} />
      </svg>
    </span>
  );
}

// ── A stylised "footage" frame: a creator lit in a studio corner ────────────
export function StudioScene({
  className = '',
  filter,
  vignette = 0,
  subjectScale = 1,
}: {
  className?: string;
  filter?: string;
  vignette?: number;
  subjectScale?: number;
}) {
  // Unique ids: Chrome stops painting a gradient whose first definition sits
  // inside a display:none copy (the mobile/desktop duplicates of a visual).
  const uid = useId().replace(/:/g, '');
  const subject = `clk-subject-${uid}`;
  const rim = `clk-rim-${uid}`;
  return (
    <div aria-hidden="true" className={`absolute inset-0 overflow-hidden ${className}`} style={{ filter }}>
      {/* room + light */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 70% at 18% 22%, rgba(251,191,36,0.55) 0%, rgba(251,146,60,0.18) 32%, transparent 60%),' +
            'radial-gradient(90% 60% at 88% 18%, rgba(99,102,241,0.55) 0%, transparent 62%),' +
            'radial-gradient(80% 50% at 70% 95%, rgba(217,70,239,0.35) 0%, transparent 70%),' +
            'linear-gradient(180deg,#2a2350 0%,#171433 55%,#0d0b1f 100%)',
        }}
      />
      {/* shelf + bokeh */}
      <div className="absolute left-[8%] right-[52%] top-[30%] h-[2%] rounded-full bg-white/10" />
      <div className="absolute left-[12%] top-[21%] w-[9%] aspect-[3/4] rounded-[3px] bg-amber-200/30" />
      <div className="absolute left-[24%] top-[23%] w-[7%] aspect-square rounded-full bg-emerald-300/25" />
      <div className="absolute right-[14%] top-[10%] w-[14%] aspect-square rounded-full bg-indigo-300/30 blur-[6px]" />
      <div className="absolute right-[30%] top-[16%] w-[7%] aspect-square rounded-full bg-fuchsia-300/25 blur-[4px]" />
      <div className="absolute left-[60%] top-[38%] w-[5%] aspect-square rounded-full bg-sky-200/25 blur-[3px]" />
      {/* subject */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMax meet"
        className="absolute inset-x-0 bottom-0 w-full h-[78%] origin-bottom"
        style={{ transform: `scale(${subjectScale})` }}
      >
        <defs>
          <linearGradient id={subject} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b2f5c" />
            <stop offset="1" stopColor="#120f24" />
          </linearGradient>
          <linearGradient id={rim} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fbbf24" stopOpacity="0.9" />
            <stop offset="0.45" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M16 100 C16 74 32 64 50 64 C68 64 84 74 84 100 Z" fill={`url(#${subject})`} />
        <path d="M16 100 C16 74 32 64 50 64 C68 64 84 74 84 100 Z" fill="none" stroke={`url(#${rim})`} strokeWidth="1.2" />
        <rect x="44.5" y="54" width="11" height="12" rx="4" fill="#2a2147" />
        <ellipse cx="50" cy="42" rx="13" ry="15" fill={`url(#${subject})`} />
        <ellipse cx="50" cy="42" rx="13" ry="15" fill="none" stroke={`url(#${rim})`} strokeWidth="1.2" />
        <path d="M37 38 C37 26 63 24 63 36 C60 31 44 30 37 38 Z" fill="#1b1530" />
      </svg>
      {vignette > 0 && (
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${vignette}) 100%)` }}
        />
      )}
    </div>
  );
}

// ── Caption styles (names from captionStyleRegistry) ────────────────────────
export type CaptionLook = 'pill' | 'karaoke' | 'neon' | 'sticker' | 'clean';

export function CaptionWord({ word, active, look }: { word: string; active: boolean; look: CaptionLook }) {
  const base = 'inline-block font-black uppercase tracking-tight leading-none transition-all duration-200';
  if (look === 'pill') {
    return (
      <span
        className={`${base} px-[0.28em] py-[0.12em] rounded-[0.3em] ${active ? 'text-white scale-110' : 'text-white/90'}`}
        style={active ? { background: 'linear-gradient(110deg,var(--click-energy-mid),var(--click-energy-warm))' } : undefined}
      >
        {word}
      </span>
    );
  }
  if (look === 'karaoke') {
    return (
      <span className={`${base} ${active ? 'text-amber-300 scale-110' : 'text-white'}`} style={{ textShadow: '0 2px 0 #000, 0 0 2px #000' }}>
        {word}
      </span>
    );
  }
  if (look === 'neon') {
    return (
      <span
        className={`${base} ${active ? 'text-cyan-200' : 'text-cyan-100/70'}`}
        style={{ textShadow: active ? '0 0 6px #22d3ee, 0 0 14px #22d3ee, 0 0 28px #0891b2' : '0 0 4px #0891b2' }}
      >
        {word}
      </span>
    );
  }
  if (look === 'sticker') {
    return (
      <span
        className={`${base} px-[0.25em] py-[0.1em] rounded-[0.2em] ${active ? 'bg-yellow-300 text-black -rotate-3 scale-110' : 'bg-white text-black rotate-1'}`}
        style={{ boxShadow: '0 3px 0 rgba(0,0,0,0.6)' }}
      >
        {word}
      </span>
    );
  }
  return (
    <span className={`${base} normal-case font-semibold ${active ? 'text-white' : 'text-white/60'}`}>{word}</span>
  );
}

/**
 * Word-by-word caption player. Advances one word at a time like a burned-in
 * karaoke caption; under reduced motion it shows the first line, still.
 */
export function useCaptionTicker(lines: string[][], wordMs = 380, pauseTicks = 3) {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setTick((t) => t + 1), wordMs);
    return () => window.clearInterval(id);
  }, [reduce, wordMs]);
  const spans = lines.map((l) => l.length + pauseTicks);
  const total = spans.reduce((a, b) => a + b, 0);
  let t = tick % total;
  let line = 0;
  while (t >= spans[line]) {
    t -= spans[line];
    line += 1;
  }
  const word = reduce ? lines[0].length - 1 : Math.min(t, lines[line].length - 1);
  return { line: reduce ? 0 : line, word };
}

export function CaptionLine({
  words,
  activeWord,
  look,
  className = '',
}: {
  words: string[];
  activeWord: number;
  look: CaptionLook;
  className?: string;
}) {
  return (
    <span className={`flex flex-wrap justify-center gap-x-[0.38em] gap-y-[0.2em] ${className}`}>
      {words.map((w, i) => (
        <CaptionWord key={`${w}-${i}`} word={w} active={i === activeWord} look={look} />
      ))}
    </span>
  );
}

// ── Deterministic waveform (same on server + client → no hydration diff) ────
function seeded(n: number, seed = 7) {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    const envelope = 0.55 + 0.45 * Math.sin(i / 3.1) * Math.sin(i / 7.3);
    out.push(Math.max(0.12, Math.min(1, r * 0.6 + envelope * 0.55)));
  }
  return out;
}

export function Waveform({
  bars = 48,
  silences = [] as [number, number][],
  className = '',
  barClassName = 'bg-primary-400/80',
  seed = 7,
}: {
  bars?: number;
  silences?: [number, number][];
  className?: string;
  barClassName?: string;
  seed?: number;
}) {
  const values = seeded(bars, seed);
  const isSilent = (i: number) => silences.some(([a, b]) => i >= a && i < b);
  return (
    <div aria-hidden="true" className={`flex items-center gap-[2px] ${className}`}>
      {values.map((v, i) => (
        <span
          key={i}
          className={`flex-1 rounded-full ${isSilent(i) ? 'bg-rose-400/50' : barClassName}`}
          style={{ height: `${isSilent(i) ? 8 : Math.round(v * 100)}%` }}
        />
      ))}
    </div>
  );
}

// ── Score ring ───────────────────────────────────────────────────────────────
export function ScoreRing({
  value,
  size = 64,
  stroke = 6,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = value >= 70 ? '#34d399' : value >= 45 ? '#fbbf24' : '#fb7185';
  return (
    <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-black tabular-nums text-surface-900 dark:text-white" style={{ fontSize: size * 0.3 }}>
          {value}
        </span>
        {label && <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-surface-500 dark:text-slate-400">{label}</span>}
      </span>
    </span>
  );
}

/** A small, honest tag for drawn-in examples. */
export function ExampleTag({ children = 'Example' }: { children?: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-surface-900/5 dark:bg-white/10 text-surface-500 dark:text-slate-400">
      {children}
    </span>
  );
}
