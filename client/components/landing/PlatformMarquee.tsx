'use client';

const PLATFORMS = ['TIKTOK', 'YOUTUBE', 'INSTAGRAM', 'X · TWITTER', 'LINKEDIN', 'FACEBOOK', 'THREADS', 'PINTEREST'];

/**
 * Auto-scrolling platform marquee. Pure CSS, no JS scheduling, GPU-cheap.
 * Honors prefers-reduced-motion via the `motion-safe:` Tailwind variant.
 */
export function PlatformMarquee() {
  // Render two copies for the seamless loop.
  const items = [...PLATFORMS, ...PLATFORMS];

  return (
    <section className="py-12 px-6 border-y border-white/5 bg-[#020202]" aria-label="Supported platforms">
      <div className="max-w-7xl mx-auto overflow-hidden relative">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.4em] text-slate-600 mb-6">
          Publishes natively to
        </p>
        <div className="flex motion-safe:animate-[marquee_30s_linear_infinite] gap-16 whitespace-nowrap" aria-hidden="true">
          {items.map((p, i) => (
            <span
              key={`${p}-${i}`}
              className="text-2xl md:text-3xl font-black tracking-tighter text-slate-700 hover:text-slate-300 transition-colors flex-shrink-0"
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
