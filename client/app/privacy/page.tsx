import Link from 'next/link'
import { LegalPage } from '../../components/ui/legal-page'

export const metadata = {
  title: 'Privacy Policy — Click',
  description: 'Comprehensive Privacy Policy detailing how Click collects, protects, processes, and respects creator data, biometrics, and AI media.',
}

export default function PrivacyPage() {
  return (
    <LegalPage kicker="Legal & Trust" title="Privacy Policy" updated={new Date('2026-11-13')}>
      <div className="prose prose-invert prose-slate max-w-none space-y-8 text-surface-700 dark:text-surface-300 leading-relaxed">

        <div className="p-4 rounded-xl bg-surface-100 dark:bg-white/5 not-prose text-xs text-surface-600 dark:text-slate-400 space-y-1">
          <p><strong>In short:</strong> We do not sell your personal data, and Click does not train AI models on your drafts, voice notes or footage. While Click uses Gemini&apos;s free tier, Google may use what is sent to it; see section 5.</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">1. Introduction</h2>
          <p>
            Click (&quot;Click&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your privacy and treating creator information with utmost confidentiality and security. This Privacy Policy describes how we collect, store, process, and safeguard your personal data when you interact with our applications, APIs, smart editor, and digital twin synthesis platform.
          </p>
          <p>
            This policy complies with the EU/UK General Data Protection Regulation (GDPR), the California Consumer Privacy Act as amended by the California Privacy Rights Act (CCPA/CPRA), the Illinois Biometric Information Privacy Act (BIPA), and applicable international privacy frameworks.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">2. Information We Collect</h2>
          <p>We collect information you provide directly, data generated automatically, and information from connected services:</p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong>Account &amp; Profile Data:</strong> Name, email address, username, profile avatar, account preferences, and hashed passwords.</li>
            <li><strong>Creator Media &amp; Content:</strong> Video recordings, voice notes, scripts, captions, brand kit assets (logos, custom fonts, color grades), and project timelines you upload or generate.</li>
            <li><strong>Biometric Data &amp; Vocal Profiles:</strong> When you elect to use our Digital Twin Avatar or Voice Cloning features, we analyze voice frequencies and facial landmark coordinates from your uploaded recordings solely to generate synchronized facial lip movement and synthesized speech.</li>
            <li><strong>Payment &amp; Billing Data:</strong> Payment details are processed directly by our merchant of record, <strong>Whop</strong>. Click receives only non-sensitive tokens, transaction IDs, package identifiers, and renewal dates. We do not store raw credit card numbers on our infrastructure.</li>
            <li><strong>Social Media Tokens (OAuth):</strong> When you link TikTok, YouTube, Instagram, or Twitter accounts, we store authorized OAuth tokens with least-privilege scopes to enable automated publishing and fetch view/retention analytics.</li>
            <li><strong>Technical &amp; Telemetry Data:</strong> IP address, device operating system, browser type, interaction logs, error reports via Sentry, and feature usage counters.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">3. How We Use Your Data</h2>
          <p>We process your personal information strictly for legitimate business and contractual purposes:</p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong>Service Delivery:</strong> Running video rendering engines, generating subtitles, applying color grades, and rendering talking avatar lip-syncs.</li>
            <li><strong>Taste-Graph Personalization:</strong> Reading your editing style picks (favorite fonts, caption pacing) to customize suggestion rails so your editing workflow accelerates over time.</li>
            <li><strong>Publishing &amp; Distribution:</strong> Sending your approved video clips to authorized connected platforms at your scheduled times.</li>
            <li><strong>Security &amp; Abuse Prevention:</strong> Detecting fraudulent transactions, unauthorized account access, and preventing the synthesis of non-consensual deepfakes.</li>
            <li><strong>Transactional Communications:</strong> Sending receipts, renewal notifications, quota threshold warnings, and security alerts.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">4. Biometric Information Notice &amp; Retention (BIPA &amp; State Laws)</h2>
          <p>
            In compliance with the Illinois Biometric Information Privacy Act (740 ILCS 14/) and similar state regulations:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong>Explicit Purpose:</strong> Biometric voiceprints and facial geometric representations are collected exclusively for the specific purpose of generating your personal digital twin avatar and synthesized voiceover.</li>
            <li><strong>Written Consent:</strong> You provide affirmative, documented consent prior to uploading voice notes or facial imagery for synthesis.</li>
            <li><strong>No Commercial Sale:</strong> Click will never sell, lease, trade, or otherwise profit from your biometric data.</li>
            <li><strong>Retention Schedule:</strong> Biometric voice and facial identifiers are retained only as long as you maintain an active Digital Twin profile, or for a maximum of 3 years following your last interaction with the Service. Upon account termination or your written deletion request, biometric data is permanently purged within 30 days.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">5. Service Providers &amp; AI Data Flow</h2>
          <p>
            These providers process data for Click to run the service, under their own data-processing terms:
          </p>
          <div className="overflow-x-auto not-prose">
            <table className="w-full text-left text-xs border border-surface-200 dark:border-white/10 rounded-xl overflow-hidden">
              <thead className="bg-surface-100 dark:bg-white/5 text-surface-900 dark:text-white font-bold border-b border-surface-200 dark:border-white/10">
                <tr>
                  <th className="p-3">Provider</th>
                  <th className="p-3">What for</th>
                  <th className="p-3">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-white/10 text-surface-600 dark:text-surface-300">
                <tr>
                  <td className="p-3 font-semibold text-surface-900 dark:text-white">Render Services, Inc.</td>
                  <td className="p-3">Hosting the app and storing your uploaded and rendered files</td>
                  <td className="p-3">United States (Oregon)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-surface-900 dark:text-white">MongoDB, Inc. (Atlas)</td>
                  <td className="p-3">Database for your account, content and settings</td>
                  <td className="p-3">United States</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-surface-900 dark:text-white">Google LLC (Gemini API)</td>
                  <td className="p-3">AI video analysis, transcription, captions and writing</td>
                  <td className="p-3">United States / Global</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-surface-900 dark:text-white">OpenAI, L.L.C.</td>
                  <td className="p-3">AI text generation (scripts, captions, summaries)</td>
                  <td className="p-3">United States</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-surface-900 dark:text-white">Whop, Inc.</td>
                  <td className="p-3">Merchant of record: checkout, payments and subscriptions</td>
                  <td className="p-3">United States</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-surface-900 dark:text-white">Functional Software, Inc. (Sentry)</td>
                  <td className="p-3">Error reports from our servers: what failed, where, and your account ID. Never your content, files, passwords or IP address. Kept for up to 90 days.</td>
                  <td className="p-3">European Union (Germany)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-surface-900 dark:text-white">HeyGen / OpenAI Sora</td>
                  <td className="p-3">Avatar videos, only if you add your own API key for them</td>
                  <td className="p-3">United States</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm">
            <strong>AI providers and your content.</strong> Click currently uses Google&apos;s Gemini API on its
            free tier. Under Google&apos;s terms for that tier, Google may use content sent to the API, including
            transcripts and frames from your videos, to improve its products, and people at Google may review it.
            We will update this section when Click moves to a paid tier, under which Google does not use the
            content that way. OpenAI does not use content sent through its API to train its models by default and
            keeps it for up to 30 days for abuse monitoring.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">6. International Data Transfers &amp; Security</h2>
          <p className="text-sm">
            Everything travels over HTTPS (TLS) with HSTS. Tokens for the social accounts you connect and two-factor
            secrets are encrypted with AES-256-GCM before they are stored, and the database is encrypted at rest by
            our database provider. Passwords are stored as bcrypt hashes. Your files are only reachable through signed
            links that expire. Inside a workspace, access follows the roles its owner assigns. Our providers are based in
            the United States; transfers from the European Economic Area or UK rely on their data-processing terms,
            including the EU Standard Contractual Clauses where those terms offer them.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">7. Your Privacy Rights (GDPR &amp; CCPA/CPRA)</h2>
          <p>Regardless of your geographic location, Click affords you the following rights:</p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong>Right of Access &amp; Portability:</strong> Request a complete machine-readable copy of your personal data and project history.</li>
            <li><strong>Right to Rectification:</strong> Correct inaccurate or incomplete profile details at any time in your Settings.</li>
            <li><strong>Right to Erasure (&quot;Right to be Forgotten&quot;):</strong> Request the permanent deletion of your account, media uploads, and biometric representations.</li>
            <li><strong>Do Not Sell or Share My Information:</strong> We do not sell or share personal information for cross-context behavioral advertising.</li>
            <li><strong>Non-Discrimination:</strong> We will never deny services, charge different prices, or degrade performance because you exercised your privacy rights.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">8. Data Retention &amp; Account Deletion</h2>
          <p className="text-sm">
            We retain account data for the duration of your active subscription. You can download your data and delete your account at any time in <code>Settings &rarr; Account &amp; Security &rarr; Your data</code>, or by contacting our privacy desk. Deleting your account erases your personal data, videos and files, drafts and biometric identifiers immediately (see <a href="/data-deletion" className="text-primary-500 underline">Deleting your data</a>), except where retention is mandated by tax or legal compliance statutes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">9. Privacy Contact</h2>
          <p className="text-sm">
            If you have questions about this policy, wish to submit a Subject Access Request (SAR), or desire to exercise your privacy rights, write to us:
          </p>
          <div className="p-4 rounded-xl bg-surface-100 dark:bg-white/5 not-prose space-y-1 text-sm">
            <p><strong>Privacy requests</strong> (or use Settings → Account &amp; Security → Your data to download or delete your data yourself)</p>
            <p>Write to us through <a href="/contact?topic=privacy" className="text-primary-500 hover:underline">our contact form</a></p>
          </div>
        </section>

      </div>
    </LegalPage>
  )
}
