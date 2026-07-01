// Regression guards for the exhaustive audit's top-level probe findings
// (all adversarially confirmed): a critical billing self-upgrade, a critical
// cross-tenant campaign clone, a team-invite privilege escalation, and a
// referral NoSQL injection.

const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../../server', p), 'utf8');

describe('audit probe security fixes', () => {
  it('subscription /verify no longer grants entitlements or trusts body whopUserId', () => {
    const src = read('routes/subscription.js');
    // grant path retired — /verify must not write subscription/whopUserId
    expect(src).not.toMatch(/req\.user\.whopUserId = whopUserId/);
    expect(src).not.toMatch(/req\.user\.subscription = \{/);
    // whopUserId is no longer destructured from the body
    expect(src).not.toMatch(/const \{ whopUserId, whopSubscriptionId \} = req\.body/);
    // report-only response present
    expect(src).toMatch(/whopStatus: subData\.status/);
  });

  it('agency-campaigns clone verifies every client workspace belongs to the agency', () => {
    const src = read('routes/agency-campaigns.js');
    expect(src).toMatch(/verifyClientWorkspaceAccess/);
    // the check runs before the service clone
    const idxCheck = src.indexOf('verifyClientWorkspaceAccess(agencyWorkspaceId, clientWorkspaceId)');
    const idxClone = src.indexOf('cloneCampaignToClients(campaignId, clientWorkspaceIds');
    expect(idxCheck).toBeGreaterThan(0);
    expect(idxCheck).toBeLessThan(idxClone);
  });

  it('teamService.inviteByEmail requires the inviter to be an owner/admin (both branches)', () => {
    const src = read('services/teamService.js');
    // the guard sits between the Team.findById and the invited-user branch
    const idxFind = src.indexOf('const team = await Team.findById(teamId)');
    const idxGuard = src.indexOf("inviterMember.role !== 'owner' && inviterMember.role !== 'admin'");
    const idxInvitedUser = src.indexOf('const invitedUser = await User.findOne');
    expect(idxGuard).toBeGreaterThan(idxFind);
    expect(idxGuard).toBeLessThan(idxInvitedUser);
  });

  it('referralService.applyReferralCode String()-casts the code (no NoSQL injection)', () => {
    const src = read('services/referralService.js');
    expect(src).not.toMatch(/User\.findOne\(\{ referralCode \}\)/);
    expect(src).toMatch(/User\.findOne\(\{ referralCode: String\(referralCode\) \}\)/);
  });
});
