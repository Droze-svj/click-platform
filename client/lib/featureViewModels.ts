// Pure view-model helpers for the creator-feature UI. Kept separate from the
// components so the logic (parsing, grouping, labels) is unit-testable without
// rendering.

import type { TriagedComment, TriagePriority } from './featuresApi'

// ── Comment triage ───────────────────────────────────────────────────────────

/** Split a pasted block of comments (one per line) into triage inputs. */
export function parseCommentLines(text: string): { text: string }[] {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((t) => ({ text: t }))
}

// Display order: act on these first → last.
export const PRIORITY_ORDER: TriagePriority[] = ['high', 'medium', 'low', 'ignore']

const PRIORITY_META: Record<TriagePriority, { label: string; tone: string }> = {
  high: { label: 'Reply first', tone: 'text-red-400' },
  medium: { label: 'When you can', tone: 'text-amber-400' },
  low: { label: 'Optional', tone: 'text-zinc-400' },
  ignore: { label: 'Skip (spam)', tone: 'text-zinc-600' },
}

export function priorityMeta(p: TriagePriority) {
  return PRIORITY_META[p] ?? PRIORITY_META.low
}

/** Group a triaged list by priority, in display order (empty buckets omitted). */
export function groupTriageByPriority(
  ranked: TriagedComment[],
): { priority: TriagePriority; comments: TriagedComment[] }[] {
  const buckets = new Map<TriagePriority, TriagedComment[]>()
  for (const c of ranked || []) {
    const arr = buckets.get(c.priority) || []
    arr.push(c)
    buckets.set(c.priority, arr)
  }
  return PRIORITY_ORDER
    .filter((p) => buckets.has(p))
    .map((p) => ({ priority: p, comments: buckets.get(p) as TriagedComment[] }))
}

// ── Weekly digest ────────────────────────────────────────────────────────────

export type DigestTrend = 'up' | 'down' | 'stable' | 'new'

/** Arrow + tone + human label for a week-over-week trend and % change. */
export function trendMeta(trend: DigestTrend, changePct: number | null) {
  const pct = changePct == null ? null : `${changePct > 0 ? '+' : ''}${changePct}%`
  switch (trend) {
    case 'up': return { arrow: '▲', tone: 'text-green-400', label: pct ? `Up ${pct}` : 'Up' }
    case 'down': return { arrow: '▼', tone: 'text-red-400', label: pct ? `Down ${pct}` : 'Down' }
    case 'stable': return { arrow: '▬', tone: 'text-zinc-400', label: pct ? `Flat (${pct})` : 'Flat' }
    default: return { arrow: '✦', tone: 'text-blue-400', label: 'New' }
  }
}

/** Compact number for engagement/reach display (1.2k, 3.4M). */
export function compactNumber(n: number | undefined | null): string {
  const v = Number(n) || 0
  if (v >= 1_000_000) return `${Math.round(v / 100_000) / 10}M`
  if (v >= 1_000) return `${Math.round(v / 100) / 10}k`
  return String(v)
}
