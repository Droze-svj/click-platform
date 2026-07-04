// Typed client for the 2026 creator-feature endpoints.
// NOTE: apiGet/apiPost already prefix with `/api` — never include it here.
// Responses come back as { success, message, data }; `unwrap` returns `data`.

import { apiGet, apiPost } from './api'

// ── Types ────────────────────────────────────────────────────────────────────
export type Platform =
  | 'instagram' | 'tiktok' | 'youtube' | 'twitter'
  | 'linkedin' | 'facebook' | 'pinterest' | 'threads'

export type StreakUnit = 'week' | 'day'
export type StreakStatus = 'active' | 'at-risk' | 'broken' | 'new'

export interface Streak {
  unit: StreakUnit
  currentStreak: number
  longestStreak: number
  thisPeriodCount: number
  lastPostedAt: string | null
  status: StreakStatus
}

export interface OptimalSlots {
  platform: string
  niche: string
  hours: number[]
  source: 'history' | 'niche-default' | 'default'
  slots: string[]
}

export type TriageIntent = 'complaint' | 'lead' | 'question' | 'praise' | 'spam' | 'other'
export type TriagePriority = 'high' | 'medium' | 'low' | 'ignore'
export interface TriagedComment {
  id?: string; author?: string; text: string
  intent: TriageIntent; priority: TriagePriority; score: number
}
export interface TriageResult {
  ranked: TriagedComment[]
  counts: Partial<Record<TriagePriority, number>>
  total: number
}

export interface FirstCommentResult {
  platform: string
  goal: 'engagement' | 'cta' | 'link'
  options: { text: string; goal: string }[]
}

export interface RepurposeVariant {
  platform: string; content: string; hashtags: string[]
  score: number; suggestions: string[]; aspectRatio: string; format: string
}

export interface SeriesPart { part: number; title: string; hook: string; description: string }
export interface SeriesResult {
  theme: string; niche: string; platform: string; parts: SeriesPart[]
  scheduled?: { planId: string; count: number }
}

export interface HeatmapCell { day: number; hour: number; count: number; avgEngagement: number }
export interface Heatmap {
  grid: HeatmapCell[]
  peak: { day: number; hour: number; avgEngagement: number } | null
  totalPosts: number
  dayLabels: string[]
}

export interface SocialReply {
  _id: string; platform: string; inboundText: string
  draftReply: string; editedReply: string | null; status: string
  externalCommentId: string | null; author: string | null
}

// ── Pure path/query builders (unit-tested) ───────────────────────────────────
const qs = (params: Record<string, string | number | undefined>): string => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

export const paths = {
  streak: (unit: StreakUnit = 'week') => `/streak${qs({ unit })}`,
  optimalSlots: (platform: string, count?: number) => `/schedule/optimal-slots${qs({ platform, count })}`,
  heatmap: (platform?: string) => `/schedule/heatmap${qs({ platform })}`,
  calendarAutofill: () => '/calendar/autofill',
  calendarDrafts: (limit?: number, skip?: number) => `/calendar/drafts${qs({ limit, skip })}`,
  calendarApprove: (planId: string) => `/calendar/plans/${encodeURIComponent(planId)}/approve`,
  calendarCancel: (planId: string) => `/calendar/plans/${encodeURIComponent(planId)}/cancel`,
  triage: () => '/triage',
  digestLatest: () => '/digest/latest',
  repurposeStudio: () => '/repurpose/studio',
  repurposeSchedule: () => '/repurpose/studio/schedule',
  firstComment: () => '/first-comment',
  hooks: () => '/hooks',
  series: () => '/series',
  responderDraft: () => '/responder/draft',
  responderPending: (limit?: number, skip?: number) => `/responder/pending${qs({ limit, skip })}`,
  responderApprove: (id: string) => `/responder/${encodeURIComponent(id)}/approve`,
  responderReject: (id: string) => `/responder/${encodeURIComponent(id)}/reject`,
  responderSend: (id: string) => `/responder/${encodeURIComponent(id)}/send`,
  responderPlatforms: () => '/responder/platforms',
  responderHistory: (status?: string, limit?: number, skip?: number) =>
    `/responder/history${qs({ status, limit, skip })}`,
  responderStats: (days?: number) => `/responder/stats${qs({ days })}`,
}

const unwrap = <T,>(res: any): T => (res?.data ?? res) as T

