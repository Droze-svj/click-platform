import { Upload, Scissors, Package, Send, type LucideIcon } from 'lucide-react';

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
}

// Every line maps to shipped code: silence removal + highlight detection
// (advancedVideoEditingService), captions (whisperService), hook analysis
// (routes/video/hook-analysis), smart reframe (smartReframeService), posting
// time (optimalPostingTimeService) and publishing (socialMediaService:
// TikTok, Instagram, YouTube, X, LinkedIn, Facebook Pages).
const STEPS: Step[] = [
  {
    icon: Upload,
    title: 'Upload',
    body: 'Drop in a raw recording: a talking-head take, a tutorial or a long video you want cut into shorts.',
  },
  {
    icon: Scissors,
    title: 'Edit',
    body: 'Click removes silences and dead air, finds the strongest moments and adds captions. It all lands in a full timeline editor, so you can change any cut.',
  },
  {
    icon: Package,
    title: 'Package',
    body: 'Click scores the hook and suggests stronger openings, reframes the video to 9:16, 1:1 or 16:9, writes the post caption and suggests when to post.',
  },
  {
    icon: Send,
    title: 'Publish',
    body: 'Post now or schedule from one calendar to TikTok, Instagram, YouTube, X, LinkedIn and Facebook Pages.',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="py-16 md:py-24 px-4 sm:px-6 border-y-2 border-surface-100 dark:border-white/5 font-inter scroll-mt-20"
    >
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-500 mb-4">How it works</p>
          <h2 id="how-heading" className="text-3xl md:text-5xl font-black tracking-tighter leading-tight text-balance text-surface-900 dark:text-white mb-4">
            From raw video to posted, in one place
          </h2>
          <p className="text-surface-600 dark:text-slate-300 text-base md:text-lg leading-relaxed">
            Editing and marketing usually happen in different tools. Click does both, so the video and the way it is presented are planned together.
          </p>
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              className="rounded-3xl bg-surface-card border-2 border-surface-100 dark:border-white/5 p-6 md:p-7 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <span className="w-11 h-11 rounded-2xl bg-primary-500/10 border border-primary-500/25 flex items-center justify-center text-primary-500">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-black tabular-nums text-surface-400 dark:text-slate-500" aria-hidden="true">
                  0{i + 1}
                </span>
              </div>
              <h3 className="text-xl font-black tracking-tight text-surface-900 dark:text-white">{title}</h3>
              <p className="text-sm md:text-[15px] text-surface-600 dark:text-slate-300 leading-relaxed">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
