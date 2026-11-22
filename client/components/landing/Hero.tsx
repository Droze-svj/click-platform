'use client';

import Link from 'next/link';
import { m, useReducedMotion, type MotionProps } from 'framer-motion';
import { ArrowRight, Scissors, Package, Send, BarChart3, RefreshCw } from 'lucide-react';
import ClickSignal from '../click/ClickSignal';
import { HeroStage } from './HeroStage';
import { PLATFORMS, PlatformGlyph } from './visuals';

// The loop the whole page is about. Each step is a real product surface:
// editor → packaging (hook check, reframe, caption, posting time) → publish →
// platform analytics ingestion → the 6-hourly learning pass.
const LOOP = [
  { icon: Scissors, label: 'Edit' },
  { icon: Package, label: 'Package' },
  { icon: Send, label: 'Publish' },
  { icon: BarChart3, label: 'Measure' },
  { icon: RefreshCw, label: 'Learn' },
];

export function Hero() {
  const reduce = useReducedMotion();
  const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
  const rise = (delay: number): MotionProps =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.8, ease: EASE },
        };

  return (
    <section className="relative pt-28 sm:pt-32 lg:pt-36 pb-14 md:pb-20 px-4 sm:px-6 overflow-hidden font-inter">
      {/* Width lives on a wrapper: globals.css sets `.grid { max-width: 100% }`, which beats max-w-* on the grid itself. */}
      <div className="w-full max-w-7xl mx-auto relative z-10">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-center gap-12 lg:gap-8 xl:gap-14">
        <div className="text-center lg:text-left space-y-7 md:space-y-8 flex flex-col items-center lg:items-start">
          <m.p
            {...rise(0)}
            className="click-beam-pill px-5 py-2 text-primary-700 dark:text-primary-200 text-[11px] md:text-xs font-bold uppercase tracking-[0.15em] max-w-full"
          >
            <ClickSignal state="idle" size="xs" />
            <span>The video editor that knows marketing</span>
          </m.p>

          <m.h1
            {...rise(0.05)}
            className="text-[2.75rem] sm:text-7xl lg:text-[4.4rem] xl:text-[5.6rem] 2xl:text-[6rem] font-black tracking-tighter leading-[0.92] text-surface-900 dark:text-white uppercase italic flex flex-col items-center lg:items-start"
          >
            <span className="block">CLICK EDITS.</span>
            <span className="text-transparent bg-clip-text pr-[0.15em] box-decoration-clone click-spectrum-text">
              YOU SHOW UP.
            </span>
          </m.h1>

          <m.p
            {...rise(0.15)}
            className="text-surface-600 dark:text-slate-300 text-lg md:text-xl font-normal max-w-2xl leading-relaxed"
          >
            Click edits your raw video, then packages it to get watched: a stronger hook, captions, the right format for each platform and a time to post. After it goes out, Click reads how the post did and uses that on your next video.
          </m.p>

          <m.ol
            {...rise(0.2)}
            aria-label="How Click works, step by step"
            className="flex flex-wrap items-center justify-center lg:justify-start gap-x-1.5 gap-y-2 text-xs md:text-[13px] font-semibold text-surface-700 dark:text-slate-200"
          >
            {LOOP.map(({ icon: Icon, label }, i) => (
              <li key={label} className="flex items-center gap-1.5">
                {i > 0 && <span className="w-3 h-px bg-gradient-to-r from-primary-500/60 to-fuchsia-400/60" aria-hidden="true" />}
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ds-surface-subtle">
                  <Icon className="w-3.5 h-3.5 text-primary-500" aria-hidden="true" />
                  {label}
                </span>
              </li>
            ))}
            <li className="sr-only">Then the next video starts from what Click learned.</li>
          </m.ol>

          <m.div {...rise(0.25)} className="w-full flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-1">
            <Link
              href="/register?plan=free"
              className="group w-full sm:w-auto px-10 py-4 rounded-full click-btn-energy text-base font-bold flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/60"
            >
              Start free
              <ArrowRight className="w-5 h-5 motion-safe:group-hover:translate-x-1 motion-safe:transition-transform" aria-hidden="true" />
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-10 py-4 rounded-full ds-surface-card text-surface-900 dark:text-white text-base font-bold hover:border-primary-500/50 transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/60"
            >
              See how it works
            </a>
          </m.div>

          <m.p {...rise(0.3)} className="text-sm text-surface-500 dark:text-slate-400 font-medium">
            14 days of Pro free, then the Free plan. No card needed.
          </m.p>
        </div>

        <HeroStage />
      </div>
      </div>

      {/* Where Click publishes — real integrations only (socialMediaService). */}
      <m.div {...rise(0.4)} className="relative z-10 max-w-5xl mx-auto mt-14 md:mt-20">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-surface-500 dark:text-slate-400 mb-5">
          Publishes straight to
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 sm:gap-x-10">
          {PLATFORMS.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 text-sm md:text-base font-bold text-surface-700 dark:text-slate-200">
              <PlatformGlyph id={p.id} size={28} ring={false} />
              {p.name}
            </li>
          ))}
        </ul>
      </m.div>
    </section>
  );
}
