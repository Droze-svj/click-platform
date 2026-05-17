'use client';

import Link from 'next/link';
import ClickLogo from '../ClickLogo';
import { ShieldCheck, Cpu, Network, Sparkles, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

export function Footer() {
  return (
    <footer className="border-t-2 border-surface-100 dark:border-white/5 py-32 px-6 relative bg-surface-page overflow-hidden font-inter">
      {/* High-Fidelity Background Glow */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute bottom-0 left-1/4 w-1/2 h-full bg-primary-600/10 blur-[140px] rounded-full" />
      </div>

      <div className="max-w-[1900px] mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">

          {/* Brand + trust badges */}
          <div className="lg:col-span-4 flex flex-col items-center lg:items-start gap-6">
            <Link
              href="/"
              className="flex items-center gap-4 group hover:scale-105 transition-transform duration-500"
            >
              <div className="relative">
                 <div className="absolute inset-0 bg-primary-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                 <ClickLogo size={36} showWordmark wordmarkClassName="text-3xl tracking-tighter uppercase italic font-black text-surface-900 dark:text-white" />
              </div>
            </Link>

            <p className="text-xs text-surface-400 dark:text-slate-500 italic leading-relaxed text-center lg:text-left max-w-sm">
              AI video editor + multi-platform scheduler. Built for creators who'd rather make the next idea than fight the timeline.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-card border-2 border-surface-100 dark:border-white/5 shadow-inner">
                 <ShieldCheck size={12} className="text-primary-500" />
                 <span className="text-[9px] font-black uppercase tracking-[0.3em] italic text-surface-400 dark:text-slate-500">Encrypted at rest</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-card border-2 border-surface-100 dark:border-white/5 shadow-inner">
                 <Sparkles size={12} className="text-fuchsia-500" />
                 <span className="text-[9px] font-black uppercase tracking-[0.3em] italic text-surface-400 dark:text-slate-500">AI-generated content labeled</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-card border-2 border-surface-100 dark:border-white/5 shadow-inner">
                 <Cpu size={12} className="text-emerald-500" />
                 <span className="text-[9px] font-black uppercase tracking-[0.3em] italic text-surface-400 dark:text-slate-500">GDPR &amp; CCPA aware</span>
              </div>
            </div>
          </div>

          {/* Link columns */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-10">
            <div className="flex flex-col gap-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.4em] italic text-surface-900 dark:text-white mb-1">Product</h4>
              <Link href="/#features" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">Features</Link>
              <Link href="/#workflow" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">How it works</Link>
              <Link href="/#pricing" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">Pricing</Link>
              <Link href="/register?plan=free" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">Get started</Link>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.4em] italic text-surface-900 dark:text-white mb-1">Company</h4>
              <Link href="/contact" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">Contact</Link>
              <a href="mailto:support@clickapp.io" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">Support</a>
              <Link href="/trust" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">Trust</Link>
              <Link href="/security" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">Security</Link>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.4em] italic text-surface-900 dark:text-white mb-1">Legal</h4>
              <Link href="/terms" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">Terms of Service</Link>
              <Link href="/privacy" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">Privacy Policy</Link>
              <Link href="/cookies" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">Cookie Policy</Link>
              <Link href="/legal/dmca" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">DMCA</Link>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.4em] italic text-surface-900 dark:text-white mb-1">Compliance</h4>
              <Link href="/compliance" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">Compliance</Link>
              <Link href="/ai-disclosure" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">Responsible AI</Link>
              <Link href="/acceptable-use" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">Acceptable Use</Link>
              <Link href="/privacy#delete" className="text-xs text-surface-400 dark:text-slate-500 hover:text-primary-500 transition-colors">Delete my data</Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-20 pt-8 border-t border-surface-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[10px] text-surface-400 dark:text-slate-600 italic">
            © {new Date().getFullYear()} Click. All rights reserved.
          </div>
          <div className="flex items-center gap-3 text-[10px] text-surface-400 dark:text-slate-600 italic">
            <Network size={12} className="text-primary-500" />
            <span>Made for creators worldwide</span>
          </div>
        </div>
      </div>
      
      {/* Decorative HUD Mesh */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500/20 to-transparent" />
    </footer>
  );
}
