import Link from 'next/link'

export const metadata = {
  title: 'Responsible AI — Click',
  description: 'How Click uses AI, what we label, what the model sees, and your rights over AI-generated outputs.',
}

export default function AiDisclosurePage() {
  return (
    <main className="min-h-screen bg-surface-page text-surface-900 dark:text-surface-50 px-6 py-24 font-inter">
      <div className="max-w-3xl mx-auto space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary-500">Compliance</p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">Responsible AI</h1>
          <p className="text-sm text-surface-500">Last updated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </header>

        <section className="space-y-4 text-surface-700 dark:text-slate-300 leading-relaxed">
          <p>
            Click uses generative AI to draft captions, suggest edits, predict performance, and
            help you publish. This page explains where AI runs, what it touches, and what you
            control — written plainly so you can decide what you&apos;re comfortable with.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Where AI is in the loop</h2>
          <ul className="space-y-3 text-sm text-surface-700 dark:text-slate-300 list-disc pl-6">
            <li><strong>Editing.</strong> Auto-cut, caption generation, pacing rewrites, color grade suggestions. You can accept, edit, or discard every suggestion.</li>
            <li><strong>Insights.</strong> Diagnostic summaries of your post performance. Numbers come from the platform&apos;s real analytics; the prose is AI-summarised from those numbers.</li>
            <li><strong>Scheduling.</strong> Posting-window recommendations are based on your historical engagement plus public platform trends. The final time is your choice.</li>
            <li><strong>Strategy.</strong> The AI Strategist answers questions using a niche playbook. It cites the framework it&apos;s using and refuses to invent statistics.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">What we do NOT do</h2>
          <ul className="space-y-3 text-sm text-surface-700 dark:text-slate-300 list-disc pl-6">
            <li>We do not auto-publish without your explicit confirmation (you can also turn on Auto-publish in Settings; it&apos;s off by default).</li>
            <li>We do not use your private content to train third-party foundation models.</li>
            <li>We do not generate AI imagery or deepfakes of real people; Click is editing-focused.</li>
            <li>We do not fabricate metrics. If the AI doesn&apos;t have a number, it says so instead of inventing one.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Disclosure when you publish</h2>
          <p className="text-sm text-surface-700 dark:text-slate-300">
            Click is built for human-led creation with AI assistance. Some platforms (TikTok,
            Meta, YouTube) require creators to disclose substantially AI-generated content
            when posting. We surface a reminder in the publish flow when AI authored a meaningful
            portion of the caption or the edit was fully AI-generated. The disclosure is your
            responsibility to apply on the destination platform; we don&apos;t override your
            platform&apos;s built-in AI-label flag.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Models we use</h2>
          <p className="text-sm text-surface-700 dark:text-slate-300">
            Click routes prompts through Google Gemini and OpenAI&apos;s GPT-4 family,
            selected per task for quality and latency. Both providers operate under their own
            terms; we send only the text, metadata, and media URLs needed to fulfil the request,
            and we instruct them not to log inputs for training where their API permits it.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Bias &amp; accuracy</h2>
          <p className="text-sm text-surface-700 dark:text-slate-300">
            AI models can reflect biases in their training data. Our niche playbooks are
            written to include diverse angles (single-parent and LGBTQ+ family content,
            barrier-repair beauty, debt-payoff finance, culturally-rooted wellness, etc.) and
            our prompts explicitly tell the model to stay neutral on gender/race/age/body
            unless the topic calls for one. If you see biased output, please report it to
            {' '}<a href="mailto:safety@clickapp.io" className="text-primary-500 hover:underline">safety@clickapp.io</a>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Your rights</h2>
          <ul className="space-y-3 text-sm text-surface-700 dark:text-slate-300 list-disc pl-6">
            <li><strong>Human review.</strong> Every AI suggestion is reviewable before it ships.</li>
            <li><strong>Opt out of learning.</strong> Disable autonomous mode in{' '}
              <Link href="/dashboard/settings" className="text-primary-500 hover:underline">Settings → AI agent</Link>
              {' '}to stop Click from biasing future prompts based on your past picks.
            </li>
            <li><strong>Export &amp; delete.</strong> Request a copy of your data or delete your account from{' '}
              <Link href="/dashboard/settings" className="text-primary-500 hover:underline">Settings</Link>.
            </li>
            <li><strong>EU AI Act.</strong> We classify Click&apos;s use cases as Limited Risk (general-purpose
              creative tooling with disclosure obligations). We do not perform prohibited or
              high-risk processing (biometrics, social scoring, employment decisions).</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Contact</h2>
          <p className="text-sm text-surface-700 dark:text-slate-300">
            AI questions or concerns?{' '}
            <a href="mailto:ai@clickapp.io" className="text-primary-500 hover:underline">ai@clickapp.io</a>
          </p>
        </section>

        <footer className="pt-10 border-t border-surface-100 dark:border-surface-800 text-xs text-surface-400">
          <Link href="/" className="hover:text-primary-500">← Back to home</Link>
        </footer>
      </div>
    </main>
  )
}
