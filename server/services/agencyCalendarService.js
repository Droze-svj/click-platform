// Unified multi-client calendar intelligence — pure analysis over a set of
// scheduled posts: cross-client conflicts (same client+platform too close),
// per-client/platform/day capacity overflow, and team-member workload. Powers
// the agency master calendar (the basic calendar + conflict detection existed;
// this adds capacity + workload the way Sprout/Loomly do). No I/O → testable.

function analyzeCalendar(posts = [], options = {}) {
  const { conflictWindowMin = 30, maxPerPlatformPerDay = 3 } = options;
  const norm = (Array.isArray(posts) ? posts : [])
    .filter((p) => p && p.scheduledTime)
    .map((p) => {
      const time = new Date(p.scheduledTime).getTime();
      return {
        id: (p.id || p._id || null) && String(p.id || p._id),
        clientId: String(p.clientWorkspaceId || p.clientId || ''),
        platform: String(p.platform || ''),
        assignee: String(p.assignee || p.teamMemberId || p.userId || ''),
        time,
        day: Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null,
      };
    })
    .filter((p) => Number.isFinite(p.time));

  // Conflicts: two posts to the same client+platform within conflictWindowMin.
  const byCP = {};
  for (const p of norm) {
    const key = `${p.clientId}|${p.platform}`;
    (byCP[key] = byCP[key] || []).push(p);
  }
  const conflicts = [];
  for (const key of Object.keys(byCP)) {
    const arr = byCP[key].sort((a, b) => a.time - b.time);
    for (let i = 1; i < arr.length; i++) {
      const gapMin = (arr[i].time - arr[i - 1].time) / 60000;
      if (gapMin < conflictWindowMin) {
        conflicts.push({
          clientId: arr[i].clientId, platform: arr[i].platform,
          a: arr[i - 1].id, b: arr[i].id, gapMin: Math.round(gapMin),
        });
      }
    }
  }

  // Capacity: per client+platform+day count; flag days over the cap.
  const capacity = {};
  for (const p of norm) {
    if (!p.day) continue;
    const key = `${p.clientId}|${p.platform}|${p.day}`;
    capacity[key] = (capacity[key] || 0) + 1;
  }
  const overCapacity = Object.entries(capacity)
    .filter(([, n]) => n > maxPerPlatformPerDay)
    .map(([key, n]) => {
      const [clientId, platform, day] = key.split('|');
      return { clientId, platform, day, count: n, max: maxPerPlatformPerDay };
    });

  // Workload: posts per assignee.
  const workload = {};
  for (const p of norm) { if (p.assignee) workload[p.assignee] = (workload[p.assignee] || 0) + 1; }
  const busiestAssignee = Object.entries(workload).sort((a, b) => b[1] - a[1])[0];

  return {
    total: norm.length,
    conflicts,
    overCapacity,
    workload,
    busiestAssignee: busiestAssignee ? busiestAssignee[0] : null,
  };
}

module.exports = { analyzeCalendar };
