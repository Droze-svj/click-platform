import Link from 'next/link'
import { LegalPage } from '../../components/ui/legal-page'

export const metadata = {
  title: 'Responsible AI & Synthetic Media Disclosure — Click',
  description: 'How Click uses AI, Digital Twin synthesis, voice cloning consent, C2PA content credentials, and compliance with the EU AI Act.',
}

export default function AiDisclosurePage() {
  return (
    <LegalPage kicker="Compliance & Trust" title="Responsible AI & Synthetic Media Disclosure" updated={new Date()}>
      <div className="prose prose-invert prose-slate max-w-none space-y-8 text-surface-700 dark:text-surface-300 leading-relaxed">
        
        <div className="p-4 rounded-xl bg-surface-100 dark:bg-white/5 not-prose text-xs text-surface-600 dark:text-slate-400 space-y-1">
          <p><strong>Transparency Commitment:</strong> Click empowers human creators with intelligent AI workflows. We design our AI tools to respect creator ownership, ensure biometric consent, and embed cryptographic provenance in synthetic media.</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">1. Where AI is Active in Click</h2>
          <p>
            Click utilizes generative artificial intelligence and neural processing across specific creative dimensions:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong>Intelligent Video Editing:</strong> Automated silence removal, jump-cut sequencing, dynamic zoom placement, and color grading recommendations.</li>
            <li><strong>Speech-to-Text &amp; Kinetic Captions:</strong> Multilingual audio transcription with word-level timing offsets for animated subtitles and emoji synchronization.</li>
            <li><strong>Digital Twin Avatar Generation:</strong> High-fidelity talking head video synthesis from audio voice notes and verified creator avatars (leveraging our rendering pipeline with HeyGen and Sora integrations).</li>
            <li><strong>Creator Taste Graph:</strong> Non-intrusive tracking of your stylistic preferences (favorite fonts, cut pacing) to organize suggested templates without training public models.</li>
            <li><strong>Publishing &amp; Distribution Optimization:</strong> Platform-specific hook generation, hashtag recommendations, and engagement prediction based on public performance indicators.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">2. Synthetic Media &amp; Digital Twin Guardrails</h2>
          <p>
            Because Click can synthesize realistic vocal delivery and talking head videos, we enforce strict legal and safety guardrails:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong>Mandatory Self-Identity or Documented Consent:</strong> You may only generate voice clones and digital twin avatars of yourself, or of individuals who have provided explicit, written, verifiable consent.</li>
            <li><strong>Absolute Prohibition on Non-Consensual Deepfakes:</strong> Click strictly forbids the creation of sexually explicit synthetic media, non-consensual deepfakes of real persons, defamatory content, financial impersonation, or political election deception.</li>
            <li><strong>Automated Content Screening:</strong> Inputs and prompts are screened against safety models for prohibited categories, harassment, and harmful material.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">3. EU AI Act Compliance (Article 50 Transparency)</h2>
          <p>
            In alignment with the European Union Artificial Intelligence Act (Regulation EU 2024/1689), specifically Article 50 transparency obligations:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong>Marking of Synthetic Content:</strong> Deployers and users generating synthetic audio, image, video, or text content that resembles existing persons or events must ensure the outputs are marked in a machine-readable format and detectable as artificially generated.</li>
            <li><strong>Cryptographic Provenance (C2PA):</strong> Click integrates C2PA (Coalition for Content Provenance and Authenticity) manifest embedding into our video rendering pipeline. When you export an AI avatar video or heavily synthesized sequence, machine-readable provenance metadata is embedded into the media container.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">4. Social Platform Labeling Requirements</h2>
          <p>
            Major social networks (TikTok, YouTube, Instagram, Facebook) require creators to disclose when content is substantially generated or altered by AI:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong>TikTok:</strong> Requires toggling the &quot;AI-generated content&quot; switch when posting synthetic videos depicting realistic people or scenes.</li>
            <li><strong>YouTube:</strong> Mandates the &quot;Altered or synthetic content&quot; label during upload for realistic synthetic media.</li>
            <li><strong>Meta (Instagram &amp; Facebook):</strong> Applies or requires the &quot;AI info&quot; label for synthetic visual content.</li>
          </ul>
          <p className="text-xs text-surface-500 dark:text-slate-400">
            Click surfaces automatic reminders in our Smart Publishing modal to ensure you remain fully compliant with destination platform policies.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">5. Foundation Models &amp; Data Confidentiality</h2>
          <p>
            Click interfaces with enterprise APIs from Google Cloud (Vertex AI / Gemini) and OpenAI under commercial confidentiality terms:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li>Your prompts, audio files, and video streams are transmitted over encrypted TLS 1.3 channels.</li>
            <li>Our enterprise API agreements expressly exclude customer payload data from being utilized to train foundation models.</li>
            <li>Temporary processing artifacts (such as intermediate spectrograms or phoneme alignments) are automatically purged upon render completion.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">6. Reporting Violations &amp; Inquiries</h2>
          <p className="text-sm">
            If you believe content generated via Click violates our synthetic media policies or infringes upon your publicity rights, please submit an immediate notice to our trust and safety desk:
          </p>
          <div className="p-4 rounded-xl bg-surface-100 dark:bg-white/5 not-prose space-y-1 text-sm">
            <p><strong>Trust &amp; Safety / AI Compliance</strong></p>
            <p>Email: <a href="mailto:safety@clickapp.io" className="text-primary-500 hover:underline">safety@clickapp.io</a></p>
            <p>Legal &amp; Copyright: <Link href="/legal/dmca" className="text-primary-500 hover:underline">DMCA Portal</Link></p>
          </div>
        </section>

      </div>
    </LegalPage>
  )
}
