import { Scissors, Send, BarChart3, RefreshCw, Anchor, Palette, Clock, ArrowRight, type LucideIcon } from 'lucide-react';

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

const LOOP: { icon: LucideIcon; label: string; detail: string }[] = [
  { icon: Scissors, label: 'Edit', detail: 'Cut, captioned and packaged' },
  { icon: Send, label: 'Publish', detail: 'Posted through Click' },
  { icon: BarChart3, label: 'Measure', detail: 'Views, watch time, engagement' },
  { icon: RefreshCw, label: 'Learn', detail: 'Next edit starts from this' },
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

export function LearningLoop() {
  return (
    <section id="learning-loop" aria-labelledby="loop-heading" className="py-16 md:py-24 px-4 sm:px-6 font-inter scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-500 mb-4">After you post</p>
          <h2 id="loop-heading" className="text-3xl md:text-5xl font-black tracking-tighter leading-tight text-balance text-surface-900 dark:text-white mb-4">
            Every post makes the next one better
          </h2>
          <p className="text-surface-600 dark:text-slate-300 text-base md:text-lg leading-relaxed">
            Most editors stop at export. Click keeps going: it pulls each post&apos;s results from the platform, works out what helped and what didn&apos;t, and carries that into your next video.
          </p>
        </div>

        <ol
          aria-label="The learning loop"
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10 md:mb-14"
        >
          {LOOP.map(({ icon: Icon, label, detail }, i) => (
            <li
              key={label}
              className="relative rounded-2xl border-2 border-primary-500/20 bg-primary-500/[0.06] p-4 md:p-5 flex items-center gap-3"
            >
              <span className="w-10 h-10 rounded-xl bg-primary-500/15 flex items-center justify-center text-primary-500 shrink-0">
                <Icon className="w-5 h-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm md:text-base font-black text-surface-900 dark:text-white">{label}</span>
                <span className="block text-xs text-surface-600 dark:text-slate-400 leading-snug">{detail}</span>
              </span>
              {i < LOOP.length - 1 && (
                <ArrowRight
                  className="hidden md:block absolute -right-[1.05rem] top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400 z-10"
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {LESSONS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-3xl bg-surface-card border-2 border-surface-100 dark:border-white/5 p-6 md:p-7">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-500 shrink-0">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-black tracking-tight leading-snug text-surface-900 dark:text-white">{title}</h3>
              </div>
              <p className="text-sm md:text-[15px] text-surface-600 dark:text-slate-300 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 max-w-3xl mx-auto text-center text-sm text-surface-500 dark:text-slate-400 leading-relaxed">
          Click learns from the posts it publishes for you and from the numbers you add for videos you posted yourself, so it needs a few posts before the suggestions become personal. The detailed view of which hooks and styles worked is part of Pro and included in the 14-day trial.
        </p>
      </div>
    </section>
  );
}
