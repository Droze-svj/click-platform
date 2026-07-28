// musicLicensingProviderService — honest stub.
//
// Committed BLANK (0 bytes) → callers hit "searchTracksAcrossProviders is not a
// function". Consumers (musicCatalogSync, musicLicensingSync, musicCatalogService)
// are orphan/unmounted — none request-reachable. Export the function surface with
// honest empty results so nothing crashes. Real licensed-music provider integration
// (Epidemic Sound / Artlist / etc.) is a future feature; until credentials + a
// provider adapter exist, there are no providers to search.

const logger = require('../utils/logger');

let warned = false;
function warnOnce(fn) {
  if (warned) return;
  warned = true;
  logger.warn(`[musicLicensingProviderService] not implemented — ${fn} is a no-op. Licensed-music sync is inert until a provider adapter is added.`);
}

/** @returns {Promise<Array>} no providers configured → empty result set */
async function searchTracksAcrossProviders(_query, _options = {}) {
  warnOnce('searchTracksAcrossProviders');
  return [];
}

/** @returns {null} unknown provider id → null (caller skips) */
function getProvider(_providerId) {
  warnOnce('getProvider');
  return null;
}

/** @returns {Promise<null>} nothing persisted — no provider to license from */
async function storeLicensedTrack(_track, _meta = {}) {
  warnOnce('storeLicensedTrack');
  return null;
}

module.exports = { searchTracksAcrossProviders, getProvider, storeLicensedTrack };
