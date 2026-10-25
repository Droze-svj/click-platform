import Link from 'next/link';
import SocialProofWidget from '@/components/SocialProofWidget';
import { LegalPage } from '../../components/ui/legal-page'

export const metadata = {
  title: 'Trust Center — Click',
  description:
    "Click's commitments on data, security, AI, sub-processors, uptime, and compliance.",
};

const SUBPROCESSORS = [
  { name: 'OpenAI', purpose: 'Transcription, captions, generation', region: 'US', dpa: 'https://openai.com/policies/data-processing-addendum' },
  { name: 'Anthropic', purpose: 'Reasoning, generation', region: 'US', dpa: 'https://www.anthropic.com/legal/dpa' },
  { name: 'Google AI', purpose: 'Analysis, translation', region: 'US/EU', dpa: 'https://cloud.google.com/terms/data-processing-addendum' },
  { name: 'Whop / Stripe', purpose: 'Payments, billing', region: 'US/EU', dpa: 'https://stripe.com/legal/dpa' },
  { name: 'Render', purpose: 'Application hosting', region: 'US/EU', dpa: 'https://render.com/legal/dpa' },
  { name: 'Vercel', purpose: 'Frontend hosting / edge', region: 'Global', dpa: 'https://vercel.com/legal/dpa' },
  { name: 'Cloudflare', purpose: 'CDN, DDoS, WAF', region: 'Global', dpa: 'https://www.cloudflare.com/cloudflare-customer-dpa/' },
  { name: 'Sentry', purpose: 'Error tracking', region: 'US/EU', dpa: 'https://sentry.io/legal/dpa/' },
  { name: 'Resend / SES', purpose: 'Transactional email', region: 'US', dpa: 'https://aws.amazon.com/service-terms/' },
];

export default function TrustPage() {
  return (
    <LegalPage kicker="Trust Center" title="Built for trust." backHref="/" backLabel="Back to home" width="wide">
        <p className="text-surface-600 dark:text-surface-400 text-lg leading-relaxed mb-10 max-w-2xl">
          Click is the creative-AI platform creators publish from. We treat your work and your
          data the way we'd want ours treated: visibly, accountably, and with controls you can
          actually use.
        </p>

        <div className="mb-12">
          <SocialProofWidget />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <Card title="Privacy" href="/privacy" desc="GDPR, UK GDPR, CCPA/CPRA. Export, delete, correct in one click." />
          <Card title="Security" href="/security" desc="Encryption, account protection, signed media links, reporting a vulnerability." />
          <Card title="Compliance" href="/compliance" desc="EU AI Act, COPPA, FTC, accessibility (WCAG 2.2 AA)." />
          <Card title="Acceptable Use" href="/acceptable-use" desc="What you can and can't do with Click." />
          <Card title="DMCA" href="/legal/dmca" desc="File a takedown or counter-notice." />
          <Card title="Vulnerability Disclosure" href="/.well-known/security.txt" desc="Report issues responsibly. We respond." />
        </div>

        <section className="mb-16">
          <h2 className="text-2xl font-black mb-6 tracking-tight">Our commitments</h2>
          <ul className="text-surface-700 dark:text-surface-300 leading-relaxed space-y-3 list-disc pl-6">
            <li><strong>No training on your private content</strong> — see Privacy §4.</li>
            <li><strong>AI use can be disclosed</strong> — exports can carry a C2PA provenance manifest that records AI involvement. The signing status above shows whether signing is switched on right now.</li>
            <li><strong>30-day data export &amp; deletion SLA</strong> — self-serve from Settings, or via privacy@clickapp.io.</li>
            <li><strong>Sensible defaults</strong> — HTTPS everywhere, connected-account tokens encrypted at rest (AES-256-GCM), bcrypt password hashing, optional two-step sign-in. Details on the <Link href="/security" className="text-primary-600 dark:text-indigo-400 underline underline-offset-4">Security</Link> page.</li>
            <li><strong>Sub-processors disclosed and DPA-bound</strong> (table below). 30-day notice before adding new ones.</li>
          </ul>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-black mb-6 tracking-tight">Sub-processors</h2>
          <div className="border border-default rounded-2xl overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-surface-card text-[10px] uppercase tracking-widest text-surface-600 dark:text-surface-400">
                <tr>
                  <th className="text-left px-4 py-3 font-black">Provider</th>
                  <th className="text-left px-4 py-3 font-black">Purpose</th>
                  <th className="text-left px-4 py-3 font-black">Region</th>
                  <th className="text-left px-4 py-3 font-black">DPA</th>
                </tr>
              </thead>
              <tbody className="text-surface-700 dark:text-surface-300">
                {SUBPROCESSORS.map((s) => (
                  <tr key={s.name} className="border-t border-subtle">
                    <td className="px-4 py-3 font-bold text-surface-900 dark:text-surface-50">{s.name}</td>
                    <td className="px-4 py-3">{s.purpose}</td>
                    <td className="px-4 py-3">{s.region}</td>
                    <td className="px-4 py-3">
                      <a href={s.dpa} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-indigo-400 hover:underline underline-offset-4">
                        Link
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-surface-500 text-xs mt-3">
            We notify customers 30 days before adding a new sub-processor. Subscribe to updates at{' '}
            <a href="mailto:trust@clickapp.io" className="text-primary-600 dark:text-indigo-400 hover:underline underline-offset-4">
              trust@clickapp.io
            </a>
            .
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-black mb-6 tracking-tight">Documents on request</h2>
          <p className="text-surface-700 dark:text-surface-300 leading-relaxed">
            Data Processing Addendum (DPA), Standard Contractual Clauses (SCCs), security
            questionnaire answers, and our AI risk assessment (EU AI Act). Click has not completed
            a SOC 2 or ISO 27001 audit. Email{' '}
            <a href="mailto:trust@clickapp.io" className="text-primary-600 dark:text-indigo-400 hover:underline underline-offset-4">
              trust@clickapp.io
            </a>
            .
          </p>
        </section>
          </LegalPage>
  );
}

function Card({ title, href, desc }: { title: string; href: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block p-6 rounded-2xl ds-surface-card hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="text-lg font-black mb-1 group-hover:text-primary-600 dark:group-hover:text-indigo-300 transition-colors">{title}</div>
      <div className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">{desc}</div>
    </Link>
  );
}
