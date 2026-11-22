'use client';

import { m, useReducedMotion } from 'framer-motion';
import { Check, Film, Upload, Wand2, Captions, Palette, Scissors, Clock, Hash, CalendarDays } from 'lucide-react';
import {
  CaptionLine,
  ExampleTag,
  PLATFORMS,
  PlatformGlyph,
  ScoreRing,
  StudioScene,
  Waveform,
  type PlatformId,
} from './visuals';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Shared entrance: plays each time a step's visual mounts. */
function useEnter() {
  const reduce = useReducedMotion();
  return (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.55, ease: EASE },
        };
}

const panel = 'rounded-2xl border border-surface-900/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.03]';

// ── 01 Upload ────────────────────────────────────────────────────────────────
export function UploadVisual() {
  const enter = useEnter();
  const reduce = useReducedMotion();
  const checks = ['Uploaded', 'Speech transcribed', 'Pauses and dead air found', 'Strongest moments marked'];
  return (
    <div className="h-full flex flex-col gap-4">
      <m.div
        {...enter(0)}
        className="flex-1 min-h-[150px] rounded-2xl border-2 border-dashed border-primary-500/35 bg-primary-500/[0.04] flex flex-col items-center justify-center gap-3 text-center px-6"
      >
        <span className="click-aperture-icon w-12 h-12">
          <Upload className="w-5 h-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-bold text-surface-900 dark:text-white">Drop your raw video</p>
        <p className="text-xs text-surface-500 dark:text-slate-400">A talking-head take, a tutorial, a long recording</p>
      </m.div>

      <m.div {...enter(0.15)} className={`${panel} p-4`}>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-surface-900/5 dark:bg-white/10 flex items-center justify-center">
            <Film className="w-5 h-5 text-surface-600 dark:text-slate-300" aria-hidden="true" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-surface-900 dark:text-white truncate">raw-take-03.mov</span>
              <span className="text-surface-500 dark:text-slate-400 tabular-nums">4:12</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-surface-900/10 dark:bg-white/10 overflow-hidden">
              <m.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg,var(--click-energy-mid),var(--click-energy-warm))' }}
                initial={reduce ? { width: '100%' } : { width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.6, ease: 'easeInOut', delay: 0.3 }}
              />
            </div>
          </div>
        </div>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {checks.map((c, i) => (
            <m.li
              key={c}
              {...(reduce ? {} : { initial: { opacity: 0, x: -6 }, animate: { opacity: 1, x: 0 }, transition: { delay: 1.9 + i * 0.35, duration: 0.4 } })}
              className="flex items-center gap-2 text-xs font-semibold text-surface-700 dark:text-slate-200"
            >
              <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} aria-hidden="true" />
              </span>
              {c}
            </m.li>
          ))}
        </ul>
      </m.div>
    </div>
  );
}

// ── 02 Edit ──────────────────────────────────────────────────────────────────
const CLIPS = [22, 18, 26, 14, 20];
const GAPS = [6, 5, 7, 4];

