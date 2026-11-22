'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { Upload, Scissors, Package, Send, type LucideIcon } from 'lucide-react';
import { EditVisual, PackageVisual, PublishVisual, UploadVisual } from './stepVisuals';

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
  Visual: ComponentType;
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
    Visual: UploadVisual,
  },
  {
    icon: Scissors,
    title: 'Edit',
    body: 'Click removes silences and dead air, finds the strongest moments and adds captions. It all lands in a full timeline editor, so you can change any cut.',
    Visual: EditVisual,
  },
  {
    icon: Package,
    title: 'Package',
    body: 'Click scores the hook and suggests stronger openings, reframes the video to 9:16, 1:1 or 16:9, writes the post caption and suggests when to post.',
    Visual: PackageVisual,
  },
  {
    icon: Send,
    title: 'Publish',
    body: 'Post now or schedule from one calendar to TikTok, Instagram, YouTube, X, LinkedIn and Facebook Pages.',
    Visual: PublishVisual,
  },
];

/** macOS-style window that frames a step's visual. */
function ProductWindow({ step, index }: { step: Step; index: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="click-vessel !rounded-[1.6rem] overflow-hidden h-full flex flex-col shadow-[0_40px_100px_-40px_rgba(79,70,229,0.5)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-900/5 dark:border-white/5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
        </span>
        <span className="flex-1 text-center text-xs font-semibold text-surface-500 dark:text-slate-400">
          Click · {step.title}
        </span>
        <span className="flex gap-1" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? 'w-5 bg-primary-500' : 'w-1.5 bg-surface-900/15 dark:bg-white/15'}`}
            />
          ))}
        </span>
      </div>
      <div className="relative flex-1 p-5 min-h-0">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={step.title}
            className="h-full"
            initial={reduce ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
          >
            <step.Visual />
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** lg and up: one sticky window. Below: each step carries its own visual. */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  return desktop;
}

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const desktop = useIsDesktop();

  // The step nearest the middle of the screen drives the sticky window.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="py-20 md:py-28 px-4 sm:px-6 font-inter scroll-mt-20"
    >
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-500 mb-4">How it works</p>
          <h2 id="how-heading" className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.98] text-balance text-surface-900 dark:text-white mb-5">
            From raw video to posted, in one place
          </h2>
          <p className="text-surface-600 dark:text-slate-300 text-base md:text-lg leading-relaxed">
            Editing and marketing usually happen in different tools. Click does both, so the video and the way it is presented are planned together.
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-14">
          <ol className="relative space-y-10 lg:space-y-0">
            {/* progress rail (desktop) */}
            <span aria-hidden="true" className="hidden lg:block absolute left-[1.375rem] top-[12vh] bottom-[12vh] w-px bg-surface-900/10 dark:bg-white/10">
              <span
                className="absolute inset-x-0 top-0 bg-gradient-to-b from-primary-500 to-fuchsia-400 transition-[height] duration-500 ease-out"
                style={{ height: `${((active + 1) / STEPS.length) * 100}%` }}
              />
            </span>
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const on = i === active;
              return (
                <li
                  key={step.title}
                  data-step={i}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  className="lg:min-h-[62vh] lg:flex lg:items-center"
                >
                  <div className="w-full">
                    <div className="flex gap-5">
                      {/* opaque backdrop so the progress rail runs behind, not through, the icon */}
                      <span className="relative z-10 shrink-0 h-fit rounded-[1.125rem] bg-[var(--click-canvas-base)]">
                        <span
                          className={`click-aperture-icon w-11 h-11 transition-all duration-500 ${on ? 'lg:scale-110' : 'lg:opacity-40 lg:grayscale'}`}
                        >
                          <Icon className="w-5 h-5" aria-hidden="true" />
                        </span>
                      </span>
                      <div className={`pt-1 transition-opacity duration-500 ${on ? 'lg:opacity-100' : 'lg:opacity-35'}`}>
                        <span className="block text-sm font-black tabular-nums text-surface-400 dark:text-slate-500 mb-1" aria-hidden="true">
                          0{i + 1}
                        </span>
                        <h3 className="text-2xl md:text-3xl font-black tracking-tight text-surface-900 dark:text-white mb-3">{step.title}</h3>
                        <p className="text-base md:text-lg text-surface-600 dark:text-slate-300 leading-relaxed max-w-md">{step.body}</p>
                      </div>
                    </div>
                    {/* phone/tablet: the visual sits under its step */}
                    {!desktop && (
                      <div className="lg:hidden mt-6" aria-hidden="true">
                        <ProductWindow step={step} index={i} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="hidden lg:block" aria-hidden="true">
            <div className="sticky top-[calc(50vh-280px)] h-[560px]">
              {desktop && <ProductWindow step={STEPS[active]} index={active} />}
            </div>
          </div>
        </div>
        <p className="mt-10 lg:mt-4 text-center text-xs text-surface-500 dark:text-slate-400">
          Screens are illustrations of Click&rsquo;s editor, not real accounts or results.
        </p>
      </div>
    </section>
  );
}
