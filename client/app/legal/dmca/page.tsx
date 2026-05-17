'use client';

import { useState } from 'react';
import Link from 'next/link';

type Mode = 'notice' | 'counter';

export default function DmcaPage() {
  const [mode, setMode] = useState<Mode>('notice');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      if (k === 'sworn' || k === 'goodFaith' || k === 'consent') {
        payload[k] = v === 'on';
      } else {
        payload[k] = v;
      }
    });

    try {
      const res = await fetch(`/api/dmca/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const body = await res.json();
      setDone({ id: body.id || body.referenceId || 'submitted' });
      (e.currentTarget as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/trust"
          className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-white uppercase tracking-widest font-bold mb-12"
        >
          ← Trust Center
        </Link>

        <div className="mb-2 text-xs uppercase tracking-[0.4em] text-indigo-400 font-black">DMCA</div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-6">Copyright takedown.</h1>
        <p className="text-slate-400 text-lg leading-relaxed mb-10">
          Click respects copyright. Use this form to file a takedown notice under 17 U.S.C. §512(c)
          or a counter-notice under §512(g). Knowingly false statements may carry liability under §512(f).
          Our designated DMCA agent: <strong className="text-white">Click, Inc. — dmca@click.example</strong>.
        </p>

        {/* Tab toggle */}
        <div className="inline-flex border border-white/10 rounded-xl overflow-hidden mb-8">
          <button
            onClick={() => { setMode('notice'); setDone(null); setError(null); }}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${
              mode === 'notice' ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-400 hover:text-white'
            }`}
          >
            Takedown notice
          </button>
          <button
            onClick={() => { setMode('counter'); setDone(null); setError(null); }}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${
              mode === 'counter' ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-400 hover:text-white'
            }`}
          >
            Counter-notice
          </button>
        </div>

        {done ? (
          <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-2xl p-6">
            <div className="text-emerald-300 font-black mb-2">Submitted.</div>
            <p className="text-slate-300 leading-relaxed">
              Reference: <span className="font-mono">{done.id}</span>. We will email you when we
              act on this notice. Most takedowns are processed within 48 hours.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Field name="fullName" label="Full legal name" required />
            <Field name="email" label="Email" type="email" required />
            <Field name="phone" label="Phone number" />
            <Field name="address" label="Mailing address" required />
            {mode === 'notice' ? (
              <>
                <Field name="rightsHolder" label="Rights holder you represent (self or company)" required />
                <Field name="workDescription" label="Description of the copyrighted work" required textarea />
                <Field name="infringingUrl" label="URL or identifier of the allegedly infringing material on Click" required textarea />
                <Checkbox name="goodFaith" required>
                  I have a good-faith belief that the use described is not authorized by the
                  copyright owner, its agent, or the law.
                </Checkbox>
                <Checkbox name="sworn" required>
                  Under penalty of perjury, the information in this notice is accurate, and I am
                  authorized to act on behalf of the rights holder.
                </Checkbox>
              </>
            ) : (
              <>
                <Field name="originalNoticeId" label="Reference ID of the original takedown notice (if known)" />
                <Field name="removedContent" label="Description / URL of the content that was removed" required textarea />
                <Field name="counterReason" label="Reason you believe removal was a mistake or misidentification" required textarea />
                <Checkbox name="sworn" required>
                  Under penalty of perjury, I have a good-faith belief that the material was
                  removed or disabled as a result of mistake or misidentification.
                </Checkbox>
                <Checkbox name="consent" required>
                  I consent to the jurisdiction of the federal district court where my address is
                  located (or, if outside the US, any judicial district where Click may be found),
                  and I will accept service of process from the person who filed the original
                  notice or their agent.
                </Checkbox>
              </>
            )}

            <div>
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 block">
                Electronic signature (type your full name)
              </label>
              <input
                name="signature"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500/50 focus:outline-none"
              />
            </div>

            {error && (
              <div className="border border-rose-500/30 bg-rose-500/5 rounded-xl p-4 text-rose-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-sm transition-colors"
            >
              {submitting ? 'Submitting…' : mode === 'notice' ? 'Submit takedown' : 'Submit counter-notice'}
            </button>
          </form>
        )}

        <p className="text-slate-500 text-xs mt-12 leading-relaxed">
          You can also submit by email to <a href="mailto:dmca@click.example" className="text-indigo-400 hover:text-indigo-300 underline">dmca@click.example</a> or by post to Click, Inc., DMCA Agent, 1 Market St., Wilmington DE 19801, USA.
        </p>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required,
  textarea,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 block">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      {textarea ? (
        <textarea
          name={name}
          required={required}
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500/50 focus:outline-none"
        />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500/50 focus:outline-none"
        />
      )}
    </div>
  );
}

function Checkbox({ name, required, children }: { name: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        name={name}
        type="checkbox"
        required={required}
        className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 accent-indigo-600 shrink-0"
      />
      <span className="text-sm text-slate-300 leading-relaxed">{children}</span>
    </label>
  );
}
