// Tier-limit enforcement — gates agency actions at the API boundary against the
// AgencyScalePlan limits, so an agency can't silently oversell past its plan
// (add an 11th client on a 10-client tier, schedule post #1001 on a 1000/mo
// tier, etc.). Mirrors the costGuard pattern: a clean 402 with an upgrade
// payload, or pass-through when the overage rate allows pay-as-you-go.

const logger = require('../utils/logger');

const LIMIT_PATH = {
  add_client: (plan) => plan && plan.bundle && plan.bundle.clients,
  add_profile: (plan) => plan && plan.bundle && plan.bundle.profiles,
  ai_minutes: (plan) => plan && plan.bundle && plan.bundle.aiMinutes,
  add_team_member: (plan) => (plan && plan.limits ? { included: plan.limits.teamMembers } : null),
  api_call: (plan) => (plan && plan.limits ? { included: plan.limits.apiCalls } : null),
  generate_report: (plan) => (plan && plan.limits ? { included: plan.limits.reports } : null),
};

/**
 * PURE: decide whether one more `action` is within the plan.
 *   { allowed, unlimited?, limit, used, remaining, overage?, reason?, upgrade? }
 * - No plan / no limit configured → allowed (don't block when unconfigured).
 * - At/over the included limit BUT overageRate>0 → allowed with `overage:true`.
 * - At/over with no overage → blocked (402 upstream).
 */
function evaluateTierLimit(action, plan, used) {
  const node = LIMIT_PATH[action] ? LIMIT_PATH[action](plan) : null;
  const included = node && Number(node.included);
  if (!node || !Number.isFinite(included)) {
    return { allowed: true, unlimited: true, action };
  }
  const u = Math.max(0, Number(used) || 0);
  if (u < included) {
    return { allowed: true, action, limit: included, used: u, remaining: included - u };
  }
  const overageRate = Number(node.overageRate) || 0;
  if (overageRate > 0) {
    return { allowed: true, overage: true, action, limit: included, used: u, remaining: 0, overageRate };
  }
  return {
    allowed: false,
    action,
    limit: included,
    used: u,
    remaining: 0,
    reason: `Plan limit reached for ${action.replace(/_/g, ' ')}: ${u}/${included}.`,
    upgrade: { message: 'Upgrade your plan or enable overage to continue.', action, limit: included },
  };
}

/**
 * Express middleware factory. `loadContext(req) → { plan, used }` resolves the
 * agency's plan + current usage for the action; on a blocked result it returns
 * 402 with the upgrade payload, else attaches `req.tierCheck` and continues.
 * Fails OPEN (allows) if context resolution throws — never hard-block on an
 * infra blip.
 */
function requireTierLimit(action, loadContext) {
  return async (req, res, next) => {
    try {
      const { plan, used } = (await loadContext(req)) || {};
      const result = evaluateTierLimit(action, plan, used);
      req.tierCheck = result;
      if (!result.allowed) {
        return res.status(402).json({ success: false, error: result.reason, code: 'TIER_LIMIT', upgrade: result.upgrade });
      }
      return next();
    } catch (err) {
      logger.warn('[tier] enforcement check failed; allowing', { action, error: err.message });
      return next();
    }
  };
}

module.exports = { evaluateTierLimit, requireTierLimit };
