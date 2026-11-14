import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function FinalCTA() {
  return (
    <section aria-labelledby="final-cta-heading" className="py-20 md:py-28 px-4 sm:px-6 relative font-inter">
      <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-primary-600/15 blur-[160px] rounded-full" />
      </div>
      <div className="max-w-3xl w-full mx-auto text-center">
        <h2
          id="final-cta-heading"
          className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter uppercase italic leading-[0.95] text-surface-900 dark:text-white mb-6"
        >
          Start with your <span className="text-transparent bg-clip-text pr-[0.15em] box-decoration-clone bg-gradient-to-r from-primary-400 to-fuchsia-400">next video.</span>
        </h2>
        <p className="text-surface-600 dark:text-slate-300 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
          Upload it, let Click edit and package it, and post it. Then see what Click takes from the results into the one after.
        </p>

        <Link
          href="/register?plan=free"
          className="group inline-flex items-center justify-center gap-3 px-10 py-5 rounded-full bg-surface-900 text-white dark:bg-white dark:text-black text-base md:text-lg font-bold hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white dark:hover:text-white transition-colors shadow-[0_30px_60px_rgba(0,0,0,0.4)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/60"
        >
          Start free
          <ArrowRight className="w-5 h-5 motion-safe:group-hover:translate-x-1 motion-safe:transition-transform" aria-hidden="true" />
        </Link>

        <p className="mt-6 text-sm text-surface-500 dark:text-slate-400 font-medium">
          14 days of Pro free · No card needed · Cancel any time
        </p>
      </div>
    </section>
  );
}
