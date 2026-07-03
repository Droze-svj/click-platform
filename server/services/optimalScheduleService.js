// Optimal-Time Auto-Schedule
// Picks the best posting hours for a user+platform (from their own posted-content
// engagement history, falling back to niche posting windows) and lays out N
// future time slots on those hours — so Calendar Autofill / Repurpose can place
// drafts when the audience is actually active instead of on a fixed cadence.

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

const uniq = (arr) => [...new Set(arr)];

/**
 * Pure: choose ranked posting hours. Prefers the user's own history (hours with
 * the highest average engagement); falls back to the niche's posting windows,
 * then to a sane default. Returns { hours: number[], source }.
 *
 * @param {Array<{hour:number, averageEngagement?:number}>} historyHours
 * @param {Array<{start:number, end?:number}>} nicheWindows
 */
function pickBestHours(historyHours, nicheWindows) {
  const fromHistory = (Array.isArray(historyHours) ? historyHours : [])
    .filter((h) => h && Number.isFinite(h.hour) && (Number(h.averageEngagement) || 0) > 0)
    .sort((a, b) => (b.averageEngagement || 0) - (a.averageEngagement || 0))
    .map((h) => h.hour);
  if (fromHistory.length) return { hours: uniq(fromHistory).slice(0, 3), source: 'history' };

  const fromNiche = uniq((Array.isArray(nicheWindows) ? nicheWindows : [])
    .map((w) => (w && Number.isFinite(w.start) ? w.start : null))
    .filter((h) => h != null));
  if (fromNiche.length) return { hours: fromNiche.slice(0, 3), source: 'niche-default' };

  return { hours: [9, 19], source: 'default' };
}

/**
 * Pure: produce `count` future Date slots — one per day, rotating through the
 * ranked `hours` — all strictly after `fromMs`. Chronological (day increments
 * each slot) while still favouring the top-ranked hour first.
 */
function nextSlots(hours, count, fromMs) {
  const HRS = (Array.isArray(hours) && hours.length) ? hours : [9, 19];
  const from = Number.isFinite(fromMs) ? fromMs : Date.now();
  const startDay = Math.floor(from / DAY_MS) * DAY_MS; // UTC midnight of `from`
  const n = Math.max(0, count | 0);
  const slots = [];
  let day = 0;
  const cap = n + 400; // safety bound
  while (slots.length < n && day < cap) {
    const hour = HRS[slots.length % HRS.length];
    const t = startDay + day * DAY_MS + hour * HOUR_MS;
    if (t > from) slots.push(new Date(t));
    day += 1;
  }
  return slots;
}

/**
 * Orchestrate: resolve best hours for the user+platform and lay out `count`
 * slots. External lookups are injected via `deps` so this is unit-testable:
 *   deps = { getHistory(userId,platform)→{optimalHours}, getNiche(userId)→string,
 *            nicheWindows(niche)→[{start,end}], now?:ms }
 */
async function computeOptimalSlots(userId, platform, count, deps) {
  let history = [];
  try {
    const res = await deps.getHistory(userId, platform);
    history = (res && Array.isArray(res.optimalHours)) ? res.optimalHours : [];
  } catch (_) { history = []; }

  let niche = 'other';
  try { niche = (await deps.getNiche(userId)) || 'other'; } catch (_) { niche = 'other'; }

  const windows = deps.nicheWindows ? deps.nicheWindows(niche) : [];
  const { hours, source } = pickBestHours(history, windows);
  const slots = nextSlots(hours, count, deps.now || Date.now());
  return { platform, niche, hours, source, slots };
}

module.exports = {
  pickBestHours,
  nextSlots,
  computeOptimalSlots,
};
