/**
 * Cost-guard middleware for AI calls.
 *
 * Wraps a handler that's about to call aiRouter.{aiCall|aiStream|aiCallJson}
 * and ensures that:
 *   - the user has enough credits left this billing period for the estimated
 *     spend, OR the call is small enough to pass through;
 *   - 402 Payment Required is returned with a structured upgrade payload
 *     when over budget;
 *   - actual usage is recorded after the call so meters drift back to truth.
 *
 * Per-provider rate cards live in this file. Update once when pricing
 * changes — every consumer reads through `estimateCostUsd`.
 */

const logger = require('../utils/logger');

// ── Rate card (USD per 1M input tokens // per 1M output tokens) ──────────
// Conservative numbers; we under-estimate so we don't accidentally let users
// over-spend. Update when provider pricing shifts.
const RATE_CARD = {
  openai: {
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4o': { input: 2.5, output: 10 },
    default: { input: 0.5, output: 1.5 },
  },
  anthropic: {
    // Current models (per the claude-api skill catalog): Opus 4.x $5/$25,
    // Sonnet 4.6 $3/$15, Haiku 4.5 $1/$5 per 1M tokens. The old keys
    // (claude-3-haiku / 3-5-sonnet / opus-4-7@$15) didn't match the models
    // actually called (claude-opus-4-8 etc.), so every call fell through to the
    // cheap default and AI spend was under-counted.
    'claude-opus-4-8': { input: 5, output: 25 },
    'claude-opus-4-7': { input: 5, output: 25 },
    'claude-sonnet-4-6': { input: 3, output: 15 },
    'claude-haiku-4-5': { input: 1, output: 5 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    default: { input: 5, output: 25 }, // conservative: assume Opus-tier when unknown
  },
  gemini: {
    default: { input: 0.075, output: 0.3 },
  },
};

const CHARS_PER_TOKEN = 4;
const CREDIT_PER_USD = 100; // 1 credit = $0.01 displayed in UI

// Fallback only — the live budget comes from entitlements LIMITS.aiBudgetUsd via
// getRemainingBudgetUsd. Keys aligned to canonical tiers (creator added; the
// legacy starter/enterprise kept as harmless aliases) so the `?? free` fallback
// can't accidentally under-budget a creator user.
const DEFAULT_TIER_BUDGETS_USD = {
  free: 0.5,
  creator: 5,
  starter: 5,
  pro: 50,
  agency: 500,
  enterprise: Infinity,
};

function tokensFromChars(chars) {
  return Math.max(1, Math.ceil(chars / CHARS_PER_TOKEN));
}

function pickRate(provider, model) {
  const block = RATE_CARD[provider] || {};
  return block[model] || block.default || { input: 1, output: 5 };
}

/**
 * Estimate cost in USD for a call, conservatively. `expectedOutputTokens` is
 * a heuristic — pass `opts.maxTokens` to bound the worst case.
 */
function estimateCostUsd({ provider, model, prompt, expectedOutputTokens }) {
  const inT = tokensFromChars((prompt || '').length);
  const outT = expectedOutputTokens || 256;
  const rate = pickRate(provider, model);
  const usd = (inT / 1_000_000) * rate.input + (outT / 1_000_000) * rate.output;
  return { usd, inputTokens: inT, outputTokens: outT, rate };
}

function usdToCredits(usd) {
  return Math.max(1, Math.ceil(usd * CREDIT_PER_USD));
}

async function getRemainingBudgetUsd(userId) {
  // Fail CLOSED: a missing userId must not yield an unlimited budget. Treat it
  // as the free-tier ceiling so an unauthenticated/misrouted AI call can't drive
  // unbounded spend. (All AI routes are authed today; this is defense-in-depth.)
  if (!userId) {
    const { limitFor } = require('../config/entitlements');
    const freeBudget = limitFor('free', 'aiBudgetUsd');
    return typeof freeBudget === 'number' ? freeBudget : DEFAULT_TIER_BUDGETS_USD.free;
  }
  let UsageMeter;
  let User;
  try {
    UsageMeter = require('../models/UsageMeter');
  } catch { /* intentionally empty */ }
  try {
    User = require('../models/User');
  } catch { /* intentionally empty */ }

  // Resolve the canonical tier and read its AI budget from the single source of
  // truth (entitlements LIMITS.aiBudgetUsd: free 0.5 / creator 5 / pro 50 /
  // agency 500). Previously this read subscription.tier/user.tier — fields the
  // User model never defines — so resolution was fragile and the budget table
  // here could drift from the canonical one. resolveTier handles trial⇒pro and
  // all legacy plan aliases.
  const { resolveTier, limitFor } = require('../config/entitlements');
  const tier = await (async () => {
    if (!User) return 'free';
    try {
      const u = await User.findById(userId).lean();
      return resolveTier(u);
    } catch {
      return 'free';
    }
  })();
  const canonicalBudget = limitFor(tier, 'aiBudgetUsd');
  const tierBudget = (typeof canonicalBudget === 'number')
    ? canonicalBudget
    : (DEFAULT_TIER_BUDGETS_USD[tier] ?? DEFAULT_TIER_BUDGETS_USD.free);

  if (!UsageMeter) return tierBudget;

  const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
  let used = 0;
  try {
    const meter = await UsageMeter.findOne({ userId, monthKey }).lean();
    used = meter?.aiSpendUsd || 0;
  } catch {
    used = 0;
  }
  return Math.max(0, tierBudget - used);
}

/**
 * Pre-call gate. Throws an error tagged with `.statusCode = 402` and a
 * structured payload when the estimated cost exceeds remaining budget.
 */
async function assertBudget({ userId, provider, model, prompt, expectedOutputTokens }) {
  const est = estimateCostUsd({ provider, model, prompt, expectedOutputTokens });
  const remaining = await getRemainingBudgetUsd(userId);
  if (est.usd > remaining) {
    const err = new Error('AI budget exceeded for this billing period.');
    err.statusCode = 402;
    err.payload = {
      reason: 'budget-exceeded',
      requiredUsd: est.usd,
      requiredCredits: usdToCredits(est.usd),
      remainingUsd: remaining,
      remainingCredits: usdToCredits(remaining),
      upgradeUrl: '/dashboard/billing',
    };
    throw err;
  }
  return { estimate: est, remainingUsd: remaining };
}

/** Record actual usage after a call. Best-effort; silent on failure. */
async function recordUsage({ userId, provider, model, inputTokens, outputTokens, taskType }) {
  if (!userId) return;
  let UsageMeter;
  try {
    UsageMeter = require('../models/UsageMeter');
  } catch {
    return;
  }
  if (!UsageMeter) return;

  const rate = pickRate(provider, model);
  const usd =
    ((inputTokens || 0) / 1_000_000) * rate.input +
    ((outputTokens || 0) / 1_000_000) * rate.output;
  const monthKey = new Date().toISOString().slice(0, 7);

  try {
    await UsageMeter.findOneAndUpdate(
      { userId, monthKey },
      {
        $inc: {
          aiSpendUsd: usd,
          aiInputTokens: inputTokens || 0,
          aiOutputTokens: outputTokens || 0,
          callCount: 1,
        },
        $set: { lastTaskType: taskType || 'unknown', updatedAt: new Date() },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    logger.warn('[costGuard] recordUsage failed (non-blocking)', {
      userId,
      error: err.message,
    });
  }
}

/**
 * Express middleware factory — attach to AI-bearing routes so the handler
 * can call `req.assertBudget(...)` without re-importing this module.
 */
function costGuard() {
  return (req, _res, next) => {
    req.assertBudget = (args) =>
      assertBudget({
        userId: req.user?.id || req.user?._id?.toString(),
        ...args,
      });
    req.recordAiUsage = (args) =>
      recordUsage({
        userId: req.user?.id || req.user?._id?.toString(),
        ...args,
      });
    next();
  };
}

module.exports = {
  costGuard,
  estimateCostUsd,
  usdToCredits,
  assertBudget,
  recordUsage,
  getRemainingBudgetUsd,
  RATE_CARD,
  DEFAULT_TIER_BUDGETS_USD,
};
