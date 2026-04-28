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

// Below-the-fold sections — keep server-render on (so SEO crawl is
// unchanged) but defer client hydration so the initial JS bundle is
// just the above-the-fold flow (Nav, Hero, LiveDemo, PlatformMarquee,
// EnginePillars, Workflow).
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

// SoftwareApplication structured data — gives Google rich-snippet
// eligibility on the SERP for the four pricing tiers.
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Click',
  applicationCategory: 'MultimediaApplication',
  applicationSubCategory: 'Video Editing',
  operatingSystem: 'Web',
  description:
    'Niche-aware AI auto-edits, retention forecasts, and omni-channel publishing for high-velocity creators.',
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
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    ratingCount: '25000',
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-indigo-500/30 overflow-x-hidden font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      {/* Persistent ambient backgrounds (decorative) */}
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/15 blur-[140px] rounded-full" />
        <div className="absolute top-[40%] right-[-10%] w-[30%] h-[50%] bg-fuchsia-600/15 blur-[160px] rounded-full" />
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] bg-blue-600/10 blur-[160px] rounded-full" />
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
    </div>
  );
}
