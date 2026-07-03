// Posting Streak / Consistency Tracker
// Turns a creator's posted-content history into a streak: consecutive periods
// (weeks by default, or days) with at least one post, plus the longest streak,
// this period's count, and a status nudge (active / at-risk / broken). Pure core
// (no DB) so it is deterministic and fully unit-testable.

const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Fixed-size bucket index for a timestamp (epoch-aligned; deterministic). */
function bucketIndex(ms, unit) {
  const size = unit === 'day' ? DAY_MS : WEEK_MS;
  return Math.floor(ms / size);
}

/**
 * Pure: compute the streak from a list of post dates (ms or Date).
 * A streak counts consecutive buckets, ending at the current bucket (active) or
 * the immediately-previous one (at-risk — post this period to keep it alive).
 *
 * @param {Array<number|Date|string>} postDates
 * @param {{ now?:number, unit?:'week'|'day' }} [opts]
 */
function computeStreak(postDates, opts = {}) {
  const unit = opts.unit === 'day' ? 'day' : 'week';
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();

  const times = (Array.isArray(postDates) ? postDates : [])
    .map((d) => (d instanceof Date ? d.getTime() : (typeof d === 'number' ? d : Date.parse(d))))
    .filter((t) => Number.isFinite(t));

  const empty = {
    unit, currentStreak: 0, longestStreak: 0, thisPeriodCount: 0,
    lastPostedAt: null, status: 'broken',
  };
  if (!times.length) return empty;

  const filled = new Set(times.map((t) => bucketIndex(t, unit)));
  const cur = bucketIndex(now, unit);
  const lastPostedAt = new Date(Math.max(...times));
  const thisPeriodCount = times.filter((t) => bucketIndex(t, unit) === cur).length;

  // Anchor the streak at the current bucket if filled, else the previous one.
  let anchor;
  let status;
  if (filled.has(cur)) { anchor = cur; status = 'active'; }
  else if (filled.has(cur - 1)) { anchor = cur - 1; status = 'at-risk'; }
  else { anchor = null; status = 'broken'; }

  let currentStreak = 0;
  if (anchor != null) {
    let b = anchor;
    while (filled.has(b)) { currentStreak += 1; b -= 1; }
  }

  // Longest run of consecutive filled buckets ever.
  const sorted = [...filled].sort((a, b) => a - b);
  let longestStreak = sorted.length ? 1 : 0;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    if (run > longestStreak) longestStreak = run;
  }

  return { unit, currentStreak, longestStreak, thisPeriodCount, lastPostedAt, status };
}

/**
 * Resolve the caller's streak. `deps.getPostDates(userId)` returns the post
 * timestamps (injected so this is testable without a DB).
 */
async function getStreak(userId, { unit } = {}, deps) {
  const dates = await deps.getPostDates(userId);
  return computeStreak(dates, { unit });
}

module.exports = {
  bucketIndex,
  computeStreak,
  getStreak,
};
