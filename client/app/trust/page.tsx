import Link from 'next/link';
import SocialProofWidget from '@/components/SocialProofWidget';

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
    <div className="min-h-screen bg-[#050505] text-white px-6 py-24">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-white uppercase tracking-widest font-bold mb-12"
        >
          ← Back to home
        </Link>

        <div className="mb-2 text-xs uppercase tracking-[0.4em] text-indigo-400 font-black">Trust Center</div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-4">Built for trust.</h1>
        <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-2xl">
          Click is the creative-AI platform creators publish from. We treat your work and your
          data the way we'd want ours treated: visibly, accountably, and with controls you can
          actually use.
        </p>

        <div className="mb-12">
          <SocialProofWidget />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <Card title="Privacy" href="/privacy" desc="GDPR, UK GDPR, CCPA/CPRA. Export, delete, correct in one click." />
          <Card title="Security" href="/security" desc="Encryption, access controls, audit logs, vuln disclosure." />
          <Card title="Compliance" href="/compliance" desc="EU AI Act, COPPA, FTC, accessibility (WCAG 2.2 AA)." />
          <Card title="Acceptable Use" href="/legal/aup" desc="What you can and can't do with Click." />
          <Card title="DMCA" href="/legal/dmca" desc="File a takedown or counter-notice." />
          <Card title="Vulnerability Disclosure" href="/.well-known/security.txt" desc="Report issues responsibly. We respond." />
        </div>

        <section className="mb-16">
          <h2 className="text-2xl font-black mb-6 tracking-tight">Our commitments</h2>
          <ul className="text-slate-300 leading-relaxed space-y-3 list-disc pl-6">
            <li><strong>No training on your private content</strong> — see Privacy §4.</li>
            <li><strong>AI outputs are marked</strong> — every AI-generated export carries a visible AI-disclosure marker and a C2PA cryptographic provenance manifest.</li>
            <li><strong>30-day data export &amp; deletion SLA</strong> — self-serve from Settings, or via privacy@click.example.</li>
            <li><strong>Strong defaults</strong> — TLS in transit, AES-256 at rest, argon2/bcrypt password hashing, 2FA available, SSO on enterprise.</li>
            <li><strong>Annual third-party penetration test</strong>, quarterly internal scans, audit-logged admin actions retained 18 months.</li>
            <li><strong>Sub-processors disclosed and DPA-bound</strong> (table below). 30-day notice before adding new ones.</li>
            <li><strong>Uptime target 99.9%</strong> for the editor and dashboard; status page at status.click.example.</li>
          </ul>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-black mb-6 tracking-tight">Sub-processors</h2>
          <div className="border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3 font-black">Provider</th>
                  <th className="text-left px-4 py-3 font-black">Purpose</th>
                  <th className="text-left px-4 py-3 font-black">Region</th>
                  <th className="text-left px-4 py-3 font-black">DPA</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {SUBPROCESSORS.map((s) => (
                  <tr key={s.name} className="border-t border-white/5">
                    <td className="px-4 py-3 font-bold text-white">{s.name}</td>
                    <td className="px-4 py-3">{s.purpose}</td>
                    <td className="px-4 py-3">{s.region}</td>
                    <td className="px-4 py-3">
                      <a href={s.dpa} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                        Link
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-slate-500 text-xs mt-3">
            We notify customers 30 days before adding a new sub-processor. Subscribe to updates at{' '}
            <a href="mailto:trust@click.example" className="text-indigo-400 hover:text-indigo-300 underline">
              trust@click.example
            </a>
            .
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-black mb-6 tracking-tight">Documents on request</h2>
          <p className="text-slate-300 leading-relaxed">
            Data Processing Addendum (DPA), Standard Contractual Clauses (SCCs), security
            questionnaire (CAIQ), penetration-test executive summary, SOC 2 Type II (in
            progress), AI risk assessment (EU AI Act). Email{' '}
            <a href="mailto:trust@click.example" className="text-indigo-400 hover:text-indigo-300 underline">
              trust@click.example
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

function Card({ title, href, desc }: { title: string; href: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group"
    >
      <div className="text-lg font-black mb-1 group-hover:text-indigo-300 transition-colors">{title}</div>
      <div className="text-sm text-slate-400 leading-relaxed">{desc}</div>
    </Link>
  );
}
