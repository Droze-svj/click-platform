'use client';

import { m } from 'framer-motion';
import { Brain, Radar, RefreshCw, Clock, Sparkles } from 'lucide-react';

export function IntelligenceShowcase() {
  return (
    <section id="intelligence" className="py-24 md:py-32 px-6 bg-surface-page relative overflow-hidden font-inter border-y-2 border-surface-100 dark:border-white/5">
      {/* High-Fidelity Ambient Backgrounds */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none opacity-40">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] bg-primary-600/10 blur-[180px] rounded-full animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-fuchsia-600/10 blur-[160px] rounded-full" />
      </div>

      <div className="max-w-[1900px] mx-auto relative z-10">
        <div className="text-center mb-32 space-y-8">
           <m.div
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             className="inline-flex items-center gap-4 px-6 py-2 rounded-full bg-primary-500/10 border-2 border-primary-500/20 text-primary-500 text-[10px] font-black uppercase tracking-[0.5em] italic shadow-xl"
           >
             <Brain size={14} className="animate-pulse" />
             Why Click feels different
           </m.div>

          <h2 className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl break-words font-black tracking-tighter leading-none text-surface-900 dark:text-white uppercase italic px-4">
            CLICK STUDIED YOUR NICHE <br className="hidden md:block" /><span className="text-transparent bg-clip-text pr-[0.15em] box-decoration-clone bg-gradient-to-r from-primary-400 to-fuchsia-400">BEFORE YOU SIGNED UP.</span>
          </h2>

          <p className="text-surface-600 dark:text-slate-300 max-w-4xl mx-auto text-lg sm:text-xl md:text-2xl leading-relaxed px-6">
            Most AI editors give every creator the same generic clip. Click ships with playbooks for the niches you actually live in — and four engines that quietly tune every cut to YOUR audience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-[auto_auto] gap-8 lg:gap-12 max-w-[1800px] mx-auto">
          {/* Niche-aware AI — large left cell */}
          <m.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="bg-surface-card backdrop-blur-[60px] rounded-[4rem] p-12 md:row-span-2 md:col-span-2 group border-2 border-surface-100 dark:border-white/5 hover:border-primary-500/30 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)] transition-all duration-700 relative overflow-hidden animate-cinematic-reveal"
          >
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary-500/10 blur-[120px] rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-1000" />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between mb-10">
                  <div className="w-16 h-16 rounded-2xl bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center text-primary-500 shadow-2xl group-hover:rotate-12 transition-transform duration-500">
                    <Brain className="w-8 h-8" aria-hidden="true" />
                  </div>
                  <div className="px-4 md:px-6 py-2 rounded-xl bg-surface-page dark:bg-black/40 border-2 border-surface-100 dark:border-white/5 opacity-40 group-hover:opacity-100 transition-all">
                     <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] italic text-surface-400 dark:text-slate-600">Step 1</span>
                  </div>
                </div>
                <h3 className="text-4xl md:text-5xl font-black mb-6 tracking-tighter uppercase italic text-surface-900 dark:text-white leading-none">Speaks your niche</h3>
                <p className="text-surface-600 dark:text-slate-300 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
                  A finance creator gets dollar-anchored hooks. A fitness creator gets transformation framing. A gamer gets pattern-break edits. Every hook, caption, and cut is written through your niche&apos;s playbook — never the generic AI mush.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-4 pt-10 border-t-2 border-surface-100 dark:border-white/5">
                {['FINANCE', 'FITNESS', 'LIFESTYLE', 'TECH', 'BEAUTY', 'GAMING', 'BUSINESS', 'FOOD'].map((n) => (
                  <span
                    key={n}
                    className="px-6 py-2 rounded-full bg-surface-page dark:bg-black/40 border-2 border-surface-100 dark:border-white/5 text-[10px] font-black uppercase tracking-[0.4em] italic text-surface-400 dark:text-slate-600 hover:text-primary-500 hover:border-primary-500/30 transition-all magnetic-hover"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          </m.div>

          {/* Trend radar — top right */}
          <m.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0.1, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="bg-surface-card backdrop-blur-[40px] rounded-[3.5rem] p-10 group border-2 border-surface-100 dark:border-white/5 hover:border-primary-500/30 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)] transition-all duration-700 relative overflow-hidden animate-cinematic-reveal"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/10 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="w-14 h-14 rounded-xl bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center text-primary-500 shadow-2xl group-hover:rotate-12 transition-transform duration-500">
                  <Radar className="w-7 h-7" aria-hidden="true" />
                </div>
              </div>
              <h3 className="text-2xl md:text-3xl font-black mb-4 tracking-tighter uppercase italic text-surface-900 dark:text-white leading-none">Watches the trends</h3>
              <p className="text-surface-600 dark:text-slate-300 text-base leading-relaxed">
                Hooks, sounds, formats, hashtags — Click regularly pulls what&apos;s trending and brings it into your editor, so you spend less time guessing what to post.
              </p>
            </div>
          </m.div>

          {/* Learning loop — bottom right */}
          <m.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="bg-surface-card backdrop-blur-[40px] rounded-[3.5rem] p-10 group border-2 border-surface-100 dark:border-white/5 hover:border-primary-500/30 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)] transition-all duration-700 relative overflow-hidden animate-cinematic-reveal"
          >
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-emerald-500/10 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-2xl group-hover:rotate-12 transition-transform duration-500">
                  <RefreshCw className="w-7 h-7" aria-hidden="true" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 italic">Always on</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-black mb-4 tracking-tighter uppercase italic text-surface-900 dark:text-white leading-none">Remembers what worked</h3>
              <p className="text-surface-600 dark:text-slate-300 text-base leading-relaxed">
                The hook that hit. The font that landed. The slot that popped. Click logs every win and tilts tomorrow&apos;s suggestions toward it — automatically, while you sleep.
              </p>
            </div>
          </m.div>

          {/* Posting window predictor — full width bottom */}
          <m.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="bg-surface-card backdrop-blur-[60px] rounded-[4rem] p-12 md:col-span-3 group border-2 border-surface-100 dark:border-white/5 hover:border-primary-500/30 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)] transition-all duration-700 relative overflow-hidden animate-cinematic-reveal"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-500/5 via-fuchsia-500/5 to-emerald-500/5 blur-3xl opacity-30 group-hover:opacity-60 transition-opacity duration-1000" aria-hidden="true" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-12">
              <div className="flex items-center gap-8 md:flex-1">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center text-amber-500 shadow-2xl group-hover:rotate-12 transition-transform duration-500 flex-shrink-0">
                  <Clock className="w-8 h-8" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-3xl font-black tracking-tighter uppercase italic text-surface-900 dark:text-white leading-none mb-4">Knows when YOU pop</h3>
                  <p className="text-surface-600 dark:text-slate-300 text-lg leading-relaxed">
                    Generic &quot;best times to post&quot; charts don&apos;t know your audience. Click looks at platform peak times and your own engagement history to suggest when to post.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                <span className="w-full text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 italic">Example only</span>
                {[
                  { label: 'TikTok', time: '7:42 PM' },
                  { label: 'Reels', time: '8:15 PM' },
                  { label: 'Shorts', time: '6:30 PM' },
                ].map((s) => (
                  <div key={s.label} className="px-8 py-4 rounded-2xl bg-surface-page dark:bg-black/40 border-2 border-surface-100 dark:border-white/5 flex items-center gap-6 shadow-xl hover:border-primary-500/30 transition-all magnetic-hover group/pill">
                    <Sparkles className="w-5 h-5 text-amber-500 group-hover/pill:rotate-12 transition-transform" aria-hidden="true" />
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.4em] text-surface-400 dark:text-slate-600 italic leading-none mb-2">{s.label}</div>
                      <div className="text-xl font-black tabular-nums italic text-surface-900 dark:text-white leading-none">{s.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </m.div>
        </div>
      </div>
    </section>
  );
}
