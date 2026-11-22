'use client';

import { Plus } from 'lucide-react';

// Every answer is checked against the code it describes:
//  - trial: User.subscription defaults to status 'trial' + endDate now+14d and
//    resolveTier() maps a live trial to 'pro'; afterwards it resolves to 'free'.
//  - Free limits: entitlements LIMITS.free (3 exports, 720p, 120 s) + the Free
//    watermark (entitlementEnforcement.mustWatermark).
//  - learning: performanceLearningCron (every 6 h) → creatorPerformanceService.
//  - platforms: socialMediaService publish adapters.
//  - refunds: routes/billing.js 14-day request flow.
const FAQS = [
  {
    q: 'What do I get for free?',
    a: 'Every new account starts with 14 days of Pro, no card needed. After that you move to the Free plan, which stays free with limits: 3 exports a month at up to 720p, videos up to 2 minutes, and a Click watermark. You only pay if you choose a paid plan.',
  },
  {
    q: 'How does Click learn from my results?',
    a: "When Click publishes a post for you, it later pulls that post's views, watch time and engagement from the platform. Every few hours it compares those numbers with what is normal for your niche and platform, and updates which hooks, caption styles and posting times it suggests to you. It needs a few posts with results before the suggestions become personal.",
  },
  {
    q: "Will my videos look like everyone else's?",
    a: "Click starts from a playbook for your niche (finance, health, education, technology, lifestyle, business, beauty, gaming and more), then shifts toward whatever your own audience responds to. You can change every suggestion.",
  },
  {
    q: 'Which platforms can Click post to?',
    a: 'TikTok, Instagram, YouTube, X, LinkedIn and Facebook Pages. You connect each account once through the platform’s own sign-in, so Click never sees your passwords.',
  },
  {
    q: 'Who owns what I make?',
    a: 'You do. Click never claims a license to your footage, transcripts, captions, voice clones or generated assets.',
  },
  {
    q: 'Is my footage and my account safe?',
    a: "Your videos are only reachable through signed links that expire, so a file address can't be passed around. Connections to your social accounts are encrypted before they're stored, passwords are hashed, and you can turn on two-factor sign-in. Payments go through Whop: Click never sees your card number. You can download everything Click holds about you, or delete your account and all your files, yourself in Settings.",
  },
  {
    q: 'Can I cancel, and do you offer refunds?',
    a: 'Yes. Change or cancel your plan from Billing at any time. If you cancel, you keep access until the end of the period you paid for, then move to Free, and your library stays where it is. Within 14 days of your first payment on a paid plan you can ask for a full refund from Billing; after that, requests are reviewed case by case.',
  },
];

/**
 * Native <details>/<summary>: keyboard-accessible by default and no JS
 * animation library needed.
 */
export function FAQ() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="py-16 md:py-24 px-4 sm:px-6 relative font-inter scroll-mt-20">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-500 mb-4">FAQ</p>
          <h2 id="faq-heading" className="text-3xl md:text-5xl font-black tracking-tighter leading-tight text-balance text-surface-900 dark:text-white">
            Questions creators ask
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group ds-surface-card overflow-hidden open:border-primary-500/40 transition-colors"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 px-5 md:px-6 py-4 md:py-5 hover:bg-surface-900/[0.03] dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary-500/50 [&::-webkit-details-marker]:hidden">
                <span className="font-bold text-base md:text-lg text-surface-900 dark:text-white">{f.q}</span>
                <span
                  aria-hidden="true"
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-surface-900/5 dark:bg-white/5 text-surface-500 dark:text-slate-400 group-open:bg-primary-500/20 group-open:text-primary-500 transition-colors"
                >
                  <Plus className="w-4 h-4 motion-safe:transition-transform group-open:rotate-45" />
                </span>
              </summary>
              <p className="px-5 md:px-6 pb-5 text-surface-600 dark:text-slate-300 leading-relaxed text-[15px]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
