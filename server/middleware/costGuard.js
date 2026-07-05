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

// Resolve the per-user AI budget ceiling in USD from the single source of truth
// (entitlements LIMITS.aiBudgetUsd: free 0.5 / creator 5 / pro 50 / agency 500 /
// enterprise Infinity). Missing userId fails CLOSED to the free ceiling so an
// unauthenticated/misrouted AI call can't drive unbounded spend.
async function resolveTierBudgetUsd(userId) {
  const { resolveTier, limitFor } = require('../config/entitlements');
  if (!userId) {
    const freeBudget = limitFor('free', 'aiBudgetUsd');
    return typeof freeBudget === 'number' ? freeBudget : DEFAULT_TIER_BUDGETS_USD.free;
  }
  let User;
  try {
    User = require('../models/User');
  } catch { /* intentionally empty */ }
  let tier = 'free';
  if (User) {
    try {
      const u = await User.findById(userId).lean();
      tier = resolveTier(u);
    } catch {
      tier = 'free';
    }
  }
  const canonicalBudget = limitFor(tier, 'aiBudgetUsd');
  return (typeof canonicalBudget === 'number')
    ? canonicalBudget
    : (DEFAULT_TIER_BUDGETS_USD[tier] ?? DEFAULT_TIER_BUDGETS_USD.free);
}

