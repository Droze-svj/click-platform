import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function FinalCTA() {
  return (
    <section aria-labelledby="final-cta-heading" className="py-20 md:py-28 px-4 sm:px-6 relative font-inter">
      <div className="relative max-w-6xl w-full mx-auto overflow-hidden click-vessel !rounded-[2rem] md:!rounded-[2.5rem] px-6 py-16 sm:px-12 md:py-24 text-center isolate">
        {/* aperture: concentric rings + a slow spectrum sweep */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
          <div className="absolute w-[60%] h-[80%] bg-primary-600/25 blur-[120px] rounded-full" />
          {[900, 680, 460].map((size, i) => (
            <div
              key={size}
              className="absolute rounded-full border border-surface-900/[0.06] dark:border-white/[0.06]"
              style={{ width: size, height: size }}
            >
              <div
                className={`absolute inset-[-1px] rounded-full ${i % 2 ? 'motion-safe:animate-[spin_26s_linear_infinite_reverse]' : 'motion-safe:animate-[spin_34s_linear_infinite]'}`}
                style={{
                  background: `conic-gradient(from ${i * 120}deg, transparent 0deg, var(--click-energy-lead) 40deg, transparent 90deg)`,
                  WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1px))',
                  mask: 'radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1px))',
                }}
              />
            </div>
          ))}
        </div>

        <h2
          id="final-cta-heading"
          className="text-[2.6rem] sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter uppercase italic leading-[0.92] text-surface-900 dark:text-white mb-7"
        >
          Start with your
          <br />
          <span className="text-transparent bg-clip-text pr-[0.15em] box-decoration-clone click-spectrum-text">next video.</span>
        </h2>
        <p className="text-surface-600 dark:text-slate-300 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
          Upload it, let Click edit and package it, and post it. Then see what Click takes from the results into the one after.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/register?plan=free"
            className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-5 rounded-full click-btn-energy text-base md:text-lg font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/60"
          >
            Start free
            <ArrowRight className="w-5 h-5 motion-safe:group-hover:translate-x-1 motion-safe:transition-transform" aria-hidden="true" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center px-10 py-5 rounded-full ds-surface-card text-surface-900 dark:text-white text-base md:text-lg font-bold hover:border-primary-500/50 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/60"
          >
            Log in
          </Link>
        </div>

        <p className="mt-7 text-sm text-surface-500 dark:text-slate-400 font-medium">
          14 days of Pro free · No card needed · Cancel any time
        </p>
      </div>
    </section>
  );
}
