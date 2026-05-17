import Link from 'next/link'

export const metadata = {
  title: 'Cookie Policy — Click',
  description: 'How Click uses cookies and similar technologies to operate, secure, and improve our service.',
}

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-surface-page text-surface-900 dark:text-surface-50 px-6 py-24 font-inter">
      <div className="max-w-3xl mx-auto space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary-500">Legal</p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">Cookie Policy</h1>
          <p className="text-sm text-surface-500">Last updated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </header>

        <section className="space-y-4 text-surface-700 dark:text-slate-300 leading-relaxed">
          <p>
            Click uses cookies and similar storage technologies (localStorage, sessionStorage,
            and IndexedDB) to keep you signed in, remember your preferences, and measure how the
            product is used so we can improve it.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">What we use</h2>
          <div className="space-y-6 text-surface-700 dark:text-slate-300 leading-relaxed">
            <div>
              <h3 className="font-bold text-surface-900 dark:text-white">Strictly necessary</h3>
              <p className="text-sm mt-1">
                Authentication tokens (so you stay logged in), CSRF tokens (so we can verify
                form submissions are from you), and the dev-mode preference cookie. These cannot
                be turned off because the product won&apos;t work without them.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-surface-900 dark:text-white">Functional</h3>
              <p className="text-sm mt-1">
                Theme preference, language, and editor layout. These remember your last setting
                so you don&apos;t reconfigure every visit. You can clear them in Settings.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-surface-900 dark:text-white">Analytics (opt-in)</h3>
              <p className="text-sm mt-1">
                Aggregated, pseudonymised usage data that helps us see which features creators
                actually use. Off by default in regions that require explicit consent
                (EEA, UK, Brazil, California). You can toggle this in
                {' '}<Link href="/dashboard/settings" className="text-primary-500 hover:underline">Settings → Privacy</Link>.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Third-party services</h2>
          <p className="text-sm text-surface-700 dark:text-slate-300">
            When you connect a social platform (TikTok, Instagram, YouTube, X, LinkedIn,
            Facebook, Google) those platforms set their own cookies through their OAuth flow.
            Click does not read or share those cookies. Each platform&apos;s cookie policy
            applies independently.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Controlling cookies</h2>
          <p className="text-sm text-surface-700 dark:text-slate-300">
            You can withdraw consent at any time from Settings, or by clearing cookies in your
            browser. Withdrawing consent for analytics won&apos;t log you out or break any
            feature. Strictly-necessary cookies cannot be disabled in the product; clear them
            via your browser if you want to sign out completely.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Contact</h2>
          <p className="text-sm text-surface-700 dark:text-slate-300">
            Questions about this policy?{' '}
            <a href="mailto:privacy@clickapp.io" className="text-primary-500 hover:underline">privacy@clickapp.io</a>
          </p>
        </section>

        <footer className="pt-10 border-t border-surface-100 dark:border-surface-800 text-xs text-surface-400">
          <Link href="/" className="hover:text-primary-500">← Back to home</Link>
        </footer>
      </div>
    </main>
  )
}
