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
  calendarAutofill: () => '/calendar/autofill',
  calendarDrafts: (limit?: number, skip?: number) => `/calendar/drafts${qs({ limit, skip })}`,
  calendarApprove: (planId: string) => `/calendar/plans/${encodeURIComponent(planId)}/approve`,
  calendarCancel: (planId: string) => `/calendar/plans/${encodeURIComponent(planId)}/cancel`,
  triage: () => '/triage',
  digestLatest: () => '/digest/latest',
  repurposeStudio: () => '/repurpose/studio',
  repurposeSchedule: () => '/repurpose/studio/schedule',
  firstComment: () => '/first-comment',
  responderDraft: () => '/responder/draft',
  responderPending: (limit?: number, skip?: number) => `/responder/pending${qs({ limit, skip })}`,
  responderApprove: (id: string) => `/responder/${encodeURIComponent(id)}/approve`,
  responderReject: (id: string) => `/responder/${encodeURIComponent(id)}/reject`,
  responderSend: (id: string) => `/responder/${encodeURIComponent(id)}/send`,
}

const unwrap = <T,>(res: any): T => (res?.data ?? res) as T

// ── API functions ────────────────────────────────────────────────────────────
export const getStreak = async (unit: StreakUnit = 'week'): Promise<Streak> =>
  unwrap<Streak>(await apiGet(paths.streak(unit)))

export const getOptimalSlots = async (platform: Platform, count = 7): Promise<OptimalSlots> =>
  unwrap<OptimalSlots>(await apiGet(paths.optimalSlots(platform, count)))

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

export const draftReply = async (body: {
  platform: Platform; inboundText: string; externalCommentId?: string; author?: string
}): Promise<{ reply: SocialReply }> => unwrap(await apiPost(paths.responderDraft(), body))

export const getPendingReplies = async (): Promise<{ replies: SocialReply[] }> =>
  unwrap(await apiGet(paths.responderPending()))

export const approveReply = async (id: string, editedReply?: string): Promise<{ reply: SocialReply }> =>
  unwrap(await apiPost(paths.responderApprove(id), { editedReply }))

export const rejectReply = async (id: string): Promise<{ reply: SocialReply }> =>
  unwrap(await apiPost(paths.responderReject(id), {}))
