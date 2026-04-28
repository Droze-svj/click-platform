import Link from 'next/link';
import { Mail, MessageCircle, Building2 } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-white uppercase tracking-widest font-bold mb-12"
        >
          ← Back to home
        </Link>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-6">Get in Touch</h1>
        <p className="text-slate-400 text-lg font-medium leading-relaxed mb-12 max-w-2xl">
          We answer fast. Pick the channel that fits, and we’ll route from there.
        </p>

        <div className="grid sm:grid-cols-3 gap-4">
          <a
            href="mailto:hello@click.example"
            className="group p-7 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-indigo-500/30 hover:-translate-y-1 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mb-5 text-indigo-300 group-hover:scale-110 transition-transform">
              <Mail className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-black mb-2 tracking-tight">General</h2>
            <p className="text-sm text-slate-400 font-medium">
              Questions about the product, integrations, or partnerships.
            </p>
            <p className="mt-4 text-sm text-indigo-300 font-bold">hello@click.example</p>
          </a>

          <a
            href="mailto:support@click.example"
            className="group p-7 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/30 hover:-translate-y-1 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-5 text-emerald-300 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-black mb-2 tracking-tight">Support</h2>
            <p className="text-sm text-slate-400 font-medium">
              Account, billing, or something’s broken — we’re on it.
            </p>
            <p className="mt-4 text-sm text-emerald-300 font-bold">support@click.example</p>
          </a>

          <a
            href="mailto:sales@click.example?subject=Agency%20Plan%20Inquiry"
            className="group p-7 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-amber-500/30 hover:-translate-y-1 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-5 text-amber-300 group-hover:scale-110 transition-transform">
              <Building2 className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-black mb-2 tracking-tight">Agencies</h2>
            <p className="text-sm text-slate-400 font-medium">
              Volume pricing, white-label, custom AI playbooks — let’s talk.
            </p>
            <p className="mt-4 text-sm text-amber-300 font-bold">sales@click.example</p>
          </a>
        </div>
      </div>
    </div>
  );
}
