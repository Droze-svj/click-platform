// Regression guard: these membership-tier service functions fetched a user by id
// and immediately dereferenced `user.membershipPackage` (or `user._id`) with no
// null check. A valid-but-nonexistent userId (e.g. a JWT for a since-deleted user)
// therefore produced a 500 "Cannot read properties of null" instead of a clean
// 404. Each now throws NotFoundError (statusCode 404) for a missing user.
//
// Only functions whose guard is reachable AND surfaced on an empty DB are
// asserted here; the ones that return early before their guard (forecastUsage,
// getWinBackOffer) or swallow errors to a default (getUsageAlerts) are covered
// by the live-endpoint check that proved all five routes now return 404.

const mongoose = require('mongoose');
const connectTestDb = require('../helpers/connectTestDb');
const { NotFoundError } = require('../../server/utils/errorHandler');

const pricingService = require('../../server/services/pricingService');
const prioritySupportService = require('../../server/services/prioritySupportService');
const complianceService = require('../../server/services/complianceService');

beforeAll(async () => { await connectTestDb(); });

describe('membership-tier services return 404 (not a 500 null-deref) for a missing user', () => {
  // A syntactically valid ObjectId that matches no user in the DB.
  const ghostId = new mongoose.Types.ObjectId().toString();

  const cases = [
    ['pricingService.getRecommendedPackage', () => pricingService.getRecommendedPackage(ghostId)],
    ['prioritySupportService.getSupportSLA', () => prioritySupportService.getSupportSLA(ghostId)],
    ['complianceService.exportUserData', () => complianceService.exportUserData(ghostId)],
  ];

  test.each(cases)('%s throws NotFoundError with statusCode 404', async (_name, fn) => {
    await expect(fn()).rejects.toBeInstanceOf(NotFoundError);
    await expect(fn()).rejects.toMatchObject({ statusCode: 404 });
  });
});