export function EditVisual() {
  const enter = useEnter();
  const reduce = useReducedMotion();
  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex gap-3 flex-1 min-h-0">
        <m.div {...enter(0)} className="relative w-[38%] max-w-[180px] aspect-[9/16] self-center rounded-xl overflow-hidden ring-1 ring-white/10 bg-black shrink-0">
          <StudioScene />
          <div className="absolute inset-x-2 bottom-[18%] text-[13px] sm:text-[15px]">
            <CaptionLine words={['FIND', 'YOUR', 'BEST', 'TAKE']} activeWord={2} look="pill" />
          </div>
        </m.div>
        <m.div {...enter(0.1)} className={`${panel} flex-1 p-3.5 flex flex-col gap-2.5 text-xs`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-surface-500 dark:text-slate-400">What Click did</p>
          {[
            { icon: Scissors, label: 'Pauses removed', value: '4 cuts', tone: 'text-rose-500' },
            { icon: Wand2, label: 'Best moments', value: 'marked', tone: 'text-amber-500' },
            { icon: Captions, label: 'Captions', value: 'word by word', tone: 'text-primary-500' },
            { icon: Palette, label: 'Grade', value: 'Warm', tone: 'text-fuchsia-500' },
          ].map(({ icon: Icon, label, value, tone }) => (
            <div key={label} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2 py-1.5 border-b border-surface-900/5 dark:border-white/5 last:border-0">
              <span className="flex items-center gap-2 font-semibold text-surface-700 dark:text-slate-200">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${tone}`} aria-hidden="true" /> {label}
              </span>
              <span className="pl-[1.375rem] sm:pl-0 whitespace-nowrap text-surface-500 dark:text-slate-400">{value}</span>
            </div>
          ))}
          <p className="hidden sm:block mt-auto text-[11px] text-surface-500 dark:text-slate-400">Every cut is a clip on the timeline: move it, trim it or put it back.</p>
        </m.div>
      </div>

      {/* timeline */}
      <m.div {...enter(0.2)} className={`${panel} p-3 space-y-2`} aria-hidden="true">
        <div className="flex justify-between text-[9px] tabular-nums text-surface-400 dark:text-slate-500 px-0.5">
          {['0:00', '0:10', '0:20', '0:30', '0:40', '0:50'].map((t) => <span key={t}>{t}</span>)}
        </div>
        <div className="relative">
          <div className="flex h-9 gap-[3px]">
            {CLIPS.map((w, i) => (
              <div key={i} className="contents">
                <div
                  className="h-full rounded-md bg-gradient-to-b from-indigo-400/80 to-indigo-600/80 ring-1 ring-white/10 relative overflow-hidden"
                  style={{ flexGrow: w, flexBasis: 0 }}
                >
                  <div className="absolute inset-0 opacity-40" style={{ background: 'repeating-linear-gradient(90deg,transparent 0 22px,rgba(255,255,255,0.18) 22px 23px)' }} />
                </div>
                {i < GAPS.length && (
                  <m.div
                    className="h-full rounded-md border border-rose-400/60"
                    style={{
                      flexBasis: 0,
                      background: 'repeating-linear-gradient(135deg,rgba(251,113,133,0.35) 0 4px,transparent 4px 8px)',
                    }}
                    initial={{ flexGrow: GAPS[i], opacity: 1 }}
                    animate={reduce ? { flexGrow: 0, opacity: 0 } : { flexGrow: 0, opacity: 0 }}
                    transition={reduce ? { duration: 0 } : { delay: 1.1 + i * 0.18, duration: 0.6, ease: EASE }}
                  />
                )}
              </div>
            ))}
          </div>
          {!reduce && (
            <m.div
              className="absolute -top-1 -bottom-1 w-[2px] bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              initial={{ left: '0%' }}
              animate={{ left: '100%' }}
              transition={{ duration: 6, ease: 'linear', repeat: Infinity, delay: 1.8 }}
            />
          )}
        </div>
        <div className="flex h-5 gap-[3px]">
          {[14, 10, 18, 8, 12, 16, 9, 13].map((w, i) => (
            <div key={i} className="h-full rounded bg-primary-500/25 border border-primary-500/40" style={{ flexGrow: w, flexBasis: 0 }} />
          ))}
        </div>
        <Waveform bars={64} className="h-7" seed={5} />
      </m.div>
    </div>
  );
}

// ── 03 Package ───────────────────────────────────────────────────────────────
export function PackageVisual() {
  const enter = useEnter();
  return (
    <div className="h-full grid grid-cols-2 gap-3 content-center">
      <m.div {...enter(0)} className={`${panel} p-4 col-span-2 flex items-center gap-4`}>
        <ScoreRing value={84} size={68} stroke={6} label="hook" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-bold text-surface-900 dark:text-white">Suggested opening</p>
            <ExampleTag />
          </div>
          <p className="text-sm text-surface-700 dark:text-slate-200 leading-snug">
            &ldquo;I cut my editing time in half with one change. Here&rsquo;s the change.&rdquo;
          </p>
        </div>
      </m.div>

      <m.div {...enter(0.12)} className={`${panel} p-4 col-span-2`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-surface-500 dark:text-slate-400 mb-3">Reframed for each platform</p>
        <div className="flex items-end justify-center gap-4 h-[120px]">
          {[
            { r: '9 / 16', h: 120, label: '9:16' },
            { r: '1 / 1', h: 92, label: '1:1' },
            { r: '16 / 9', h: 70, label: '16:9' },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-1.5">
              <div className="relative rounded-lg overflow-hidden ring-1 ring-white/15 bg-black" style={{ aspectRatio: f.r, height: f.h - 18 }}>
                <StudioScene subjectScale={f.label === '16:9' ? 0.8 : 1} />
              </div>
              <span className="text-[10px] font-bold text-surface-500 dark:text-slate-400">{f.label}</span>
            </div>
          ))}
        </div>
      </m.div>

      <m.div {...enter(0.22)} className={`${panel} p-4`}>
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-surface-500 dark:text-slate-400 mb-2">
          <Hash className="w-3 h-3" aria-hidden="true" /> Post caption
        </p>
        <div className="space-y-1.5" aria-hidden="true">
          <div className="h-2 rounded-full bg-surface-900/15 dark:bg-white/15 w-full" />
          <div className="h-2 rounded-full bg-surface-900/15 dark:bg-white/15 w-4/5" />
          <div className="h-2 rounded-full bg-primary-500/40 w-1/2" />
        </div>
      </m.div>

      <m.div {...enter(0.3)} className={`${panel} p-4`}>
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-surface-500 dark:text-slate-400 mb-1.5">
          <Clock className="w-3 h-3" aria-hidden="true" /> Post at
        </p>
        <p className="text-base font-black text-surface-900 dark:text-white">Tue · 6:30 PM</p>
        <p className="text-[10px] text-surface-500 dark:text-slate-400">typical for your niche at first</p>
      </m.div>
    </div>
  );
}

// ── 04 Publish ───────────────────────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const POSTS: { day: number; slot: number; p: PlatformId[] }[] = [
  { day: 0, slot: 1, p: ['tiktok', 'instagram'] },
  { day: 1, slot: 2, p: ['youtube', 'tiktok', 'instagram'] },
  { day: 2, slot: 0, p: ['linkedin'] },
  { day: 3, slot: 2, p: ['tiktok', 'x'] },
  { day: 4, slot: 1, p: ['instagram', 'facebook'] },
  { day: 5, slot: 2, p: ['youtube'] },
];

export function PublishVisual() {
  const enter = useEnter();
  const reduce = useReducedMotion();
  return (
    <div className="h-full flex flex-col justify-center gap-3">
      <m.div {...enter(0)} className={`${panel} p-3 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-1.5">
          {PLATFORMS.map((p) => (
            <span key={p.id} className="relative">
              <PlatformGlyph id={p.id} size={28} ring={false} />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0d0f1e] flex items-center justify-center">
                <Check className="w-2 h-2 text-white" strokeWidth={5} aria-hidden="true" />
              </span>
            </span>
          ))}
        </div>
        <span className="px-3.5 py-2 rounded-full click-btn-energy text-xs font-bold">Schedule</span>
      </m.div>

      <m.div {...enter(0.12)} className={`${panel} p-3`}>
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-surface-500 dark:text-slate-400 mb-2.5">
          <CalendarDays className="w-3 h-3" aria-hidden="true" /> This week
        </p>
        <div className="grid grid-cols-7 gap-1.5" aria-hidden="true">
          {DAYS.map((d) => (
            <span key={d} className="text-center text-[9px] font-bold text-surface-500 dark:text-slate-400">{d}</span>
          ))}
          {[0, 1, 2].map((slot) =>
            DAYS.map((_, day) => {
              const post = POSTS.find((x) => x.day === day && x.slot === slot);
              const idx = post ? POSTS.indexOf(post) : -1;
              return (
                <div key={`${slot}-${day}`} className="h-14 sm:h-[4.75rem] rounded-lg bg-surface-900/[0.04] dark:bg-white/[0.03] border border-surface-900/5 dark:border-white/5 p-1">
                  {post && (
                    <m.div
                      {...(reduce ? {} : { initial: { opacity: 0, scale: 0.6, y: -10 }, animate: { opacity: 1, scale: 1, y: 0 }, transition: { delay: 0.4 + idx * 0.16, type: 'spring', stiffness: 380, damping: 22 } })}
                      className="h-full rounded-md bg-gradient-to-br from-primary-500/30 to-fuchsia-500/25 border border-primary-400/40 flex flex-col justify-between p-1"
                    >
                      <span className="h-1 w-3/4 rounded-full bg-white/50" />
                      <span className="flex -space-x-1">
                        {post.p.map((id) => (
                          <PlatformGlyph key={id} id={id} size={13} />
                        ))}
                      </span>
                    </m.div>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </m.div>
    </div>
  );
}
