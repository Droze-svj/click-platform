/**
 * editorGroups.ts — taxonomy that collapses the editor's ~30 categories into
 * six top-level groups. The sidebar renders these as collapsible headers with
 * the original categories nested underneath, so users see one of:
 *
 *   ► EDIT      cuts, color, timeline, chroma, visual fx, spatial
 *   ► MEDIA     stock library, creative packs, b-roll, sound, style vault, thumbnails
 *   ► TEXT      captions, motion text, scripts, text-motion studio
 *   ► AI        auto-edit, analysis, predict, remix, automate, dub, agent
 *   ► COLLAB    teams, accounts, collaborate
 *   ► EXPORT    export, schedule, distribution, settings
 *
 * The IDs map back to the existing EditorCategory union — no breakage.
 */

import type { EditorCategory } from '../types/editor'

export type EditorGroupId = 'edit' | 'media' | 'text' | 'ai' | 'collab' | 'export'

export interface EditorGroup {
  id: EditorGroupId
  label: string
  /** Tailwind gradient (e.g. 'from-fuchsia-500 to-violet-600') */
  gradient: string
  /** Solid accent class for the active state */
  accent: string
  /** Tight description shown on hover */
  description: string
  /** Categories that belong to this group, in display order. */
  categoryIds: EditorCategory[]
}

// Trimmed to a focused, pro core (calm-down pass). Non-editing surfaces
// (analytics/growth, distribution/scheduling, teams/accounts, settings) live
// elsewhere in the app; long-tail AI/labs tools are kept in code but off the
// default editor surface. Neutral gradients — no neon.
export const EDITOR_GROUPS: EditorGroup[] = [
  {
    id: 'edit',
    label: 'Edit',
    gradient: 'from-slate-700 to-slate-800',
    accent: 'text-indigo-300',
    description: 'Cut, grade, composite — the core editing surface.',
    categoryIds: ['edit', 'timeline', 'color', 'chromakey', 'effects'],
  },
  {
    id: 'media',
    label: 'Media',
    gradient: 'from-slate-700 to-slate-800',
    accent: 'text-indigo-300',
    description: 'Assets, stock, captions & text.',
    categoryIds: ['assets', 'stock-library', 'text-motion'],
  },
  {
    id: 'ai',
    label: 'AI',
    gradient: 'from-slate-700 to-slate-800',
    accent: 'text-indigo-300',
    description: 'One-click AI auto-edit + multilingual dubbing.',
    categoryIds: ['ai-edit', 'dub'],
  },
  {
    id: 'export',
    label: 'Export',
    gradient: 'from-slate-700 to-slate-800',
    accent: 'text-indigo-300',
    description: 'Render & share.',
    categoryIds: ['export'],
  },
]

/** Reverse lookup: categoryId → groupId. */
const CATEGORY_TO_GROUP: Map<EditorCategory, EditorGroupId> = (() => {
  const m = new Map<EditorCategory, EditorGroupId>()
  for (const g of EDITOR_GROUPS) {
    for (const c of g.categoryIds) m.set(c, g.id)
  }
  return m
})()

export function groupForCategory(c: EditorCategory): EditorGroupId | null {
  return CATEGORY_TO_GROUP.get(c) ?? null
}

/** Categories that aren't in any group — kept under a "More" group at the end. */
export function uncategorizedFrom(all: { id: EditorCategory }[]): EditorCategory[] {
  return all
    .map(c => c.id)
    .filter(id => !CATEGORY_TO_GROUP.has(id))
}
