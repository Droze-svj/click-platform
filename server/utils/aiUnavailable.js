/**
 * The error a generator throws when the model gave back nothing usable
 * (quota spent, safety block, empty or unparseable output). Routes map
 * err.statusCode → 503, so the panel shows "try again" instead of a 200 with
 * an empty list or a made-up result shaped from null.
 */
function aiUnavailable(what = 'a result') {
  const e = new Error(`The AI could not produce ${what} right now. Try again in a moment.`);
  e.statusCode = 503;
  e.code = 'AI_UNAVAILABLE';
  return e;
}

module.exports = { aiUnavailable };
