import Link from 'next/link'
import { LegalPage } from '../../components/ui/legal-page'

export const metadata = {
  title: 'Terms of Service — Click',
  description: 'Official Terms of Service governing the use of Click, commercial ownership rights, AI synthesis, and subscriber billing.',
}

export default function TermsPage() {
  return (
    <LegalPage kicker="Legal" title="Terms of Service" updated={new Date()}>
      <div className="prose prose-invert prose-slate max-w-none space-y-8 text-surface-700 dark:text-surface-300 leading-relaxed">
        
        <div className="p-4 rounded-xl bg-surface-100 dark:bg-white/5 not-prose text-xs text-surface-600 dark:text-slate-400">
          <strong>Important Notice:</strong> These Terms contain a binding arbitration clause and class action waiver in Section 11 that affect your legal rights regarding dispute resolution. Please review them carefully.
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">1. Acceptance of Terms</h2>
          <p>
            Welcome to Click (&quot;Click&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you (&quot;User&quot;, &quot;you&quot;, or &quot;Creator&quot;) and Click, governing your access to and use of our web application, desktop applications, APIs, smart editing tools, and content distribution platform (collectively, the &quot;Service&quot;).
          </p>
          <p>
            By creating an account, connecting third-party social media accounts, or purchasing a subscription, you confirm that you are at least 18 years of age (or the legal age of majority in your jurisdiction), have the legal capacity to enter into these Terms, and agree to be bound by them in full.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">2. Commercial Ownership &amp; Intellectual Property</h2>
          <p>
            We fundamentally believe creators should own what they make:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong>Creator Ownership:</strong> As between you and Click, you retain 100% full, exclusive intellectual property ownership and commercial rights over all source videos, voice recordings, scripts, uploaded branding assets, and AI-assisted final exported video clips created using the Service.</li>
            <li><strong>Limited Operational License:</strong> You grant Click a non-exclusive, worldwide, royalty-free license solely for the technical duration and technical purpose of processing, rendering, caching, transcribing, formatting, and distributing your content as instructed by your use of the Service. Click does not sell, license, or claim ownership over your content.</li>
            <li><strong>AI Training Exclusion:</strong> Click does not use your private uploaded videos, raw audio, drafts, or internal scripts to train public generative AI foundation models without your express affirmative consent.</li>
            <li><strong>Platform IP:</strong> The Click software, algorithms, UI components, proprietary templates, icons, sound design presets, and brand identifiers remain the exclusive intellectual property of Click and its licensors.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">3. Generative AI, Digital Twins &amp; Synthetic Media Policy</h2>
          <p>
            Click incorporates advanced synthetic media capabilities, including AI voice cloning, automated lip-syncing, and Digital Twin avatar generation (powered by our proprietary rendering engine alongside integrations with providers such as HeyGen and Sora). With these capabilities comes strict legal and ethical accountability:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong>Strict Verification &amp; Consent:</strong> You warrant and represent that any audio sample, voice recording, image, or video uploaded to generate a voice clone or digital twin avatar belongs exclusively to you or that you have obtained documented, verifiable, written express consent from the subject.</li>
            <li><strong>Zero Tolerance for Non-Consensual Deepfakes:</strong> You are strictly forbidden from generating, manipulating, or distributing synthetic media depicting real individuals without their express written authorization.</li>
            <li><strong>Prohibited Deceptive Uses:</strong> You may not use Click to create defamatory media, impersonate public figures, generate counterfeit news, deceive consumers, commit fraud, or interfere with public elections.</li>
            <li><strong>Compliance with the EU AI Act &amp; Provenance Standards:</strong> In compliance with international synthetic media transparency laws (including Article 50 of the EU AI Act), Click embeds tamper-evident C2PA Content Credentials metadata within generated synthetic outputs confirming synthetic generation. You agree not to strip, alter, or falsify synthetic media disclosure labels.</li>
            <li><strong>Immediate Termination:</strong> Any breach of this Section results in immediate account termination, deletion of synthetic assets, and referral to relevant regulatory or law enforcement authorities where warranted.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">4. Subscriptions, Billing &amp; Auto-Renewal</h2>
          <p>
            Click offers subscription tiers (Free, Creator, Pro, Agency) billed on either a recurring Monthly or Annual basis:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong>Payment Processing:</strong> Payments are securely processed by our merchant partner, <strong>Whop</strong>. We do not store full credit card numbers or raw CVV codes on our servers.</li>
            <li><strong>Automatic Recurring Billing:</strong> Subscriptions automatically renew at the conclusion of each billing cycle (monthly or yearly) at the then-current plan rate unless cancelled prior to the renewal date.</li>
            <li><strong>14-Day Money-Back Guarantee:</strong> New paid subscribers are entitled to a full 100% refund within 14 calendar days of their initial purchase, as detailed in our <Link href="/refund" className="text-primary-500 hover:underline">Refund Policy</Link>.</li>
            <li><strong>1-Click Cancellation:</strong> You may cancel your subscription at any time via your Dashboard billing portal. Cancellation halts all subsequent charges; paid access remains active through the prepaid period.</li>
            <li><strong>Taxes:</strong> Fees are exclusive of applicable national, state, or local sales tax, VAT, or GST, which will be calculated and collected where legally required.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">5. Acceptable Use Policy</h2>
          <p>
            You agree not to misuse Click or assist any third party in doing so. Specifically, you agree not to:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li>Upload or distribute content that is unlawful, infringing, sexually explicit, abusive, or promoting violence or hate speech.</li>
            <li>Distribute malware, spam, phishing schemes, or automated bots that degrade our infrastructure.</li>
            <li>Probe, scan, or test the vulnerability of Click’s systems or circumvent authentication measures.</li>
            <li>Resell, sublicense, or share API credentials or subscription access across unauthorized multi-tenant organizations without an Agency tier license.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">6. Third-Party Platforms (YouTube, TikTok, Meta)</h2>
          <p>
            Click integrates with social media platforms via authorized developer APIs. When connecting or publishing to these services, you agree to comply with their respective terms of service:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">YouTube Terms of Service</a> and Google Privacy Policy.</li>
            <li><a href="https://www.tiktok.com/legal/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">TikTok Terms of Service</a> and Commercial Terms.</li>
            <li><a href="https://www.facebook.com/legal/terms" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">Meta Platform Terms</a> (Instagram / Facebook).</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">7. Disclaimer of Warranties</h2>
          <p className="text-sm">
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. CLICK DOES NOT WARRANT THAT GENERATED CONTENT OR SOCIAL REACH PREDICTIONS WILL ACHIEVE SPECIFIC AUDIENCE GROWTH OR MONETIZATION TARGETS.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">8. Limitation of Liability</h2>
          <p className="text-sm">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL CLICK, ITS DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL. CLICK’S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THESE TERMS SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU TO CLICK IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">9. Indemnification</h2>
          <p className="text-sm">
            You agree to defend, indemnify, and hold harmless Click and its affiliates from and against any claims, damages, obligations, losses, liabilities, costs, or debt arising from: (a) your use of the Service; (b) your violation of any third-party copyright, trademark, privacy, or publicity right; or (c) any non-consensual synthetic media or deepfakes generated under your account.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">10. Dispute Resolution &amp; Binding Arbitration</h2>
          <p className="text-sm">
            Before filing a formal claim, you agree to contact us at <a href="mailto:legal@clickapp.io" className="text-primary-500 hover:underline">legal@clickapp.io</a> to attempt informal resolution. Any dispute, controversy, or claim arising out of or relating to these Terms that cannot be resolved informally shall be settled by binding arbitration administered by the American Arbitration Association (AAA) or equivalent recognized arbitration provider. You and Click agree that claims will be brought only in an individual capacity and not as a plaintiff or class member in any class or representative proceeding.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">11. Modifications &amp; Governing Law</h2>
          <p className="text-sm">
            We reserve the right to modify these Terms at any time. We will notify you of material changes via email or platform notification at least 30 days prior to their effective date. These Terms are governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law principles.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">12. Contact Information</h2>
          <p className="text-sm">
            For legal inquiries, copyright notices, or contractual questions, please reach out to:
          </p>
          <div className="p-4 rounded-xl bg-surface-100 dark:bg-white/5 not-prose space-y-1 text-sm">
            <p><strong>Click Legal Affairs</strong></p>
            <p>Email: <a href="mailto:legal@clickapp.io" className="text-primary-500 hover:underline">legal@clickapp.io</a></p>
            <p>Support: <a href="mailto:support@clickapp.io" className="text-primary-500 hover:underline">support@clickapp.io</a></p>
          </div>
        </section>

      </div>
    </LegalPage>
  )
}
