'use client';

import { Plus } from 'lucide-react';
import { glass } from './_styles';

const FAQS = [
  {
    q: 'Will Click sound like every other AI editor?',
    a: "No — and that's the whole point. Click ships with niche playbooks for finance, fitness, lifestyle, tech, beauty, gaming, business, food, and more. Then it learns YOUR voice on top: every clip you publish nudges the hooks, captions, and cuts toward what your audience already keeps watching. The longer you use Click, the less your clips look like anyone else's.",
  },
  {
    q: "How fast does Click actually edit?",
    a: 'First clip out the door in about 90 seconds from upload. For longer videos (10+ min), the AI typically finishes in 3–5 minutes — and renders run in the background while you queue the next one. You never wait on Click; Click waits on you.',
  },
  {
    q: 'What happens after my free trial?',
    a: "There's no trial — Free is forever-free with limits (3 exports / month, 30-second clips, watermark). You only pay if you outgrow it, and you can upgrade or downgrade anytime. No card required to start. No surprise charges.",
  },
  {
    q: 'Who owns the content Click makes?',
    a: 'You do. Period. Click never claims license to your footage, transcripts, captions, voice clones, or generated assets. We process it on the way out; you own everything that comes back.',
  },
  {
    q: 'Can I switch plans or cancel later?',
    a: 'Yes. Switch tiers from billing any time — proration is automatic. Cancel any time; you keep access until your billing period ends, and your library stays right where you left it.',
  },
  {
    q: 'Do you offer refunds?',
    a: "14-day full refund on every paid plan, no questions asked. If Click didn't earn its keep in two weeks, that's on us. After that, we honour pro-rated refunds case by case.",
  },
  {
    q: 'Will my exports have a watermark?',
    a: 'On Free only. Creator, Pro, and Agency plans export clean, unbranded video. Agency goes further with white-label review links so your clients see your brand, not ours.',
  },
];

/**
 * Uses native <details>/<summary> + CSS for the open/closed transition.
 * Saves ~10kb of JS over framer-motion's AnimatePresence and is
 * keyboard-accessible by default.
 */
export function FAQ() {
  return (
    <section id="faq" className="py-24 px-6 relative">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">
            ASK CLICK <span className="text-indigo-400">ANYTHING.</span>
          </h2>
          <p className="text-slate-400 text-base font-medium">The questions creators actually send us — answered straight.</p>
        </div>

        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <details
              key={f.q}
              {...(i === 0 ? { open: true } : {})}
              className={`${glass} rounded-2xl overflow-hidden transition-colors group [&[open]]:border-indigo-500/30`}
            >
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 px-6 py-5 hover:bg-white/[0.03] transition-colors select-none">
                <span className="font-bold text-base md:text-lg">{f.q}</span>
                <span
                  aria-hidden="true"
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/5 text-slate-400 group-[&[open]]:bg-indigo-500/20 group-[&[open]]:text-indigo-300 transition-colors"
                >
                  <Plus className="w-4 h-4 motion-safe:transition-transform group-[&[open]]:rotate-45" />
                </span>
              </summary>
              <p className="px-6 pb-5 text-slate-400 leading-relaxed font-medium text-[15px]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
