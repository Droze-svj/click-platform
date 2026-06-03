// Revenue / cost modelling assumptions
//
// These were previously hardcoded as magic numbers (e.g. `value * 0.8`,
// `value * 1.5`) inside conversionTrackingService and roasRoiService. They are
// centralised here so the two services agree and so operators can tune them per
// deployment via environment variables without code changes.
//
// All values are validated and clamped to sane ranges on load.

function readRatio(envKey, defaultValue, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  const raw = process.env[envKey];
  if (raw === undefined || raw === '') return defaultValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return defaultValue;
  }
  return parsed;
}

// Fraction of gross revenue assumed to be cost of goods/fulfilment.
// net = gross * (1 - COST_RATIO). Default 20% costs => keep 80%.
const COST_RATIO = readRatio('CONVERSION_COST_RATIO', 0.2, { min: 0, max: 1 });

// Multiplier applied to attributed revenue to estimate lifetime value when no
// per-customer LTV data is available. Default 1.5x.
const LTV_MULTIPLIER = readRatio('REVENUE_LTV_MULTIPLIER', 1.5, { min: 1 });

/**
 * Estimate net revenue from a gross amount.
 * @param {number} gross
 * @param {number} [costRatio] optional per-call override (0..1)
 */
function netFromGross(gross, costRatio = COST_RATIO) {
  const g = Number(gross) || 0;
  const ratio = Number.isFinite(costRatio) && costRatio >= 0 && costRatio <= 1 ? costRatio : COST_RATIO;
  return g * (1 - ratio);
}

/**
 * Estimate lifetime value from an attributed revenue amount.
 * @param {number} attributedRevenue
 * @param {number} [multiplier] optional per-call override (>=1)
 */
function estimateLifetimeValue(attributedRevenue, multiplier = LTV_MULTIPLIER) {
  const v = Number(attributedRevenue) || 0;
  const m = Number.isFinite(multiplier) && multiplier >= 1 ? multiplier : LTV_MULTIPLIER;
  return v * m;
}

module.exports = {
  COST_RATIO,
  LTV_MULTIPLIER,
  netFromGross,
  estimateLifetimeValue
};
