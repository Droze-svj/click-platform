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
    a: "Every new account starts with 14 days of Pro, no card needed. After that you're on Free, which stays free with limits: 3 exports a month, up to 720p, videos up to 2 minutes, and a watermark. You only pay if you outgrow it. No surprise charges.",
  },
  {
    q: 'Who owns the content Click makes?',
    a: 'You do. Period. Click never claims license to your footage, transcripts, captions, voice clones, or generated assets. We process it on the way out; you own everything that comes back.',
  },
  {
    q: 'Is my footage and my account safe?',
    a: 'Your videos are only reachable through signed links that expire, so a file address can\'t be passed around. Connections to your social accounts are encrypted before they\'re stored, passwords are hashed, and you can turn on two-factor sign-in. Payments go through Whop: Click never sees your card number. You can download everything Click holds about you, or delete your account and all your files, yourself in Settings.',
  },
  {
    q: 'Can I switch plans or cancel later?',
    a: 'Yes. Change plans from Billing at any time. If you cancel, you keep access until the end of the period you paid for, then move to Free, and your library stays right where you left it.',
  },
  {
    q: 'Do you offer refunds?',
    a: "Yes: a full refund within 14 days of your first payment on any paid plan, no questions asked. Ask from Billing in the app. After 14 days, we look at refund requests case by case.",
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
