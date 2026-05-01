'use client';

import Link from 'next/link';
import ClickLogo from '../ClickLogo';

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-16 px-6 relative bg-[#020202]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        {/* Logo: full color, opacity-80 default → 100 on hover. The previous
            grayscale + opacity-30 was illegible without hover and failed WCAG. */}
        <Link
          href="/"
          className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity"
        >
          <ClickLogo size={24} showWordmark wordmarkClassName="text-lg tracking-tighter uppercase text-white" />
        </Link>

        {/* slate-300 (not 600) clears WCAG AA against #020202. */}
        <div className="flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-slate-300">
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          <a href="mailto:hello@click.example" className="hover:text-white transition-colors">Support</a>
        </div>

        <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">
          © {new Date().getFullYear()} CLICK AI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
