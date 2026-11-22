import { Scissors, Send, BarChart3, RefreshCw, Anchor, Palette, Clock, type LucideIcon } from 'lucide-react';
import ClickSignal from '../click/ClickSignal';

/**
 * The differentiator: what Click learns from a creator's own results.
 *
 * Each claim maps to shipped code, and is worded to stay inside it:
 *  - platform analytics land on each published ScheduledPost; every 6 hours
 *    performanceLearningCron drains them through
 *    creatorPerformanceService.ingestPostPerformance, which scores the hooks,
 *    caption styles, fonts, animations, grades and transitions that were on
 *    screen by retention vs the niche/platform benchmark (UserStyleProfile);
 *  - the editor reads /style-profile/insights and ranks suggestions by it;
 *  - optimalPostingTimeService needs >= 8 posts before it personalises posting
 *    times and falls back to niche defaults before that;
 *  - the analytics view (creator_analytics + hook_attribution) is a Pro gate.
 */

// Clockwise from the top of the orbit.
const LOOP: { icon: LucideIcon; label: string; detail: string; pos: string }[] = [
  { icon: Scissors, label: 'Edit', detail: 'Cut, captioned and packaged', pos: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2' },
  { icon: Send, label: 'Publish', detail: 'Posted through Click', pos: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2' },
  { icon: BarChart3, label: 'Measure', detail: 'Views, watch time, engagement', pos: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2' },
  { icon: RefreshCw, label: 'Learn', detail: 'Next edit starts from this', pos: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2' },
];

const LESSONS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Anchor,
    title: 'Which hooks keep people watching',
    body: 'Every hook style you use is scored on how well that post held viewers, compared with what is normal for your niche and platform. The ones that worked are suggested first next time.',
  },
  {
    icon: Palette,
    title: 'Which styles your audience responds to',
    body: 'Caption styles, fonts, color grades and transitions are scored the same way, so the editor leads with what has worked for you instead of a generic default.',
  },
  {
    icon: Clock,
    title: 'When your audience is scrolling',
    body: 'After about eight posts, posting-time suggestions come from your own engagement by hour and day. Until then Click uses typical times for your niche.',
  },
];

function Orbit() {
  return (
    <div className="relative w-full max-w-[440px] mx-auto aspect-square">
      {/* track + travelling pulse */}
      <svg viewBox="0 0 100 100" className="absolute inset-[11%] w-[78%] h-[78%] overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="loop-pulse" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--click-energy-lead)" />
            <stop offset="1" stopColor="var(--click-energy-warm)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.6" strokeDasharray="1 2" className="text-surface-900 dark:text-white" />
        <circle
          cx="50"
          cy="50"
          r="50"
          fill="none"
          stroke="url(#loop-pulse)"
          strokeWidth="1.4"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="18 82"
          className="origin-center -rotate-90 motion-safe:animate-[spin_8s_linear_infinite]"
          style={{ transformBox: 'fill-box' }}
        />
      </svg>

      {/* centre: the style profile everything feeds */}
      <div className="!absolute inset-[30%] click-vessel !rounded-full flex flex-col items-center justify-center text-center p-3">
        <span className="hidden sm:block mb-2"><ClickSignal state="thinking" size="sm" /></span>
        <span className="text-[11px] sm:text-xs md:text-sm font-black text-surface-900 dark:text-white leading-tight">Your style profile</span>
        <span className="hidden sm:block text-[10px] md:text-[11px] text-surface-500 dark:text-slate-400 leading-tight mt-0.5">hooks · styles · times</span>
      </div>

      <ol aria-label="The learning loop" className="absolute inset-[11%]">
        {LOOP.map(({ icon: Icon, label, detail, pos }) => (
          <li key={label} className={`absolute ${pos} w-[96px] sm:w-[150px] flex flex-col items-center text-center`}>
            {/* opaque backdrop: the travelling pulse passes behind the node */}
            <span className="rounded-[1.125rem] bg-[var(--click-canvas-base)]">
              <span className="click-aperture-icon w-11 h-11 sm:w-12 sm:h-12">
                <Icon className="w-5 h-5" aria-hidden="true" />
              </span>
            </span>
            <span className="mt-1.5 text-sm font-black text-surface-900 dark:text-white">{label}</span>
            <span className="hidden sm:block text-[11px] text-surface-600 dark:text-slate-400 leading-snug">{detail}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function LearningLoop() {
  return (
    <section id="learning-loop" aria-labelledby="loop-heading" className="py-20 md:py-28 px-4 sm:px-6 font-inter scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-16 items-center">
          <header className="lg:col-start-1 lg:row-start-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-500 mb-4 text-center lg:text-left">After you post</p>
            <h2 id="loop-heading" className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.98] text-balance text-surface-900 dark:text-white mb-5 text-center lg:text-left">
              Every post makes the next one better
            </h2>
            <p className="text-surface-600 dark:text-slate-300 text-base md:text-lg leading-relaxed mb-10 text-center lg:text-left max-w-2xl mx-auto lg:mx-0">
              Most editors stop at export. Click keeps going: it pulls each post&apos;s results from the platform, works out what helped and what didn&apos;t, and carries that into your next video.
            </p>
          </header>

          <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 px-8 sm:px-20 lg:px-12 mb-14 lg:mb-0">
            <Orbit />
          </div>

          <div className="lg:col-start-1 lg:row-start-2 divide-y divide-surface-900/10 dark:divide-white/10 border-y border-surface-900/10 dark:border-white/10">
            {LESSONS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4 py-5">
                <span className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-500 shrink-0">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-lg font-black tracking-tight leading-snug text-surface-900 dark:text-white mb-1">{title}</h3>
                  <p className="text-sm md:text-[15px] text-surface-600 dark:text-slate-300 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-10 max-w-3xl mx-auto text-center text-sm text-surface-500 dark:text-slate-400 leading-relaxed">
          Click learns from the posts it publishes for you and from the numbers you add for videos you posted yourself, so it needs a few posts before the suggestions become personal. The detailed view of which hooks and styles worked is part of Pro and included in the 14-day trial.
        </p>
      </div>
    </section>
  );
}
