import Link from 'next/link'
import { LegalPage } from '../../components/ui/legal-page'

export const metadata = {
  title: 'Refund & Cancellation Policy — Click',
  description: 'Understand Click’s 14-day money-back guarantee, 1-click cancellation process, and statutory consumer rights.',
}

export default function RefundPage() {
  return (
    <LegalPage kicker="Billing & Legal" title="Refund & Cancellation Policy" updated={new Date()}>
      <div className="prose prose-invert prose-slate max-w-none space-y-8 text-surface-700 dark:text-surface-300 leading-relaxed">
        
        {/* Highlight Callout */}
        <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 not-prose space-y-2">
          <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm tracking-wide uppercase">
            <span>🛡️ 14-Day Money-Back Guarantee</span>
          </div>
          <p className="text-sm text-surface-800 dark:text-surface-200">
            We want you to love creating with Click. If you are not completely satisfied with your first paid subscription plan, you are entitled to a 100% full refund within 14 calendar days of purchase — no questions asked and zero retention hurdles.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">1. Overview</h2>
          <p>
            This Refund and Cancellation Policy governs all purchases, recurring subscriptions, and billing transactions conducted through Click (the &quot;Service&quot;), operated in partnership with our authorized merchant of record and payment infrastructure provider, <strong>Whop</strong>.
          </p>
          <p>
            By subscribing to any Click paid tier (Creator, Pro, Agency), you explicitly acknowledge and agree to the terms set forth herein, in conjunction with our <Link href="/terms" className="text-primary-500 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-primary-500 hover:underline">Privacy Policy</Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">2. The 14-Day Money-Back Guarantee</h2>
          <p>
            All first-time purchases of Click monthly or yearly subscription plans are covered by our 14-Day Money-Back Guarantee:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong>Eligibility Window:</strong> You must submit your refund request within 14 calendar days of the initial transaction timestamp.</li>
            <li><strong>Scope:</strong> Applies to your initial subscription term. Subsequent automated renewals are not eligible for the 14-day money-back guarantee unless required by applicable statutory consumer law.</li>
            <li><strong>No Usage Penalty:</strong> Even if you processed videos, created voice clones, or scheduled clips during those 14 days, you remain fully eligible for a full refund.</li>
            <li><strong>Reversal Method:</strong> Refunds are credited directly back to the original payment method (Credit Card, Apple Pay, Google Pay) via Whop within 3–7 business days, depending on your financial institution.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">3. 1-Click Cancellation Anytime</h2>
          <p>
            We believe in complete subscriber autonomy. You can cancel your subscription at any time without talking to a sales representative or navigating complex retention funnels:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong>Self-Serve Dashboard:</strong> Navigate to <code>Dashboard &rarr; Billing</code> and click &quot;Manage Subscription&quot; to cancel directly, or log in to your Whop customer portal.</li>
            <li><strong>Immediate Effect:</strong> Cancellation stops all future scheduled charges immediately.</li>
            <li><strong>Retention of Paid Access:</strong> When you cancel, your account does not shut down instantly. You retain full access to your plan’s features, quotas, and limits until the very end of your prepaid billing period.</li>
            <li><strong>Graceful Transition to Free:</strong> After your billing period ends, your account transitions to the Free tier. All your saved drafts, uploaded media, and exported videos remain accessible and owned by you.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">4. Annual Subscriptions &amp; Mid-Cycle Changes</h2>
          <p>
            For creators on Annual billing cycles:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong>Initial 14 Days:</strong> Eligible for a 100% full refund under our guarantee.</li>
            <li><strong>After 14 Days:</strong> Annual subscriptions are committed for the 12-month discounted term. Mid-cycle cancellations prevent renewal for subsequent years, and access continues through the remainder of the 12-month term. Prorated refunds for unused months after day 14 are evaluated on a case-by-case basis for exceptional circumstances (such as prolonged documented service outages).</li>
            <li><strong>Plan Upgrades:</strong> Upgrades between tiers (e.g. Creator to Pro) are prorated automatically. Any unused portion of your existing subscription is credited toward the upgraded tier.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">5. Statutory Consumer Rights (EU, UK &amp; International)</h2>
          <p>
            If you reside in the European Union, United Kingdom, or jurisdictions with statutory consumer cooling-off rights:
          </p>
          <p className="text-sm">
            Under Directive 2011/83/EU on Consumer Rights, you possess the statutory right to withdraw from a distance contract within 14 days without giving any reason. Our 14-Day Money-Back Guarantee fully satisfies and honors this statutory right without any waiver prerequisites.
          </p>
          <p className="text-sm">
            If you reside in Australia, our services come with statutory guarantees that cannot be excluded under the Australian Consumer Law (ACL). You are entitled to a replacement or refund for a major failure and compensation for any other reasonably foreseeable loss or damage.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">6. Chargebacks and Friendly Dispute Resolution</h2>
          <p>
            We strive to resolve any billing confusion quickly and fairly. If you notice an unexpected charge or billing discrepancy, we ask that you contact our support team at <a href="mailto:billing@clickapp.io" className="text-primary-500 hover:underline">billing@clickapp.io</a> before initiating a bank chargeback or dispute.
          </p>
          <p className="text-sm">
            Bank chargebacks can freeze account access and incur third-party administrative processing fees. In almost all instances, our support team can issue direct refunds and resolve billing inquiries faster than bank arbitration.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">7. How to Request a Refund</h2>
          <p>
            To claim your 14-day refund or request billing assistance, submit a request through any of the following channels:
          </p>
          <div className="p-4 rounded-xl bg-surface-100 dark:bg-white/5 not-prose space-y-2 text-sm">
            <p><strong>Email:</strong> <a href="mailto:billing@clickapp.io" className="text-primary-500 hover:underline">billing@clickapp.io</a></p>
            <p><strong>Subject Line:</strong> Refund Request — [Your Account Email]</p>
            <p><strong>Information to Include:</strong> Your account email, transaction ID or invoice number (available on your Billing page).</p>
            <p className="text-xs text-surface-500 dark:text-slate-400 mt-2">
              Our billing desk processes verified refund requests within 24–48 business hours.
            </p>
          </div>
        </section>

      </div>
    </LegalPage>
  )
}
