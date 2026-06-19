// Resolves the { plan, used } context that tierEnforcement.requireTierLimit
// needs for an agency action. The plan is the agency Workspace's assigned
// AgencyScalePlan (settings.scalePlanId); `used` is the current real usage for
// the action. When no plan is assigned, returns { plan: null } so the evaluator
// treats the action as unlimited — enforcement only kicks in once an agency
// actually has a scale plan, which keeps this safe to roll out everywhere.

const logger = require('../utils/logger');

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Per-action usage counters. Each returns the agency's CURRENT count so the
// evaluator can compare against the plan's included limit.
const USAGE = {
  add_client: async (agencyWorkspaceId) => {
    const ClientOnboarding = require('../models/ClientOnboarding');
    return ClientOnboarding.countDocuments({ agencyWorkspaceId });
  },
  add_profile: async (agencyWorkspaceId) => {
    const SocialConnection = require('../models/SocialConnection');
    return SocialConnection.countDocuments({ agencyWorkspaceId, isActive: true });
  },
  add_team_member: async (agencyWorkspaceId) => {
    const Workspace = require('../models/Workspace');
    const ws = await Workspace.findById(agencyWorkspaceId).select('members').lean();
    return ws && Array.isArray(ws.members) ? ws.members.length : 0;
  },
  generate_report: async (agencyWorkspaceId) => {
    const GeneratedReport = require('../models/GeneratedReport');
    return GeneratedReport.countDocuments({ agencyWorkspaceId, createdAt: { $gte: startOfMonth() } });
  },
};

/**
 * Build a `loadContext(req)` for requireTierLimit(action, loadContext). Resolves
 * the agency workspace id from params or body, loads its assigned plan, and
 * counts current usage for `action`. Returns { plan: null } (→ unlimited) when
 * no agency id or no plan is assigned. Never throws — requireTierLimit fails
 * open, but we also degrade gracefully here.
 */
function loadAgencyTierContext(action) {
  return async (req) => {
    const agencyWorkspaceId =
      (req.params && req.params.agencyWorkspaceId) ||
      (req.body && req.body.agencyWorkspaceId) ||
      null;
    if (!agencyWorkspaceId) return { plan: null, used: 0 };

    const Workspace = require('../models/Workspace');
    const AgencyScalePlan = require('../models/AgencyScalePlan');

    const ws = await Workspace.findById(agencyWorkspaceId).select('settings.scalePlanId').lean();
    const planId = ws && ws.settings && ws.settings.scalePlanId;
    if (!planId) return { plan: null, used: 0 };

    const plan = await AgencyScalePlan.findById(planId).lean();
    if (!plan) return { plan: null, used: 0 };

    let used = 0;
    try {
      used = USAGE[action] ? await USAGE[action](agencyWorkspaceId) : 0;
    } catch (err) {
      logger.warn('[agencyPlanContext] usage count failed; treating as 0', { action, error: err.message });
    }
    return { plan, used };
  };
}

module.exports = { loadAgencyTierContext };
