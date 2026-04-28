'use client';

import { Nav } from '../components/landing/Nav';
import { ScrollProgress } from '../components/landing/ScrollProgress';
import { Hero } from '../components/landing/Hero';
import { LiveDemo } from '../components/landing/LiveDemo';
import { PlatformMarquee } from '../components/landing/PlatformMarquee';
import { EnginePillars } from '../components/landing/EnginePillars';
import { Workflow } from '../components/landing/Workflow';
import { IntelligenceShowcase } from '../components/landing/IntelligenceShowcase';
import { Testimonials } from '../components/landing/Testimonials';
import { Pricing } from '../components/landing/Pricing';
import { Stats } from '../components/landing/Stats';
import { FAQ } from '../components/landing/FAQ';
import { FinalCTA } from '../components/landing/FinalCTA';
import { Footer } from '../components/landing/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-indigo-500/30 overflow-x-hidden font-sans">
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
