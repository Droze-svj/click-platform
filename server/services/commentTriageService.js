// Comment Triage
// Scores + ranks a batch of inbound comments/DMs so a creator replies to what
// matters first — questions, complaints, and buying-intent leads rise; praise
// sinks; spam is flagged to ignore. Pure + deterministic (no AI, no DB), so it
// is instant and fully testable. Pairs with the AI Comment/DM Responder: triage
// the inbox, then draft replies for the high-priority items.

// Intent keyword signals (lowercased, word-ish matching). Order of checks below
// resolves precedence when several match.
const SPAM = [/\bfree\s+followers?\b/, /\bcheck\s+my\s+(page|profile|bio)\b/, /\bclick\s+(the\s+)?link\b/, /\bpromo\s*code\b/, /\bf4f\b/, /\bfollow\s+back\b/, /(https?:\/\/|www\.)\S+/, /\bcrypto\s+(giveaway|airdrop)\b/];
const COMPLAINT = ['refund', 'scam', 'broken', 'worst', 'terrible', 'hate', 'disappointed', 'ripoff', 'rip off', 'waste', 'awful', 'misleading', 'fake', "doesn't work", 'not working', 'unsubscribe', 'cancel my'];
const LEAD = ['how much', 'price', 'pricing', 'cost', 'buy', 'purchase', 'discount', 'where can i get', 'link in bio', 'interested', 'sign up', 'sign me up', 'dm me', 'coaching', 'work with you'];
const QUESTION_WORDS = ['who', 'what', 'when', 'where', 'why', 'how', 'can', 'does', 'do you', 'is it', 'are you', 'could', 'should', 'which'];
const PRAISE = ['love', 'amazing', 'great', 'awesome', 'best', 'fire', 'goat', 'incredible', 'thank you', 'thanks', 'helpful', 'inspiring', 'legend', '🔥', '❤️', '👏', '🙌'];

// Relative weight of each intent for "reply first" ordering.
const INTENT_WEIGHT = { complaint: 95, lead: 85, question: 75, other: 40, praise: 20, spam: 0 };
const INTENT_PRIORITY = { complaint: 'high', lead: 'high', question: 'high', other: 'medium', praise: 'low', spam: 'ignore' };

const norm = (t) => String(t == null ? '' : t).toLowerCase();
const hasAny = (text, list) => list.some((w) => text.includes(w));

/**
 * Pure: classify a comment's intent from its text.
 * @returns {'spam'|'complaint'|'lead'|'question'|'praise'|'other'}
 */
function classifyIntent(text) {
  const t = norm(text).trim();
  if (!t) return 'other';
  if (SPAM.some((re) => re.test(t))) return 'spam';
  if (hasAny(t, COMPLAINT)) return 'complaint';
  if (hasAny(t, LEAD)) return 'lead';
  // A question mark, or a leading question word, signals a question.
  if (t.includes('?') || QUESTION_WORDS.some((w) => t.startsWith(w + ' ') || t.includes(' ' + w + ' '))) return 'question';
  if (hasAny(t, PRAISE)) return 'praise';
  return 'other';
}

/**
 * Pure: score a single comment. Blends the intent weight with a small engagement
 * boost (likes) so a high-liked question outranks a low-liked one. Returns
 * intent, priority bucket, a 0-100 score, and the signals that fired.
 *
 * @param {string} text
 * @param {{likes?:number}} [opts]
 */
function scoreComment(text, opts = {}) {
  const intent = classifyIntent(text);
  const base = INTENT_WEIGHT[intent];
  const likes = Math.max(0, Number(opts.likes) || 0);
  // Diminishing engagement boost, capped so it never outweighs intent.
  const engagementBoost = intent === 'spam' ? 0 : Math.min(10, Math.round(Math.log10(likes + 1) * 5));
  const score = Math.max(0, Math.min(100, base + engagementBoost));
  return {
    intent,
    priority: INTENT_PRIORITY[intent],
    score,
    signals: { engagementBoost },
  };
}

/**
 * Pure: triage a batch of comments — classify + score each, then sort by score
 * (desc), stable on original order for ties. Each input may carry { id, text,
 * author, likes }; the output preserves those plus the triage fields.
 */
function triageComments(comments) {
  const list = Array.isArray(comments) ? comments : [];
  const scored = list.map((c, i) => {
    const t = scoreComment(c && c.text, { likes: c && c.likes });
    return {
      index: i,
      id: c && c.id != null ? c.id : undefined,
      author: c && c.author != null ? c.author : undefined,
      text: c && c.text != null ? String(c.text) : '',
      intent: t.intent,
      priority: t.priority,
      score: t.score,
    };
  });
  scored.sort((a, b) => (b.score - a.score) || (a.index - b.index));

  const counts = scored.reduce((acc, c) => {
    acc[c.priority] = (acc[c.priority] || 0) + 1;
    return acc;
  }, {});

  return { ranked: scored, counts, total: scored.length };
}

module.exports = {
  classifyIntent,
  scoreComment,
  triageComments,
  INTENT_WEIGHT,
  INTENT_PRIORITY,
};
