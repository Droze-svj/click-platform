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

export const EDITOR_GROUPS: EditorGroup[] = [
  {
    id: 'edit',
    label: 'Edit',
    gradient: 'from-sky-500 to-indigo-600',
    accent: 'text-sky-300',
    description: 'Cut, grade, composite — the core editing surface.',
    categoryIds: ['edit', 'timeline', 'color', 'chromakey', 'visual-fx', 'spatial', 'effects'],
  },
  {
    id: 'media',
    label: 'Media',
    gradient: 'from-emerald-500 to-teal-600',
    accent: 'text-emerald-300',
    description: 'Stock, B-roll, sound, brand kit, thumbnails.',
    categoryIds: ['assets', 'stock-library', 'creative-packs', 'creative-tools', 'style-vault', 'thumbnails'],
  },
  {
    id: 'text',
    label: 'Text',
    gradient: 'from-fuchsia-500 to-rose-500',
    accent: 'text-fuchsia-300',
    description: 'Captions, motion typography, AI scripts.',
    categoryIds: ['text-motion', 'scripts'],
  },
  {
    id: 'ai',
    label: 'AI',
    gradient: 'from-violet-500 to-purple-600',
    accent: 'text-violet-300',
    description: 'Auto-edit, analysis, prediction, remix, agents.',
    categoryIds: ['ai-edit', 'ai-analysis', 'ai', 'intelligence', 'automate', 'agent', 'predict', 'growth', 'remix', 'short-clips', 'insights', 'dub'],
  },
  {
    id: 'collab',
    label: 'Collab',
    gradient: 'from-amber-500 to-orange-500',
    accent: 'text-amber-300',
    description: 'Reviews, teams, connected accounts.',
    categoryIds: ['collaborate', 'accounts'],
  },
  {
    id: 'export',
    label: 'Export',
    gradient: 'from-rose-500 to-pink-600',
    accent: 'text-rose-300',
    description: 'Render, schedule, distribute, settings.',
    categoryIds: ['export', 'distribution', 'scheduling', 'settings'],
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
