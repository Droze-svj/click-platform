import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-white uppercase tracking-widest font-bold mb-12"
        >
          ← Back to home
        </Link>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-8">Privacy Policy</h1>
        <p className="text-slate-400 text-sm font-medium mb-12">
          Effective: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <div className="prose prose-invert prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-black mb-4 tracking-tight">What we collect</h2>
            <p className="text-slate-300 leading-relaxed">
              When you use Click we collect: account info you give us (name, email, password hash), the content you upload or generate, the social accounts you connect via OAuth, and product-usage telemetry (clicks, errors, feature engagement). We never sell that data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black mb-4 tracking-tight">What we do with it</h2>
            <p className="text-slate-300 leading-relaxed">
              We process your content to deliver the service — AI editing, transcription, scheduling, publishing. We use telemetry to make Click better. We use your email only for transactional messages and product updates you opted into. You can opt out of product emails at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black mb-4 tracking-tight">Who we share with</h2>
            <p className="text-slate-300 leading-relaxed">
              Sub-processors only — Google AI for transcription/captions, the social platforms you authorize for publishing, our payment processor (Whop), our hosting (Render, Vercel), and our error tracker (Sentry). Each gets the minimum data required for the function.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black mb-4 tracking-tight">Your rights</h2>
            <p className="text-slate-300 leading-relaxed">
              Export everything, delete everything, correct anything — we honor it within 30 days. Email{' '}
              <a href="mailto:privacy@click.example" className="text-indigo-400 hover:text-indigo-300 underline">
                privacy@click.example
              </a>
              .
            </p>
          </section>

          <p className="text-slate-500 text-sm mt-16">
            This is a placeholder policy. Replace with your real legal text before launch.
          </p>
        </div>
      </div>
    </div>
  );
}
