'use client'

import { useEffect, useState } from 'react'
import {
  triageComments, draftReply, getResponderPlatforms,
  type Platform, type ResponderPlatform, type TriagedComment,
} from '@/lib/featuresApi'
import { parseCommentLines, groupTriageByPriority, priorityMeta } from '@/lib/featureViewModels'

type Groups = ReturnType<typeof groupTriageByPriority>

// Fallback list if the platforms endpoint is unavailable; canSend unknown → true
// so drafting is never blocked (the send step itself is the real gate).
const FALLBACK_PLATFORMS: ResponderPlatform[] = [
  'instagram', 'youtube', 'twitter', 'linkedin', 'facebook',
].map((name) => ({ name: name as Platform, canSend: true }))

/**
 * Paste an inbox of comments (one per line) → rank by reply priority, then draft
 * an AI reply for the ones worth answering (feeds the responder approval queue).
 */
export default function CommentTriageInbox() {
  const [text, setText] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [groups, setGroups] = useState<Groups | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Per-comment draft state, keyed by the comment text (lines are distinct).
  const [drafting, setDrafting] = useState<Record<string, boolean>>({})
  const [drafted, setDrafted] = useState<Record<string, boolean>>({})
  const [platforms, setPlatforms] = useState<ResponderPlatform[]>(FALLBACK_PLATFORMS)

  // Source the reply-target list from the backend so we only offer platforms
  // that can actually send (skips e.g. tiktok, which would 501 on send).
  useEffect(() => {
    let alive = true
    getResponderPlatforms()
      .then((res) => {
        if (!alive || !res?.platforms?.length) return
        const sendable = res.platforms.filter((p) => p.canSend)
        const list = sendable.length ? sendable : res.platforms
        setPlatforms(list)
        setPlatform((cur) => (list.some((p) => p.name === cur) ? cur : list[0].name))
      })
      .catch(() => { /* keep fallback list */ })
    return () => { alive = false }
  }, [])

  async function run() {
    const comments = parseCommentLines(text)
    if (!comments.length) { setError('Paste some comments first (one per line).'); return }
    setLoading(true); setError(null); setDrafted({})
    try {
      const res = await triageComments(comments)
      setGroups(groupTriageByPriority(res.ranked))
    } catch (e) {
      setError((e as Error)?.message || 'Failed to triage comments')
    } finally {
      setLoading(false)
    }
  }

  async function draft(cm: TriagedComment) {
    const key = cm.text
    setDrafting((d) => ({ ...d, [key]: true })); setError(null)
    try {
      await draftReply({ platform, inboundText: cm.text, author: cm.author })
      setDrafted((d) => ({ ...d, [key]: true }))
    } catch (e) {
      setError((e as Error)?.message || 'Failed to draft reply')
    } finally {
      setDrafting((d) => ({ ...d, [key]: false }))
    }
  }

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Comment triage</h2>
        <select
          data-testid="triage-platform"
          aria-label="Reply platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded bg-zinc-950 border border-zinc-800 p-1 text-xs text-zinc-300"
        >
          {platforms.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      <textarea
        data-testid="triage-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste comments, one per line…"
        rows={4}
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200"
      />
      <button
        type="button"
        data-testid="triage-run"
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-green-500/90 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
      >
        {loading ? 'Triaging…' : 'Triage inbox'}
      </button>

      {error && <p data-testid="triage-error" className="text-sm text-red-400">{error}</p>}

      {groups && groups.length > 0 && (
        <div className="space-y-3" data-testid="triage-results">
          {groups.map((g) => (
            <section key={g.priority} data-testid={`group-${g.priority}`}>
              <h3 className={`text-xs font-medium ${priorityMeta(g.priority).tone}`}>
                {priorityMeta(g.priority).label} ({g.comments.length})
              </h3>
              <ul className="mt-1 space-y-1">
                {g.comments.map((cm, i) => (
                  <li key={cm.id ?? `${g.priority}-${i}`} data-testid="triage-item" className="flex items-center gap-2 text-sm text-zinc-300">
                    <span className="flex-1"><span className="text-zinc-500">[{cm.intent}]</span> {cm.text}</span>
                    {/* Reply-worthy items (not spam) get a one-click AI draft → responder queue. */}
                    {g.priority !== 'ignore' && (
                      drafted[cm.text]
                        ? <span data-testid="triage-drafted" className="text-xs text-green-400 whitespace-nowrap">Queued ✓</span>
                        : (
                          <button
                            type="button"
                            data-testid="triage-draft"
                            onClick={() => draft(cm)}
                            disabled={drafting[cm.text]}
                            className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200 disabled:opacity-50 whitespace-nowrap"
                          >
                            {drafting[cm.text] ? 'Drafting…' : 'Draft reply'}
                          </button>
                        )
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {groups && groups.length === 0 && (
        <p className="text-sm text-zinc-500" data-testid="triage-empty">No comments to rank.</p>
      )}
    </div>
  )
}
