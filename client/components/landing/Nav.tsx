'use client';

import Link from 'next/link';
import ClickLogo from '../ClickLogo';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#learning-loop', label: 'What Click learns' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const close = () => setMobileMenuOpen(false);

  return (
    <nav
      aria-label="Main"
      className={`fixed top-0 left-0 right-0 z-[100] px-4 sm:px-6 lg:px-12 transition-colors duration-300 ${
        scrolled || mobileMenuOpen
          ? 'backdrop-blur-xl bg-[var(--click-vessel-bg-strong)] border-b border-[var(--click-vessel-border)] py-3'
          : 'bg-transparent py-4 md:py-6'
      }`}
    >
      <div className="max-w-[1600px] mx-auto flex items-center justify-between">
        <Link href="/" aria-label="Click home" className="flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50">
          <ClickLogo size={36} showWordmark aura wordmarkClassName="text-2xl sm:text-3xl md:text-4xl whitespace-nowrap tracking-tighter italic font-black uppercase" />
        </Link>

        <div className="hidden md:flex items-center gap-7 lg:gap-9 text-sm font-semibold text-surface-600 dark:text-slate-300">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-primary-500 transition-colors">{l.label}</a>
          ))}
          <span className="w-1 h-1 rounded-full bg-surface-300 dark:bg-white/20" aria-hidden="true" />
          <Link href="/login" className="text-surface-900 dark:text-white hover:text-primary-500 transition-colors">Log in</Link>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/register"
            className="whitespace-nowrap px-5 py-2.5 sm:px-7 sm:py-3 rounded-full bg-surface-900 dark:bg-white text-white dark:text-black text-xs sm:text-sm font-bold hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/60"
          >
            Start free
          </Link>

          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-mobile-menu"
            className="md:hidden w-11 h-11 shrink-0 rounded-xl bg-surface-page dark:bg-white/5 border-2 border-surface-100 dark:border-white/10 flex items-center justify-center text-surface-900 dark:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50"
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            {mobileMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          id="landing-mobile-menu"
          className="absolute top-full left-0 right-0 bg-surface-page border-b-2 border-surface-100 dark:border-white/10 px-6 py-6 flex flex-col gap-5 md:hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)]"
        >
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={close} className="text-lg font-semibold text-surface-700 dark:text-slate-200 hover:text-primary-500 transition-colors">
              {l.label}
            </a>
          ))}
          <div className="h-px bg-surface-100 dark:bg-white/5" />
          <Link href="/login" onClick={close} className="text-lg font-semibold text-surface-900 dark:text-white hover:text-primary-500 transition-colors">Log in</Link>
        </div>
      )}
    </nav>
  );
}
