import Link from 'next/link';

export const metadata = {
  title: 'Compliance — Click',
  description:
    "Click's regulatory posture: EU AI Act, GDPR/UK GDPR, CCPA/CPRA, COPPA, FTC, accessibility.",
};

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/trust"
          className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-white uppercase tracking-widest font-bold mb-12"
        >
          ← Trust Center
        </Link>

        <div className="mb-2 text-xs uppercase tracking-[0.4em] text-indigo-400 font-black">Compliance Notice</div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-8">Regulatory posture.</h1>
        <p className="text-slate-400 text-lg leading-relaxed mb-12">
          A plain-language summary of the laws Click follows, how we apply them, and where to
          find authoritative documentation. This page is summary; the binding documents are our{' '}
          <Link href="/terms" className="text-indigo-400 hover:text-indigo-300 underline">Terms</Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 underline">Privacy Policy</Link>.
        </p>

        <div className="space-y-10">
          <Reg
            title="EU AI Act (Regulation 2024/1689)"
            classification="Limited-risk"
            details={[
              "Click is a general-purpose creative-AI tool. Outputs that are wholly or substantially AI-generated carry a visible AI-disclosure marker and a C2PA provenance manifest, satisfying Art. 50 transparency obligations for synthetic content.",
              "We perform a written AI risk assessment and review it at least annually. Available under NDA at trust@click.example.",
              "We do not deploy prohibited practices (Art. 5): no social scoring, no real-time remote biometric ID, no exploitation of vulnerabilities by age/disability/socioeconomic status.",
              "We monitor for systemic risk in any model classified as GPAI with systemic risk under Art. 51.",
            ]}
          />

          <Reg
            title="GDPR (EU) 2016/679 & UK GDPR"
            classification="In scope"
            details={[
              "Lawful bases: contract, legitimate interests, consent (granular), legal obligation. Documented in the Privacy Policy §3.",
              "Records of Processing Activities (RoPA) maintained internally.",
              "Data Protection Impact Assessments (DPIA) on high-risk processing (biometric voice cloning, face tracking).",
              "Standard Contractual Clauses + UK IDTA for EU/UK→US transfers; supplementary measures: encryption, access logs, vendor due diligence.",
              "Data subject rights served within 30 days (extendable to 90).",
              "EU representative appointed (Art. 27): Click EU GmbH, Berlin.",
              "DPO contact: privacy@click.example.",
            ]}
          />

          <Reg
            title="CCPA / CPRA (California)"
            classification="In scope"
            details={[
              "We do not 'sell' or 'share' personal information for cross-context behavioral advertising. The Do-Not-Sell-or-Share link is provided regardless.",
              "California consumers may request to know, delete, correct, limit use of sensitive PI, and not be discriminated against for exercising rights.",
              "Authorized-agent requests accepted; identity verified before fulfilling.",
              "Disclosure under CCPA §1798.130 in Privacy Policy §2.",
            ]}
          />

          <Reg
            title="COPPA (US)"
            classification="In scope"
            details={[
              "Click is not directed to children under 13.",
              "Signup requires date of birth and is rejected server-side for under-13.",
              "Users 13–17 require verifiable parental/guardian consent before account activation.",
              "Children's data, if discovered, is deleted within 7 days; complaints to privacy@click.example.",
            ]}
          />

          <Reg
            title="FTC Act §5 — endorsement, AI claims"
            classification="In scope"
            details={[
              "Performance claims about Click are tested before publication.",
              "If you publish sponsored content using Click, you must disclose it clearly and conspicuously per the FTC Endorsement Guides (16 CFR Part 255). Click provides templates but you remain responsible.",
              "AI-assistance disclosure is applied automatically to generated outputs (visible marker + C2PA).",
            ]}
          />

          <Reg
            title="DMCA (17 USC §512)"
            classification="In scope"
            details={[
              "Designated agent registered with the US Copyright Office: Click, Inc., dmca@click.example.",
              "File a takedown or counter-notice at /legal/dmca.",
              "Repeat infringers terminated.",
            ]}
          />

          <Reg
            title="Platform Terms (TikTok, YouTube, Instagram, X, LinkedIn)"
            classification="Pass-through"
            details={[
              "When you connect a platform via OAuth, your use is also governed by that platform's Terms.",
              "Click requests minimum required scopes and revokes tokens you remove from Settings within 24 hours.",
            ]}
          />

          <Reg
            title="Accessibility — WCAG 2.2 AA"
            classification="Target conformance"
            details={[
              "We design for keyboard-only navigation, screen-reader landmarks, focus visibility, and 4.5:1 contrast minimum on body text.",
              "Annual accessibility audit with remediation plan; current report available on request.",
              "Found a barrier? a11y@click.example.",
            ]}
          />

          <Reg
            title="Payments — PCI-DSS"
            classification="Out of Click's scope (SAQ-A path)"
            details={[
              "All cardholder data is captured by our payment processor (Whop / Stripe) directly via hosted/iframed elements. Click never receives PAN, CVV, or full track data.",
              "We rely on the processor's PCI-DSS Level 1 attestation.",
            ]}
          />
        </div>

        <p className="text-slate-500 text-sm mt-16 leading-relaxed">
          Questions: <a href="mailto:compliance@click.example" className="text-indigo-400 hover:text-indigo-300 underline">compliance@click.example</a>.
        </p>
      </div>
    </div>
  );
}

function Reg({ title, classification, details }: { title: string; classification: string; details: string[] }) {
  return (
    <section className="border border-white/10 rounded-2xl p-6 bg-white/[0.02]">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <h2 className="text-xl font-black tracking-tight">{title}</h2>
        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 whitespace-nowrap">
          {classification}
        </span>
      </div>
      <ul className="text-slate-300 leading-relaxed list-disc pl-6 space-y-2 text-sm">
        {details.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
    </section>
  );
}
