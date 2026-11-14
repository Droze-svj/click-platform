'use client';

import dynamic from 'next/dynamic';
import { PLANS } from '../lib/plans';
import { Nav } from '../components/landing/Nav';
import { Hero } from '../components/landing/Hero';
import { LiveDemo } from '../components/landing/LiveDemo';
import { HowItWorks } from '../components/landing/HowItWorks';
import { LearningLoop } from '../components/landing/LearningLoop';

// Below-the-fold sections
const Pricing = dynamic(
  () => import('../components/landing/Pricing').then((m) => m.Pricing),
  { ssr: true },
);
const FAQ = dynamic(
  () => import('../components/landing/FAQ').then((m) => m.FAQ),
  { ssr: true },
);
const FinalCTA = dynamic(
  () => import('../components/landing/FinalCTA').then((m) => m.FinalCTA),
  { ssr: true },
);
const Footer = dynamic(
  () => import('../components/landing/Footer').then((m) => m.Footer),
  { ssr: true },
);

// JSON-LD for Google. Deliberately carries no aggregateRating: we have no real
// review data, and a made-up rating breaks Google's structured-data policy and
// truth-in-advertising rules.
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Click',
  applicationCategory: 'MultimediaApplication',
  applicationSubCategory: 'Video Editing',
  operatingSystem: 'Web',
  description:
    'Video editor and publisher for short-form creators. Click edits a raw video, packages it with a hook, captions, platform formats and a posting time, publishes it to TikTok, Instagram, YouTube, X, LinkedIn and Facebook Pages, and learns from each post’s results.',
  offers: PLANS.filter((p) => p.priceMonthly > 0).map((p) => ({
    '@type': 'Offer',
    name: p.name,
    price: p.priceMonthly,
    priceCurrency: 'USD',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: p.priceMonthly,
      priceCurrency: 'USD',
      referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
    },
  })),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-page text-surface-900 dark:text-surface-50 selection:bg-primary-500/30 overflow-x-hidden font-inter bg-noise-grain">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />

      {/* Static ambient color — no animation, no fake "live" signals. */}
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-5%] left-[-10%] w-[50%] h-[50%] bg-primary-600/10 blur-[160px] rounded-full opacity-60" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-fuchsia-600/10 blur-[180px] rounded-full opacity-30" />
      </div>

      <Nav />

      <main className="relative z-10 w-full">
        <Hero />
        <LiveDemo />
        <HowItWorks />
        <LearningLoop />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>

      <Footer />

      <style jsx global>{`
        @media (prefers-reduced-motion: no-preference) {
          html { scroll-behavior: smooth; }
        }
      `}</style>
    </div>
  );
}
