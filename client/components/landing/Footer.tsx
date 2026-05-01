'use client';

import Link from 'next/link';
import ClickLogo from '../ClickLogo';

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-16 px-6 relative bg-[#020202]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <Link
          href="/"
          className="flex items-center gap-3 grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all"
        >
          <ClickLogo size={24} showWordmark wordmarkClassName="text-lg tracking-tighter uppercase" />
        </Link>

        <div className="flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-slate-600">
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          <a href="mailto:hello@click.example" className="hover:text-white transition-colors">Support</a>
        </div>

        <div className="text-slate-600 text-xs font-bold uppercase tracking-widest">
          © {new Date().getFullYear()} CLICK AI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
