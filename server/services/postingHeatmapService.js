// Posting Heatmap
// Builds a 7-day × 24-hour engagement heatmap from a user's posted-content
// history, so a creator can SEE when their audience engages (complements the
// optimal-slots recommender). Pure buildHeatmap core (no DB) + a thin fetch.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Pure: turn posted-content rows into a 7×24 grid of average engagement.
 * @param {Array<{postedAt:Date|string|number, engagement?:number}>} posts
 * @returns {{ grid: Array<{day:number,hour:number,count:number,avgEngagement:number}>,
 *             peak: {day:number,hour:number,avgEngagement:number}|null,
 *             totalPosts:number }}
 */
function buildHeatmap(posts) {
  // cells[day][hour] = { sum, count }
  const cells = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ sum: 0, count: 0 })));
  let total = 0;

  for (const p of Array.isArray(posts) ? posts : []) {
    const t = p && p.postedAt != null
      ? (p.postedAt instanceof Date ? p.postedAt : new Date(p.postedAt))
      : null;
    if (!t || Number.isNaN(t.getTime())) continue;
    const day = t.getUTCDay();
    const hour = t.getUTCHours();
    const eng = Number(p.engagement) || 0;
    cells[day][hour].sum += eng;
    cells[day][hour].count += 1;
    total += 1;
  }

  const grid = [];
  let peak = null;
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const c = cells[day][hour];
      if (c.count === 0) continue; // sparse grid — only cells with data
      const avg = Math.round((c.sum / c.count) * 100) / 100;
      grid.push({ day, hour, count: c.count, avgEngagement: avg });
      if (!peak || avg > peak.avgEngagement) peak = { day, hour, avgEngagement: avg };
    }
  }

  return { grid, peak, totalPosts: total };
}

/** Fetch the caller's posted history and build their heatmap. deps-injected. */
async function getHeatmap(userId, deps) {
  const posts = await deps.getPosts(userId);
  const hm = buildHeatmap(posts);
  return { ...hm, dayLabels: DAYS };
}

module.exports = { DAYS, buildHeatmap, getHeatmap };
