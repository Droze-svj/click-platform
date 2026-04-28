'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
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

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

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
          {FAQS.map((f, i) => {
            const open = openIdx === i;
            return (
              <div key={f.q} className={`${glass} rounded-2xl overflow-hidden transition-colors ${open ? 'border-indigo-500/30' : ''}`}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-white/[0.03] transition-colors"
                >
                  <span className="font-bold text-base md:text-lg">{f.q}</span>
                  <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${open ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-400'}`}>
                    {open ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <p className="px-6 pb-5 text-slate-400 leading-relaxed font-medium text-[15px]">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
