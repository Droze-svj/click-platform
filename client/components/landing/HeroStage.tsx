'use client';

import { m, useReducedMotion } from 'framer-motion';
import { Check, Clock, Scissors, Sparkles } from 'lucide-react';
import {
  CaptionLine,
  ExampleTag,
  PLATFORMS,
  PlatformGlyph,
  ScoreRing,
  StudioScene,
  Waveform,
  useCaptionTicker,
} from './visuals';

const SCRIPT = [
  ['STOP', 'EDITING', 'FOR', 'HOURS.'],
  ['CLICK', 'CUTS', 'THE', 'DEAD', 'AIR.'],
  ['YOU', 'JUST', 'SHOW', 'UP.'],
];

// Illustrative posting-time curve (engagement by hour). Not anyone's data.
const HOURS = [18, 22, 30, 26, 34, 48, 62, 58, 72, 96, 80, 54];

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function Float({
  children,
  className,
  delay,
  drift = 8,
  period = 7,
}: {
  children: React.ReactNode;
  className: string;
  delay: number;
  drift?: number;
  period?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, scale: 0.92, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: [0, -drift, 0] }}
      transition={{
        opacity: { delay, duration: 0.7, ease: EASE },
        scale: { delay, duration: 0.7, ease: EASE },
        y: { delay: delay + 0.7, duration: period, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      {children}
    </m.div>
  );
}

const card =
  'ds-surface-elevated !rounded-2xl p-3 sm:p-3.5 text-left shadow-[0_24px_60px_-20px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)]';

/**
 * The hero's product stage: a phone playing a Click edit (word-by-word burned-in
 * captions over a stylised scene), surrounded by the packaging Click adds.
 * Drawn in code and labelled as an illustration.
 */
export function HeroStage() {
  const reduce = useReducedMotion();
  const { line, word } = useCaptionTicker(SCRIPT);
  const progress = ((line + (word + 1) / SCRIPT[line].length) / SCRIPT.length) * 100;

  return (
    <figure
      aria-label="Illustration of a video edited and packaged in Click"
      className="relative w-full max-w-[560px] mx-auto h-[470px] sm:h-[560px] select-none"
    >
      {/* aperture ring behind the phone */}
      <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[420px] h-[420px] sm:w-[520px] sm:h-[520px] rounded-full opacity-70 motion-safe:animate-[spin_40s_linear_infinite]"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, var(--click-energy-lead) 60deg, transparent 120deg, transparent 200deg, var(--click-energy-warm) 250deg, transparent 300deg)',
            WebkitMask: 'radial-gradient(circle, transparent 64%, #000 64.5%, #000 65.2%, transparent 65.7%)',
            mask: 'radial-gradient(circle, transparent 64%, #000 64.5%, #000 65.2%, transparent 65.7%)',
          }}
        />
        <div className="absolute w-[300px] h-[300px] sm:w-[380px] sm:h-[380px] rounded-full bg-primary-500/20 blur-[90px]" />
      </div>

      {/* phone */}
      <m.div
        initial={reduce ? false : { opacity: 0, y: 40, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
        className="absolute left-1/2 top-1/2 -ml-[110px] -mt-[196px] sm:-ml-[132px] sm:-mt-[236px] w-[220px] sm:w-[264px] aspect-[9/16] rounded-[2.2rem] sm:rounded-[2.6rem] p-[7px] bg-gradient-to-b from-slate-700 via-slate-900 to-black shadow-[0_50px_120px_-30px_rgba(79,70,229,0.55),0_30px_60px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
      >
        <div className="relative w-full h-full rounded-[1.8rem] sm:rounded-[2.15rem] overflow-hidden bg-black">
          <StudioScene />
          {/* top chrome */}
          <div className="absolute top-0 inset-x-0 p-3 sm:p-3.5 space-y-2.5">
            <div className="h-[3px] rounded-full bg-white/25 overflow-hidden">
              <div className="h-full bg-white rounded-full transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 to-fuchsia-500 ring-1 ring-white/40" />
                <span className="text-[10px] font-bold text-white/90">@yourchannel</span>
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-black/40 backdrop-blur text-[9px] font-bold text-white/90 tracking-wider">9:16</span>
            </div>
          </div>
          {/* captions */}
          <div className="absolute inset-x-3 bottom-[22%] text-[19px] sm:text-[23px]" aria-hidden="true">
            <CaptionLine words={SCRIPT[line]} activeWord={word} look="pill" />
          </div>
          {/* scrubber */}
          <div className="absolute bottom-0 inset-x-0 p-3 sm:p-3.5 pt-6 bg-gradient-to-t from-black/70 to-transparent">
            <Waveform bars={36} silences={[[9, 12], [24, 27]]} className="h-6" barClassName="bg-white/70" seed={11} />
          </div>
        </div>
      </m.div>

      {/* hook check */}
      <Float delay={0.55} className="absolute left-0 sm:left-[-3%] top-[2%] sm:top-[6%] w-[176px] sm:w-[200px] z-10">
        <div className={card}>
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-surface-900 dark:text-white">
              <Sparkles className="w-3.5 h-3.5 text-primary-500" aria-hidden="true" /> Hook check
            </span>
            <ExampleTag />
          </div>
          <div className="flex items-center gap-2.5">
            <ScoreRing value={86} size={46} stroke={5} />
            <p className="text-[11px] leading-snug text-surface-600 dark:text-slate-300">
              Names the result in the first two seconds.
            </p>
          </div>
        </div>
      </Float>

      {/* posting time */}
      <Float delay={0.75} period={8} drift={10} className="hidden sm:block absolute right-[-3%] top-[24%] w-[180px] z-10">
        <div className={card}>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-surface-900 dark:text-white mb-1">
            <Clock className="w-3.5 h-3.5 text-sky-500" aria-hidden="true" /> Suggested time
          </div>
          <p className="text-base font-black tracking-tight text-surface-900 dark:text-white">Tue · 6:30 PM</p>
          <div aria-hidden="true" className="mt-2 flex items-end gap-[3px] h-9">
            {HOURS.map((h, i) => (
              <span
                key={i}
                className={`flex-1 rounded-sm ${i === 9 ? 'bg-gradient-to-t from-primary-500 to-fuchsia-400' : 'bg-surface-900/10 dark:bg-white/15'}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </Float>

      {/* silences cut */}
      <Float delay={0.95} period={9} drift={7} className="hidden sm:block absolute left-[-3%] bottom-[1%] w-[196px] z-10">
        <div className={card}>
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-surface-900 dark:text-white">
              <Scissors className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" /> Dead air cut
            </span>
            <ExampleTag />
          </div>
          <Waveform bars={30} silences={[[6, 9], [17, 20], [25, 27]]} className="h-7" />
          <p className="mt-1.5 text-[11px] text-surface-600 dark:text-slate-300">3 pauses removed, every cut still editable</p>
        </div>
      </Float>

      {/* platforms */}
      <Float delay={1.15} period={7.5} className="absolute right-0 sm:right-[-3%] bottom-[2%] sm:bottom-[10%] w-[196px] sm:w-[210px] z-10">
        <div className={card}>
          <div className="flex items-center -space-x-1.5 mb-2">
            {PLATFORMS.map((p) => (
              <PlatformGlyph key={p.id} id={p.id} size={26} />
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-surface-900 dark:text-white">
            <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} aria-hidden="true" />
            </span>
            Scheduled from one calendar
          </p>
        </div>
      </Float>

      <figcaption className="sr-only">
        An illustration: a vertical video with word-by-word captions, a hook check, a suggested posting time, removed pauses and the six platforms Click publishes to.
      </figcaption>
    </figure>
  );
}