async function getRemainingBudgetUsd(userId) {
  const tierBudget = await resolveTierBudgetUsd(userId);
  let UsageMeter;
  try {
    UsageMeter = require('../models/UsageMeter');
  } catch { /* intentionally empty */ }
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

// Build the 402 "budget exceeded" error with its structured upgrade payload.
function makeBudgetError(est, remaining) {
  const err = new Error('AI budget exceeded for this billing period.');
  err.statusCode = 402;
  err.payload = {
    reason: 'budget-exceeded',
    requiredUsd: est.usd,
    requiredCredits: usdToCredits(est.usd),
    remainingUsd: remaining,
    remainingCredits: usdToCredits(Math.max(0, remaining)),
    upgradeUrl: '/dashboard/billing',
  };
  return err;
}

/**
 * Pre-call gate. Throws an error tagged with `.statusCode = 402` and a
 * structured payload when the estimated cost exceeds remaining budget.
 */
async function assertBudget({ userId, provider, model, prompt, expectedOutputTokens }) {
  const est = estimateCostUsd({ provider, model, prompt, expectedOutputTokens });
  const remaining = await getRemainingBudgetUsd(userId);
  if (est.usd > remaining) {
    throw makeBudgetError(est, remaining);
  }
  return { estimate: est, remainingUsd: remaining };
}

/**
 * Atomic reserve-then-settle gate (closes the check-then-act TOCTOU in
 * assertBudget, where two concurrent calls both read the same remaining budget,
 * both pass, and both spend). This debits the ESTIMATED cost up-front with a
 * single conditional `$inc` that only succeeds while the running spend + this
 * estimate stays within the tier ceiling — so N racing calls can never
 * collectively exceed budget. `settleReservation` later corrects the meter from
 * the estimate to the real usage; `releaseReservation` refunds an estimate whose
 * call never settled (errored). Gated behind AI_BUDGET_ATOMIC_RESERVE; when off,
 * assertBudget/recordUsage behave exactly as before.
 */
async function reserveBudget({ userId, provider, model, prompt, expectedOutputTokens }) {
  const est = estimateCostUsd({ provider, model, prompt, expectedOutputTokens });
  const tierBudget = await resolveTierBudgetUsd(userId);

  // Infinite ceiling (enterprise): nothing to meter, always allow.
  if (!Number.isFinite(tierBudget)) {
    return { estimate: est, reservedUsd: 0, remainingUsd: Infinity };
  }

  let UsageMeter;
  try {
    UsageMeter = require('../models/UsageMeter');
  } catch { /* intentionally empty */ }

  // No meter model or no user → can't reserve atomically; fall back to a plain
  // ceiling check (fail-closed on missing userId is handled by resolveTierBudget).
  if (!userId || !UsageMeter) {
    if (est.usd > tierBudget) throw makeBudgetError(est, tierBudget);
    return { estimate: est, reservedUsd: 0, remainingUsd: tierBudget };
  }

  const monthKey = new Date().toISOString().slice(0, 7);
  // Ensure the meter doc exists so the conditional update can match it.
  try {
    await UsageMeter.updateOne(
      { userId, monthKey },
      { $setOnInsert: { aiSpendUsd: 0 } },
      { upsert: true }
    );
  } catch { /* unique-index race: a concurrent insert won — fine */ }

  // The whole gate: increment spend by the estimate ONLY IF it stays within the
  // ceiling. If no doc matches, we're at/over budget and no reservation is made.
  const meter = await UsageMeter.findOneAndUpdate(
    {
      userId,
      monthKey,
      $expr: { $lte: [{ $add: [{ $ifNull: ['$aiSpendUsd', 0] }, est.usd] }, tierBudget] },
    },
    { $inc: { aiSpendUsd: est.usd } },
    { new: true }
  );

  if (!meter) {
    let used = tierBudget;
    try {
      const cur = await UsageMeter.findOne({ userId, monthKey }).lean();
      used = cur?.aiSpendUsd || 0;
    } catch { /* intentionally empty */ }
    throw makeBudgetError(est, Math.max(0, tierBudget - used));
  }

  return {
    estimate: est,
    reservedUsd: est.usd,
    remainingUsd: Math.max(0, tierBudget - (meter.aiSpendUsd || 0)),
  };
}

/**
 * Settle a reservation to real usage: the estimate was already debited by
 * reserveBudget, so here we apply only the DELTA (actual − reserved) plus the
 * token/count meters. Net effect on aiSpendUsd = the real cost.
 */
async function settleReservation({ userId, provider, model, inputTokens, outputTokens, taskType, reservedUsd }) {
  if (!userId) return;
  let UsageMeter;
  try {
    UsageMeter = require('../models/UsageMeter');
  } catch {
    return;
  }
  if (!UsageMeter) return;

  const rate = pickRate(provider, model);
  const actualUsd =
    ((inputTokens || 0) / 1_000_000) * rate.input +
    ((outputTokens || 0) / 1_000_000) * rate.output;
  const delta = actualUsd - (reservedUsd || 0);
  const monthKey = new Date().toISOString().slice(0, 7);

  try {
    await UsageMeter.findOneAndUpdate(
      { userId, monthKey },
      {
        $inc: {
          aiSpendUsd: delta,
          aiInputTokens: inputTokens || 0,
          aiOutputTokens: outputTokens || 0,
          callCount: 1,
        },
        $set: { lastTaskType: taskType || 'unknown', updatedAt: new Date() },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    logger.warn('[costGuard] settleReservation failed (non-blocking)', { userId, error: err.message });
  }
}

/** Refund a reservation whose call never settled (handler errored). */
async function releaseReservation({ userId, reservedUsd }) {
  if (!userId || !reservedUsd) return;
  let UsageMeter;
  try {
    UsageMeter = require('../models/UsageMeter');
  } catch {
    return;
  }
  if (!UsageMeter) return;
  const monthKey = new Date().toISOString().slice(0, 7);
  try {
    await UsageMeter.findOneAndUpdate(
      { userId, monthKey },
      { $inc: { aiSpendUsd: -reservedUsd } }
    );
  } catch (err) {
    logger.warn('[costGuard] releaseReservation failed (non-blocking)', { userId, error: err.message });
  }
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
  // Atomic reserve-then-settle is now ON by default (closes the TOCTOU where two
  // racing calls both pass the pre-check and both spend, overshooting the ceiling).
  // Set AI_BUDGET_ATOMIC_RESERVE=false to fall back to the legacy assert/record path.
  const atomicEnabled = () => process.env.AI_BUDGET_ATOMIC_RESERVE !== 'false';
  return (req, res, next) => {
    const uid = () => req.user?.id || req.user?._id?.toString();
    // Reservations made this request but not yet settled (FIFO). Released on
    // response finish so an errored call can't leak a phantom debit.
    req._aiReservations = [];

    req.assertBudget = async (args) => {
      if (atomicEnabled()) {
        const r = await reserveBudget({ userId: uid(), ...args });
        if (r.reservedUsd > 0) req._aiReservations.push(r.reservedUsd);
        return r;
      }
      return assertBudget({ userId: uid(), ...args });
    };

    req.recordAiUsage = (args) => {
      if (atomicEnabled() && req._aiReservations.length) {
        const reservedUsd = req._aiReservations.shift();
        return settleReservation({ userId: uid(), reservedUsd, ...args });
      }
      return recordUsage({ userId: uid(), ...args });
    };

    // Leak guard: refund any reservation whose call reserved budget but never
    // settled (handler threw before recordAiUsage). No-op when the flag is off.
    res.on('finish', () => {
      if (req._aiReservations && req._aiReservations.length) {
        const userId = uid();
        for (const reservedUsd of req._aiReservations.splice(0)) {
          releaseReservation({ userId, reservedUsd }).catch(() => {});
        }
      }
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
  resolveTierBudgetUsd,
  reserveBudget,
  settleReservation,
  releaseReservation,
  makeBudgetError,
  RATE_CARD,
  DEFAULT_TIER_BUDGETS_USD,
};
