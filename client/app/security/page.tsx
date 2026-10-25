import { LegalPage } from '../../components/ui/legal-page'

export const metadata = {
  title: 'Security — Click',
  description:
    'How Click protects your account, your connected platforms, and your media — and how to report a problem.',
};

/*
 * Every line here describes something the code actually does. The previous
 * version promised argon2id hashing (Click uses bcrypt), multi-region failover,
 * a status page, an annual third-party penetration test, quarterly restore
 * drills and 18-month tamper-evident audit storage — none of which exist.
 * Security claims are the last place to round up; add a line back only when
 * the thing it describes ships.
 */
export default function SecurityPage() {
  return (
    <LegalPage kicker="Security" title="How we protect your work." backHref="/trust" backLabel="Trust Center">
        <div className="space-y-10">
          <Section title="Encryption">
            All traffic to Click is served over HTTPS, and browsers are told to use HTTPS only
            (HSTS). The access tokens for the social accounts you connect, and two-step sign-in
            secrets, are encrypted at rest with AES-256-GCM before they are stored.
          </Section>

          <Section title="Your account">
            Passwords are never stored — only salted bcrypt hashes. You can turn on two-step
            sign-in with an authenticator app, with backup codes for a lost phone. Repeated wrong
            passwords lock the account for 15 minutes. Changing your password signs out your other
            sessions.
          </Section>

          <Section title="Your media">
            Uploaded and rendered files are only reachable through short-lived signed links, so a
            copied URL stops working after it expires. Your content is scoped to your account and
            workspace on every request.
          </Section>

          <Section title="Application security">
            Click sends a Content-Security-Policy, refuses to be framed (X-Frame-Options DENY),
            disables content sniffing, and uses a strict referrer policy. Requests are rate-limited,
            server-side fetches of user-supplied URLs are checked against private networks, and
            dependencies are scanned for known vulnerabilities in CI.
          </Section>

          <Section title="AI-generated media">
            Exports made with Click can carry a C2PA provenance manifest that records that AI tools
            were used, so platforms and viewers can check where a file came from.
          </Section>

          <Section title="Certifications">
            Click has not completed a SOC 2 or ISO 27001 audit. We will say so here when that
            changes. Payments are handled by our payment processor; Click never receives your card
            number. Click is not built for health data — please don&apos;t upload it.
          </Section>

          <Section title="Report a problem">
            Found a vulnerability? Email{' '}
            <a href="mailto:security@clickapp.io" className="text-primary-600 dark:text-indigo-400 hover:underline underline-offset-4">
              security@clickapp.io
            </a>{' '}
            or see{' '}
            <a href="/.well-known/security.txt" className="text-primary-600 dark:text-indigo-400 hover:underline underline-offset-4">
              /.well-known/security.txt
            </a>
            . Please give us a reasonable chance to fix it before sharing details publicly; we will
            not take legal action over good-faith research that follows this policy.
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
