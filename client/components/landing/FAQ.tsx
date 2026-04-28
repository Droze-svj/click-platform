'use client';

import { Plus } from 'lucide-react';
import { glass } from './_styles';

const FAQS = [
  {
    q: 'What happens after my free trial?',
    a: 'Free is forever-free with limits (3 exports/month, 30-second clips, watermark). You only pay if you upgrade — and you can do that any time, no card required to start.',
  },
  {
    q: 'Can I switch plans or cancel later?',
    a: 'Yes. Switch tiers from your billing dashboard at any time — proration is automatic. Cancel any time; you keep access until your billing period ends.',
  },
  {
    q: 'Do you offer refunds?',
    a: '14-day full refund, no questions asked, on every paid plan. After that, we honour pro-rated refunds on a case-by-case basis.',
  },
  {
    q: 'Who owns the content I create?',
    a: 'You do. Period. Click never claims license to your footage, transcripts, captions, or generated assets. We process it; you own it.',
  },
  {
    q: 'How does the AI know my niche?',
    a: 'Click ships with playbooks for finance, fitness, lifestyle, tech, beauty, gaming, business, food, and more. The AI shapes every prompt — captions, hooks, edit suggestions — by your selected niche, platform, and audience-language. No generic outputs.',
  },
  {
    q: 'Is there a watermark on my exports?',
    a: 'On Free only. Creator, Pro, and Agency plans export clean, unbranded video. Agency goes further with white-label exports for shared previews.',
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
            QUESTIONS <span className="text-indigo-400">ANSWERED</span>
          </h2>
          <p className="text-slate-400 text-base font-medium">Common objections, answered honestly.</p>
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
