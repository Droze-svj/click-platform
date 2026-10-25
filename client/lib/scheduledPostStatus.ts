/**
 * The real ScheduledPost status enum (server/models/ScheduledPost.js) and how
 * the UI groups and labels it. Pages used to filter on 'scheduled' | 'draft'
 * and 'posted' | 'failed' only, so autopilot drafts (pending_approval), posts
 * being published, retrying, permanently failed and cancelled posts vanished
 * from every list — and a status the label map did not know crashed the row.
 */

export type ScheduledPostStatus =
  | 'scheduled'
  | 'pending'
  | 'pending_approval'
  | 'publishing'
  | 'posted'
  | 'failed'
  | 'failed_retryable'
  | 'failed_permanent'
  | 'cancelled'

/** Not published yet — shown in the queue. */
export const QUEUE_STATUSES: readonly string[] = ['scheduled', 'pending', 'pending_approval', 'publishing', 'failed_retryable']
/** Finished one way or another — shown in history. */
export const HISTORY_STATUSES: readonly string[] = ['posted', 'failed', 'failed_permanent', 'cancelled']

export type StatusKind = 'scheduled' | 'awaitingApproval' | 'publishing' | 'published' | 'retrying' | 'failed' | 'cancelled'

export function statusKind(status: string | null | undefined): StatusKind {
  switch (status) {
    case 'pending_approval': return 'awaitingApproval'
    case 'publishing': return 'publishing'
    case 'posted':
    case 'published': return 'published'
    case 'failed_retryable': return 'retrying'
    case 'failed':
    case 'failed_permanent': return 'failed'
    case 'cancelled': return 'cancelled'
    case 'scheduled':
    case 'pending':
    default: return 'scheduled'
  }
}

/** i18n key (en.json `postStatus.*`) for a status. */
export function statusLabelKey(status: string | null | undefined): string {
  return `postStatus.${statusKind(status)}`
}

export function isQueued(status: string | null | undefined): boolean {
  return QUEUE_STATUSES.includes(String(status))
}

export function isHistory(status: string | null | undefined): boolean {
  return HISTORY_STATUSES.includes(String(status))
}
