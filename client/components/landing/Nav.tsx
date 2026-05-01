'use client';

import Link from 'next/link';
import ClickLogo from '../ClickLogo';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] px-6 lg:px-12 py-6 transition-all duration-500 ${
        scrolled ? 'backdrop-blur-3xl bg-[#050505]/80 border-b border-white/5 py-4' : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1400px] mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-4 group cursor-pointer">
          <ClickLogo size={40} showWordmark wordmarkClassName="text-3xl tracking-tighter italic" />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 italic">
          <a href="#features" className="hover:text-indigo-400 transition-colors">Features</a>
          <a href="#workflow" className="hover:text-indigo-400 transition-colors">Workflow</a>
          <a href="#pricing" className="hover:text-indigo-400 transition-colors">Pricing</a>
          <div className="w-1 h-1 rounded-full bg-white/10" />
          <Link href="/login" className="hover:text-white transition-colors">Log In</Link>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/register"
            className="px-8 py-3.5 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-500 hover:text-white transition-all shadow-xl active:scale-95"
          >
            Get Started
          </Link>
          
          <button 
            className="md:hidden w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 bg-[#050505] border-b border-white/5 p-8 flex flex-col gap-6 md:hidden backdrop-blur-3xl"
          >
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-sm font-black uppercase tracking-widest text-slate-400 hover:text-white">Features</a>
            <a href="#workflow" onClick={() => setMobileMenuOpen(false)} className="text-sm font-black uppercase tracking-widest text-slate-400 hover:text-white">Workflow</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm font-black uppercase tracking-widest text-slate-400 hover:text-white">Pricing</a>
            <hr className="border-white/5" />
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-sm font-black uppercase tracking-widest text-slate-400 hover:text-white">Log In</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
