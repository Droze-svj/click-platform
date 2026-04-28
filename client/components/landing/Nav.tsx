'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 px-6 py-6 transition-all duration-300 ${
        scrolled ? 'backdrop-blur-2xl bg-[#050505]/60 border-b border-white/5' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tighter">CLICK</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-widest text-slate-400">
          <a href="#features" className="hover:text-indigo-400 transition-colors">Features</a>
          <a href="#workflow" className="hover:text-indigo-400 transition-colors">Workflow</a>
          <a href="#pricing" className="hover:text-indigo-400 transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-indigo-400 transition-colors">FAQ</a>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="hidden sm:block px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="px-6 py-2.5 sm:px-8 sm:py-2.5 rounded-xl bg-white text-black text-sm font-bold uppercase tracking-widest hover:bg-slate-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95"
          >
            Get Click
          </Link>
        </div>
      </div>
    </nav>
  );
}