// ── API functions ────────────────────────────────────────────────────────────
export const getStreak = async (unit: StreakUnit = 'week'): Promise<Streak> =>
  unwrap<Streak>(await apiGet(paths.streak(unit)))

export const getOptimalSlots = async (platform: Platform, count = 7): Promise<OptimalSlots> =>
  unwrap<OptimalSlots>(await apiGet(paths.optimalSlots(platform, count)))

export const getHeatmap = async (platform?: Platform): Promise<Heatmap> =>
  unwrap<Heatmap>(await apiGet(paths.heatmap(platform)))

export const autofillCalendar = async (body: {
  count?: number; platforms?: Platform[]; topic?: string; optimalTimes?: boolean; dryRun?: boolean
}): Promise<{ planId: string; count: number; posts: any[] }> =>
  unwrap(await apiPost(paths.calendarAutofill(), body))

export const getCalendarDrafts = async (limit = 50, skip = 0): Promise<{ drafts: any[] }> =>
  unwrap(await apiGet(paths.calendarDrafts(limit, skip)))

export const approveCalendarPlan = async (planId: string) =>
  unwrap(await apiPost(paths.calendarApprove(planId), {}))

export const triageComments = async (
  comments: { id?: string; text: string; author?: string; likes?: number }[],
): Promise<TriageResult> => unwrap<TriageResult>(await apiPost(paths.triage(), { comments }))

export const getLatestDigest = async (): Promise<{ digest: any | null }> =>
  unwrap(await apiGet(paths.digestLatest()))

export const repurposeStudio = async (body: {
  contentId?: string; text?: string; platforms?: Platform[]
}): Promise<{ variants: RepurposeVariant[]; count: number }> =>
  unwrap(await apiPost(paths.repurposeStudio(), body))

export const generateFirstComments = async (body: {
  contentId?: string; text?: string; platform?: Platform; goal?: 'engagement' | 'cta' | 'link'
}): Promise<FirstCommentResult> => unwrap<FirstCommentResult>(await apiPost(paths.firstComment(), body))

export const planSeries = async (body: {
  theme: string; parts?: number; platform?: Platform; schedule?: boolean
}): Promise<SeriesResult> => unwrap<SeriesResult>(await apiPost(paths.series(), body))

export type HookStyle = 'mix' | 'curiosity' | 'bold' | 'story' | 'question' | 'contrarian'
export interface Hook { text: string; style: string }
export interface HookResult { platform: string; style: string; hooks: Hook[] }

export const generateHooks = async (body: {
  topic?: string; contentId?: string; platform?: Platform; style?: HookStyle; count?: number
}): Promise<HookResult> => unwrap<HookResult>(await apiPost(paths.hooks(), body))

export const draftReply = async (body: {
  platform: Platform; inboundText: string; externalCommentId?: string; author?: string
}): Promise<{ reply: SocialReply }> => unwrap(await apiPost(paths.responderDraft(), body))

export type ResponderPlatform = { name: Platform; canSend: boolean }

export const getResponderPlatforms = async (): Promise<{
  platforms: ResponderPlatform[]; sendEnabled: boolean
}> => unwrap(await apiGet(paths.responderPlatforms()))

export const getPendingReplies = async (): Promise<{ replies: SocialReply[] }> =>
  unwrap(await apiGet(paths.responderPending()))

// Resolved replies (approved/sent/rejected/failed) — the responder history.
export const getResponderHistory = async (
  status?: string, limit = 50, skip = 0,
): Promise<{ replies: SocialReply[] }> =>
  unwrap(await apiGet(paths.responderHistory(status, limit, skip)))

export interface ResponderStats {
  sinceDays: number; total: number; byStatus: Record<string, number>
}

export const getResponderStats = async (days = 30): Promise<ResponderStats> =>
  unwrap(await apiGet(paths.responderStats(days)))

export const approveReply = async (id: string, editedReply?: string): Promise<{ reply: SocialReply }> =>
  unwrap(await apiPost(paths.responderApprove(id), { editedReply }))

export const rejectReply = async (id: string): Promise<{ reply: SocialReply }> =>
  unwrap(await apiPost(paths.responderReject(id), {}))

// Send an approved reply. Server hard-gates on SOCIAL_REPLY_SEND (501 if off), so
// the UI only surfaces this when getResponderPlatforms().sendEnabled is true.
export const sendReply = async (id: string): Promise<{ reply: SocialReply }> =>
  unwrap(await apiPost(paths.responderSend(id), {}))
