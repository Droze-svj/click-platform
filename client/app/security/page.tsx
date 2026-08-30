import { LegalPage } from '../../components/ui/legal-page'

export const metadata = {
  title: 'Security — Click',
  description:
    "Click's security architecture, controls, and responsible-disclosure program.",
};

export default function SecurityPage() {
  return (
    <LegalPage kicker="Security" title="How we protect your work." backHref="/trust" backLabel="Trust Center">
        <div className="space-y-10">
          <Section title="Encryption">
            TLS 1.2+ for all traffic to Click; HSTS preload requested. Stored data is encrypted at
            rest with AES-256 (managed keys for primary stores, customer-managed keys available on
            Enterprise). Backups are encrypted with separate keys.
          </Section>

          <Section title="Authentication & access">
            Password hashing uses argon2id (or bcrypt cost 12+ on legacy accounts). Optional 2FA
            (TOTP). SSO via SAML and OIDC for Enterprise. Session tokens are short-lived and
            rotated on privilege change. Staff access is gated by SSO + 2FA + just-in-time
            elevation; production access is logged with the reason and reviewed weekly.
          </Section>

          <Section title="Application security">
            Strict Content-Security-Policy with nonces, X-Frame-Options DENY, X-Content-Type-Options
            nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy locked
            down. CSRF tokens on cookie-authed routes; rate-limiting per route; input validation
            with allowlists; output encoding for any rendered user content.
          </Section>

          <Section title="Vulnerability management">
            Static analysis on every PR (TypeScript, ESLint, Semgrep). Dependency scanning daily
            via Dependabot/Renovate; high-severity CVEs patched within 7 days, criticals within
            48 hours. Container images rebuilt weekly. Annual third-party penetration test;
            executive summary available under NDA at{' '}
            <a href="mailto:trust@click.example" className="text-indigo-400 hover:text-indigo-300 underline">
              trust@click.example
            </a>
            .
          </Section>

          <Section title="Logging & monitoring">
            Audit logs for authentication, role changes, exports, deletions, and admin actions
            are retained 18 months in tamper-evident storage. Anomaly detection on auth and
            billing flows. Errors aggregated through Sentry with PII scrubbing.
          </Section>

          <Section title="Data handling">
            Least-privilege service accounts; per-tenant isolation at the application layer;
            database-level tenant filters enforced via middleware. Backups daily, retained 30
            days; quarterly restore drills. Hard-delete from primary store within 30 days of
            deletion request; from backups within 90 days.
          </Section>

          <Section title="AI controls">
            All generative outputs carry a visible AI-disclosure marker and a C2PA cryptographic
            provenance manifest. Prompt and response logs are retained 30 days for abuse
            detection, then aggregated/anonymized. Content moderation runs on prompts and outputs
            for CSAM, non-consensual intimate imagery, and election disinformation.
          </Section>

          <Section title="Resilience">
            Multi-region failover for the API; CDN edge for static assets. RPO 24h, RTO 4h
            target. Status page at status.click.example.
          </Section>

          <Section title="Compliance roadmap">
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>SOC 2 Type II — in progress, target completion this fiscal year.</li>
              <li>ISO 27001 — scoped, gap analysis underway.</li>
              <li>HIPAA — not in scope; do not upload PHI.</li>
              <li>PCI-DSS SAQ A — payment data is tokenized via Whop / Stripe; Click never
                touches PAN.</li>
            </ul>
          </Section>

          <Section title="Responsible disclosure">
            Found something? Email{' '}
            <a href="mailto:security@click.example" className="text-indigo-400 hover:text-indigo-300 underline">
              security@click.example
            </a>{' '}
            or use{' '}
            <a href="/.well-known/security.txt" className="text-indigo-400 hover:text-indigo-300 underline">
              /.well-known/security.txt
            </a>
            . We acknowledge within 1 business day, triage within 5, and credit reporters in our
            hall-of-fame (with permission). Safe-harbor: we will not pursue legal action for
            good-faith research that follows the disclosure policy.
          </Section>
        </div>
          </LegalPage>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-black mb-3 tracking-tight">{title}</h2>
      <div className="text-surface-700 dark:text-surface-300 leading-relaxed">{children}</div>
    </section>
  );
}
