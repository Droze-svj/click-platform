import { LegalPage } from '../../components/ui/legal-page'

export default function TermsPage() {
  return (
    <LegalPage kicker="Legal" title="Terms of Service">
      <p className="text-surface-600 dark:text-surface-400 text-sm font-medium mb-12">
          Effective: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-black mb-4 tracking-tight">The basic deal</h2>
            <p className="text-surface-700 dark:text-surface-300 leading-relaxed">
              Pay your plan, follow these rules, and we’ll keep Click running. We can update these terms with 30 days’ notice. If we change something material, you can cancel without penalty.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black mb-4 tracking-tight">Your content</h2>
            <p className="text-surface-700 dark:text-surface-300 leading-relaxed">
              You own everything you upload, generate, or schedule through Click. We get a license narrow enough to actually run the service — process, store, and deliver — and nothing else.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black mb-4 tracking-tight">What you can’t do</h2>
            <ul className="text-surface-700 dark:text-surface-300 leading-relaxed list-disc pl-6 space-y-2">
              <li>Upload content that violates law, IP, or platform policies (TikTok, YouTube, etc).</li>
              <li>Use Click to harass, deceive, or run scams.</li>
              <li>Reverse-engineer the service, share API keys, or resell access.</li>
              <li>Use the AI to generate CSAM, deepfakes of real people without consent, or election disinfo.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-black mb-4 tracking-tight">Payment & cancellation</h2>
            <p className="text-surface-700 dark:text-surface-300 leading-relaxed">
              Plans are billed monthly or yearly via Whop. 14-day full refund on first paid plan. Cancel any time; you keep access until the end of the current period.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black mb-4 tracking-tight">Liability</h2>
            <p className="text-surface-700 dark:text-surface-300 leading-relaxed">
              Click is provided as-is. Our maximum aggregate liability for any claim is capped at the amount you paid us in the 12 months before the claim arose.
            </p>
          </section>

          <p className="text-surface-500 text-sm mt-16">
            This is a placeholder. Replace with your real legal text before launch.
          </p>
        </div>
    </LegalPage>
  );
}
