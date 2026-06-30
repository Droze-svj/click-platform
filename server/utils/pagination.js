// Clamp a user-supplied pagination integer (limit / page / skip) to a sane range.
//
// Raw `parseInt(req.query.limit, 10)` is two bugs: `?limit=999999999` asks Mongo
// for an unbounded result set (DoS on a large/global collection), and `?limit=abc`
// yields `.limit(NaN)` (Mongoose then ignores the limit → also unbounded). This
// returns `def` for any non-finite input and clamps to [min, max]. The default
// ceiling is deliberately GENEROUS (500) so it never truncates normal pagination —
// it only kills absurd values.

function clampInt(value, def = 20, max = 500, min = 1) {
  const n = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

module.exports = { clampInt };
