'use client'

import { useState } from 'react'
import { triageComments } from '@/lib/featuresApi'
import { parseCommentLines, groupTriageByPriority, priorityMeta } from '@/lib/featureViewModels'

type Groups = ReturnType<typeof groupTriageByPriority>

/**
 * Paste an inbox of comments (one per line) → rank them by reply priority.
 * Container: owns the input + call to /api/triage, renders grouped results.
 */
export default function CommentTriageInbox() {
  const [text, setText] = useState('')
  const [groups, setGroups] = useState<Groups | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    const comments = parseCommentLines(text)
    if (!comments.length) { setError('Paste some comments first (one per line).'); return }
    setLoading(true); setError(null)
    try {
      const res = await triageComments(comments)
      setGroups(groupTriageByPriority(res.ranked))
    } catch (e) {
      setError((e as Error)?.message || 'Failed to triage comments')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">Comment triage</h2>
      <textarea
        data-testid="triage-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste comments, one per line…"
        rows={4}
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-sm text-zinc-200"
      />
      <button
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
                  <li key={cm.id ?? i} data-testid="triage-item" className="text-sm text-zinc-300">
                    <span className="text-zinc-500">[{cm.intent}]</span> {cm.text}
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
