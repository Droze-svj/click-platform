import { apiGet } from './api'

/**
 * Wait for one of the server's background video operations to finish.
 *
 * Several routes — /video/advanced/remove-silence, /video/advanced/analyze and
 * the rest of that family — answer 202 with only `{ videoId, operation }` (or a
 * jobId) and do the real work through runInBackground(). The payload appears on
 * GET /video/progress/:videoId?operation=… once `status` is 'completed'.
 *
 * Reading the result straight off the POST is the bug this exists to prevent:
 * it returns none of those fields, so the caller silently carries on with
 * nothing. Two features shipped in that state — the one-click pipeline used the
 * uncut video, and the standalone silence panel rendered "0 segments kept" as a
 * finished result.
 *
 * Completed records are retained server-side for five minutes
 * (VIDEO_PROGRESS_RETENTION_MS), so a finished job cannot be missed between
 * polls.
 *
 * @param videoId    the content id the operation was started for
 * @param operation  the operation name the server tracks it under
 * @param onProgress optional progress callback, 0-100
 * @param timeoutMs  give up after this long (default 5 minutes)
 * @returns the job's result object
 * @throws if the job fails, never starts, or times out
 */
export async function awaitVideoJob(
  videoId: string,
  operation: string,
  onProgress?: (pct: number) => void,
  timeoutMs = 5 * 60 * 1000
): Promise<any> {
  const startedAt = Date.now()
  let everSeen = false

  // Poll rather than subscribe: the callers have no socket, and the progress
  // route is ownership-checked so it is safe to hit repeatedly.
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500))

    const res = await apiGet<any>(
      `/video/progress/${encodeURIComponent(videoId)}?operation=${encodeURIComponent(operation)}`,
      undefined,
      false // never serve a cached snapshot of a job that is still moving
    ).catch(() => null)

    const p = res?.data ?? res
    if (!p || typeof p.status !== 'string') {
      // A 404 while the job has not been registered yet is normal for a moment.
      // Never seeing it at all means it was never started (or the id is wrong),
      // and waiting out the full timeout would just look like a hang.
      if (!everSeen && Date.now() - startedAt > 20_000) {
        throw new Error(`${operation} did not start`)
      }
      continue
    }

    everSeen = true
    if (typeof p.progress === 'number') onProgress?.(p.progress)
    if (p.status === 'completed') return p.result ?? {}
    if (p.status === 'failed') throw new Error(p.error || `${operation} failed`)
  }

  throw new Error(`${operation} timed out`)
}
