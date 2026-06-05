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
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    'claude-3-5-sonnet': { input: 3, output: 15 },
    'claude-opus-4-7': { input: 15, output: 75 },
    default: { input: 1, output: 5 },
  },
  gemini: {
    default: { input: 0.075, output: 0.3 },
  },
};

const CHARS_PER_TOKEN = 4;
const CREDIT_PER_USD = 100; // 1 credit = $0.01 displayed in UI

const DEFAULT_TIER_BUDGETS_USD = {
  free: 0.5,
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
  if (!userId) return Infinity;
  let UsageMeter;
  let User;
  try {
    UsageMeter = require('../models/UsageMeter');
  } catch { /* intentionally empty */ }
  try {
    User = require('../models/User');
  } catch { /* intentionally empty */ }

  // Map the stored subscription.plan onto a budget tier. Previously this read
  // only subscription.tier (never set by the model), so every user got the
  // free $0.50 budget regardless of what they paid for.
  const PLAN_TO_BUDGET_TIER = {
    free: 'free', creator: 'pro', pro: 'pro', agency: 'agency',
    monthly: 'pro', annual: 'pro', trial: 'pro',
  };
  const tier = await (async () => {
    if (!User) return 'free';
    try {
      const u = await User.findById(userId).lean();
      const sub = u?.subscription;
      if (u?.tier && DEFAULT_TIER_BUDGETS_USD[u.tier]) return u.tier;
      if (sub?.tier && DEFAULT_TIER_BUDGETS_USD[sub.tier]) return sub.tier;
      if (sub?.status === 'trial') return 'pro';
      if (sub?.plan && PLAN_TO_BUDGET_TIER[sub.plan]) return PLAN_TO_BUDGET_TIER[sub.plan];
      return 'free';
    } catch {
      return 'free';
    }
  })();
  const tierBudget = DEFAULT_TIER_BUDGETS_USD[tier] ?? DEFAULT_TIER_BUDGETS_USD.free;

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
