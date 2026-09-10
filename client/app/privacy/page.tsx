import Link from 'next/link'
import { LegalPage } from '../../components/ui/legal-page'

export const metadata = {
  title: 'Privacy Policy — Click',
  description: 'Comprehensive Privacy Policy detailing how Click collects, protects, processes, and respects creator data, biometrics, and AI media.',
}

export default function PrivacyPage() {
  return (
    <LegalPage kicker="Legal & Trust" title="Privacy Policy" updated={new Date()}>
      <div className="prose prose-invert prose-slate max-w-none space-y-8 text-surface-700 dark:text-surface-300 leading-relaxed">

        <div className="p-4 rounded-xl bg-surface-100 dark:bg-white/5 not-prose text-xs text-surface-600 dark:text-slate-400 space-y-1">
          <p><strong>Your Privacy First:</strong> We do not sell your personal data. We do not use your private drafts, voice notes, or uploaded footage to train public artificial intelligence models.</p>
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
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">5. Third-Party Sub-Processors &amp; AI Data Flow</h2>
          <p>
            To deliver enterprise-grade performance, we collaborate with vetted sub-processors bound by strict Data Processing Agreements (DPAs):
          </p>
          <div className="overflow-x-auto not-prose">
            <table className="w-full text-left text-xs border border-surface-200 dark:border-white/10 rounded-xl overflow-hidden">
              <thead className="bg-surface-100 dark:bg-white/5 text-surface-900 dark:text-white font-bold border-b border-surface-200 dark:border-white/10">
                <tr>
                  <th className="p-3">Sub-Processor</th>
                  <th className="p-3">Role / Purpose</th>
                  <th className="p-3">Data Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-white/10 text-surface-600 dark:text-surface-300">
                <tr>
                  <td className="p-3 font-semibold text-surface-900 dark:text-white">Whop Inc.</td>
                  <td className="p-3">Merchant of Record, Payment Processing &amp; Billing</td>
                  <td className="p-3">United States</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-surface-900 dark:text-white">Google Cloud (Vertex AI)</td>
                  <td className="p-3">Secure Video Rendering &amp; AI Transcription</td>
                  <td className="p-3">United States / Global</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-surface-900 dark:text-white">OpenAI LLC</td>
                  <td className="p-3">Text &amp; Script Generation, Pacing Summaries</td>
                  <td className="p-3">United States</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-surface-900 dark:text-white">HeyGen Inc.</td>
                  <td className="p-3">Avatar Lip-Sync Synthesis (Optional User Selection)</td>
                  <td className="p-3">United States</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-surface-900 dark:text-white">Supabase Inc. &amp; MongoDB</td>
                  <td className="p-3">Encrypted Cloud Database &amp; Authentication</td>
                  <td className="p-3">United States / EU</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-surface-900 dark:text-white">Functional Software (Sentry)</td>
                  <td className="p-3">Application Error &amp; Crash Diagnostics</td>
                  <td className="p-3">United States</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-surface-500 dark:text-slate-400">
            Our AI sub-processors operate under zero-retention or business API terms prohibiting the use of API payloads to train their models.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">6. International Data Transfers &amp; Security</h2>
          <p className="text-sm">
            We employ industry-standard technical and organizational security measures, including AES-256 encryption at rest, TLS 1.3 encryption in transit, strict RBAC, and automated intrusion detection. When transferring data from the European Economic Area (EEA) or UK to third countries, we utilize standard contractual clauses (SCCs) approved by the European Commission.
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
            We retain account data for the duration of your active subscription. You can delete your account at any time via <code>Settings &rarr; Delete Account</code> or by contacting our privacy desk. Upon account deletion, all personal data, video drafts, and biometric identifiers are permanently expunged within 30 days, except where retention is mandated by tax or legal compliance statutes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">9. Privacy Contact &amp; Data Protection Officer</h2>
          <p className="text-sm">
            If you have questions about this policy, wish to submit a Subject Access Request (SAR), or desire to exercise your privacy rights, contact our Data Protection Officer:
          </p>
          <div className="p-4 rounded-xl bg-surface-100 dark:bg-white/5 not-prose space-y-1 text-sm">
            <p><strong>Click Privacy Office &amp; DPO</strong></p>
            <p>Email: <a href="mailto:privacy@clickapp.io" className="text-primary-500 hover:underline">privacy@clickapp.io</a></p>
            <p>Direct Inquiries: <a href="mailto:dpo@clickapp.io" className="text-primary-500 hover:underline">dpo@clickapp.io</a></p>
          </div>
        </section>

      </div>
    </LegalPage>
  )
}
