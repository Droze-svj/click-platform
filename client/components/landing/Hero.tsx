'use client';

import Link from 'next/link';
import { m, useReducedMotion, type MotionProps } from 'framer-motion';
import { ArrowRight, Scissors, Package, Send, BarChart3, RefreshCw } from 'lucide-react';

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
    <section className="relative pt-28 sm:pt-32 md:pt-40 pb-16 md:pb-24 px-4 sm:px-6 flex flex-col items-center overflow-hidden font-inter">
      <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-[-5%] left-[-10%] w-[60%] h-[60%] bg-primary-600/15 blur-[160px] rounded-full opacity-60" />
        <div className="absolute top-[20%] right-[-10%] w-[50%] h-[60%] bg-fuchsia-600/10 blur-[180px] rounded-full opacity-40" />
      </div>

      <div className="w-full max-w-6xl mx-auto text-center space-y-7 md:space-y-9 relative z-10">
        <m.p
          {...rise(0)}
          className="inline-flex items-center px-5 py-2 rounded-full bg-primary-500/10 border border-primary-500/25 text-primary-600 dark:text-primary-300 text-[11px] md:text-xs font-bold uppercase tracking-[0.15em] max-w-full"
        >
          The video editor that knows marketing
        </m.p>

        <m.h1
          {...rise(0.05)}
          className="text-[2.75rem] sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.92] text-surface-900 dark:text-white uppercase italic flex flex-col items-center"
        >
          <span className="block">CLICK EDITS.</span>
          <span className="text-transparent bg-clip-text pr-[0.15em] box-decoration-clone bg-gradient-to-r from-primary-400 via-surface-900 to-fuchsia-500 dark:via-white dark:to-fuchsia-400">
            YOU SHOW UP.
          </span>
        </m.h1>

        <m.p
          {...rise(0.15)}
          className="text-surface-600 dark:text-slate-300 text-lg md:text-2xl font-normal max-w-3xl mx-auto leading-relaxed"
        >
          Click edits your raw video, then packages it to get watched: a stronger hook, captions, the right format for each platform and a time to post. After it goes out, Click reads how the post did and uses that on your next video.
        </m.p>

        <m.ol
          {...rise(0.2)}
          aria-label="How Click works, step by step"
          className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-xs md:text-sm font-semibold text-surface-700 dark:text-slate-200"
        >
          {LOOP.map(({ icon: Icon, label }, i) => (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="w-3.5 h-3.5 text-surface-400 dark:text-slate-500" aria-hidden="true" />}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-card border border-surface-200 dark:border-white/10">
                <Icon className="w-3.5 h-3.5 text-primary-500" aria-hidden="true" />
                {label}
              </span>
            </li>
          ))}
          <li className="sr-only">Then the next video starts from what Click learned.</li>
        </m.ol>

        <m.div {...rise(0.25)} className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 pt-1">
          <Link
            href="/register?plan=free"
            className="group w-full sm:w-auto px-10 py-4 rounded-full bg-surface-900 dark:bg-white text-white dark:text-black text-base font-bold transition-colors shadow-[0_30px_60px_rgba(0,0,0,0.45)] hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white dark:hover:text-white flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/60"
          >
            Start free
            <ArrowRight className="w-5 h-5 motion-safe:group-hover:translate-x-1 motion-safe:transition-transform" aria-hidden="true" />
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-10 py-4 rounded-full bg-surface-card border-2 border-surface-200 dark:border-white/10 text-surface-900 dark:text-white text-base font-bold hover:border-primary-500/50 transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/60"
          >
            See how it works
          </a>
        </m.div>

        <m.p {...rise(0.3)} className="text-sm text-surface-500 dark:text-slate-400 font-medium">
          14 days of Pro free, then the Free plan. No card needed.
        </m.p>
      </div>
    </section>
  );
}
