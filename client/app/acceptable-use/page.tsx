import Link from 'next/link'

export const metadata = {
  title: 'Acceptable Use — Click',
  description: "What you can and can't do with Click. Keeps the platform safe for every creator.",
}

export default function AcceptableUsePage() {
  return (
    <main className="min-h-screen bg-surface-page text-surface-900 dark:text-surface-50 px-6 py-24 font-inter">
      <div className="max-w-3xl mx-auto space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary-500">Legal</p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">Acceptable Use Policy</h1>
          <p className="text-sm text-surface-500">Last updated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </header>

        <section className="space-y-4 text-surface-700 dark:text-slate-300 leading-relaxed">
          <p>
            Click is built to help creators ship better content faster. To keep it useful for
            everyone, the following uses are not permitted. Violations may result in content
            removal, suspension, or permanent account closure.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">You may not use Click to</h2>
          <ul className="space-y-3 text-sm text-surface-700 dark:text-slate-300 list-disc pl-6">
            <li>Publish content that depicts child sexual abuse material (CSAM), terrorist
              content, or material that incites real-world violence.</li>
            <li>Impersonate another person, brand, or platform — including AI-generated
              imitations of named real individuals without their consent.</li>
            <li>Run unsolicited bulk campaigns (spam) or content-farm operations designed to
              evade platform spam detection.</li>
            <li>Publish content that violates the destination platform&apos;s terms of service
              (TikTok, Meta, YouTube, X, LinkedIn, Google). Click reformats but does not
              override platform rules.</li>
            <li>Distribute content that infringes copyright, trademark, or other intellectual
              property rights you don&apos;t own or license. DMCA reports go to{' '}
              <Link href="/legal/dmca" className="text-primary-500 hover:underline">/legal/dmca</Link>.
            </li>
            <li>Scrape, reverse-engineer, or stress-test our APIs in ways that degrade service
              for other creators. Reasonable load testing on your own account is fine; please
              contact us first if you&apos;ll exceed normal usage.</li>
            <li>Generate non-consensual deepfakes, fabricated quotes attributed to real people,
              or AI imagery designed to mislead about provenance.</li>
            <li>Resell access to your Click account or share credentials with third parties not
              on your workspace.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">AI content disclosure</h2>
          <p className="text-sm text-surface-700 dark:text-slate-300">
            When Click&apos;s AI authored a substantial portion of a video or caption, you are
            responsible for applying the destination platform&apos;s built-in AI-content label
            (TikTok: AI-generated content toggle; Meta: AI Info; YouTube: altered/synthetic
            content). See our{' '}
            <Link href="/ai-disclosure" className="text-primary-500 hover:underline">Responsible AI policy</Link>
            {' '}for context.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Minimum age</h2>
          <p className="text-sm text-surface-700 dark:text-slate-300">
            Click is not for users under 16 (or the digital-consent age in your jurisdiction,
            whichever is higher). We do not knowingly collect personal data from children
            below this age.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Reporting abuse</h2>
          <p className="text-sm text-surface-700 dark:text-slate-300">
            See content on Click that violates this policy?{' '}
            <a href="mailto:safety@clickapp.io" className="text-primary-500 hover:underline">safety@clickapp.io</a>.
            We respond to verified reports within 5 business days.
          </p>
        </section>

        <footer className="pt-10 border-t border-surface-100 dark:border-surface-800 text-xs text-surface-400">
          <Link href="/" className="hover:text-primary-500">← Back to home</Link>
        </footer>
      </div>
    </main>
  )
}
