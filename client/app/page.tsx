'use client';

import dynamic from 'next/dynamic';
import { PLANS } from '../lib/plans';
import { Nav } from '../components/landing/Nav';
import { ScrollProgress } from '../components/landing/ScrollProgress';
import { Hero } from '../components/landing/Hero';
import { LiveDemo } from '../components/landing/LiveDemo';
import { PlatformMarquee } from '../components/landing/PlatformMarquee';
import { EnginePillars } from '../components/landing/EnginePillars';
import { Workflow } from '../components/landing/Workflow';
import { Fingerprint } from 'lucide-react';

// Below-the-fold sections
const IntelligenceShowcase = dynamic(
  () => import('../components/landing/IntelligenceShowcase').then((m) => m.IntelligenceShowcase),
  { ssr: true },
);
const Testimonials = dynamic(
  () => import('../components/landing/Testimonials').then((m) => m.Testimonials),
  { ssr: true },
);
const Pricing = dynamic(
  () => import('../components/landing/Pricing').then((m) => m.Pricing),
  { ssr: true },
);
const Stats = dynamic(
  () => import('../components/landing/Stats').then((m) => m.Stats),
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

// JSON-LD for Google. Previously broadcast a fabricated 4.9-star
// aggregate rating with 25,000 reviews — that's a violation of Google's
// structured-data policy (and FTC truth-in-advertising rules) and gets
// the site penalised, not boosted. Now omits aggregateRating entirely
// until we have real review data to back it up.
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Click',
  applicationCategory: 'MultimediaApplication',
  applicationSubCategory: 'Video Editing',
  operatingSystem: 'Web',
  description:
    'AI video editor + multi-platform scheduler. Turn one raw clip into a week of niche-tuned posts across TikTok, Reels, Shorts, X, and LinkedIn.',
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
    <div className="min-h-screen bg-surface-page text-surface-900 dark:text-surface-50 selection:bg-primary-500/30 overflow-x-hidden font-inter transition-colors duration-500 bg-noise-grain">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      
      {/* High-Fidelity Ambient Backgrounds (Design System Aligned) */}
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-5%] left-[-10%] w-[50%] h-[50%] bg-primary-600/10 blur-[160px] rounded-full mix-blend-screen opacity-60" />
        <div className="absolute top-[30%] right-[-10%] w-[40%] h-[60%] bg-fuchsia-600/10 blur-[180px] rounded-full mix-blend-screen opacity-40" />
        <div className="absolute bottom-[-10%] left-[10%] w-[60%] h-[60%] bg-blue-600/10 blur-[180px] rounded-full mix-blend-screen opacity-40" />
        
        {/* Neural Grid - Subtle Landing Manifestation */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px] opacity-20 dark:opacity-40" />
        
        {/* Spectral Mesh HUD Aesthetics */}
        <div className="absolute top-48 left-12 hidden xl:flex flex-col gap-4 opacity-[0.03] dark:opacity-[0.07]">
           <Fingerprint size={120} className="text-primary-500" />
           <div className="h-px w-32 bg-primary-500/50" />
           <p className="text-[10px] font-black uppercase tracking-[1em] italic text-primary-500 leading-none">Click</p>
        </div>
      </div>

      <ScrollProgress />
      <Nav />

      <main className="relative z-10 w-full">
        <Hero />
        <LiveDemo />
        <PlatformMarquee />
        <EnginePillars />
        <Workflow />
        <IntelligenceShowcase />
        <Testimonials />
        <Pricing />
        <Stats />
        <FAQ />
        <FinalCTA />
      </main>

      <Footer />
      
      <style jsx global>{`
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
}
