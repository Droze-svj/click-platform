import Link from 'next/link';
import ClickLogo from '../ClickLogo';

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/#how-it-works', label: 'How it works' },
      { href: '/#learning-loop', label: 'What Click learns' },
      { href: '/#pricing', label: 'Pricing' },
      { href: '/#faq', label: 'FAQ' },
      { href: '/register?plan=free', label: 'Get started' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/contact', label: 'Contact' },
      { href: '/contact?topic=support', label: 'Support' },
      { href: '/trust', label: 'Trust' },
      { href: '/security', label: 'Security' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms of Service' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/refund', label: 'Refund & Cancellation' },
      { href: '/cookies', label: 'Cookie Policy' },
      { href: '/legal/dmca', label: 'DMCA' },
    ],
  },
  {
    title: 'Compliance',
    links: [
      { href: '/compliance', label: 'Compliance' },
      { href: '/ai-disclosure', label: 'Responsible AI' },
      { href: '/acceptable-use', label: 'Acceptable Use' },
      { href: '/data-deletion', label: 'Delete my data' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-[var(--click-vessel-border)] py-14 md:py-20 px-4 sm:px-6 bg-[var(--click-vessel-bg)] backdrop-blur-xl font-inter">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          <div className="lg:col-span-4 flex flex-col items-start gap-4">
            <Link href="/" aria-label="Click home" className="rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50">
              <ClickLogo size={32} showWordmark wordmarkClassName="text-2xl tracking-tighter uppercase italic font-black text-surface-900 dark:text-white" />
            </Link>
            <p className="text-sm text-surface-500 dark:text-slate-400 leading-relaxed max-w-sm">
              Video editor and publisher for short-form creators. It edits, packages and posts your videos, then learns from how they did.
            </p>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {COLUMNS.map((col) => (
              <div key={col.title} className="flex flex-col gap-2.5">
                <h2 className="text-xs font-bold uppercase tracking-widest text-surface-900 dark:text-white mb-1">{col.title}</h2>
                {col.links.map((l) => (
                  <Link key={l.href} href={l.href} className="text-sm text-surface-500 dark:text-slate-400 hover:text-primary-500 transition-colors">
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-surface-100 dark:border-white/5 text-xs text-surface-500 dark:text-slate-500">
          © {new Date().getFullYear()} Click. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
