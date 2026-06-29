// env — ONE source of truth for environment predicates.
//
// The codebase historically mixed two conventions: `NODE_ENV !== 'production'`
// (which treats staging — and an UNSET NODE_ENV — as dev/permissive) and
// `NODE_ENV === 'production' || === 'staging'` (which treats staging as
// prod/hardened). These helpers make the intent explicit so security gates and
// operational toggles stop disagreeing about staging / unset.

const isProduction = () => process.env.NODE_ENV === 'production';
const isStaging = () => process.env.NODE_ENV === 'staging';
/** Hardening should be ON: production OR staging. */
const isProductionLike = () => isProduction() || isStaging();
const isDevelopment = () => process.env.NODE_ENV === 'development';
const isTest = () => process.env.NODE_ENV === 'test';

/** Running on a managed cloud platform (i.e. actually DEPLOYED, not local). */
const isCloudPlatform = () =>
  !!(process.env.RENDER || process.env.HEROKU || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

/**
 * Fail-closed boot check. If we are clearly DEPLOYED (on a cloud platform) but
 * NODE_ENV is unset / development / test, that is dangerous: every
 * `NODE_ENV !== 'production'` gate (CORS-localhost allowance, verbose error
 * bodies, relaxed hardening) silently turns ON in a live environment. This logs
 * a loud error so the misconfiguration is caught. It deliberately does NOT mutate
 * process.env.NODE_ENV (that could surprise other modules) — the fix is to set
 * NODE_ENV correctly on the host.
 * @returns {boolean} true when the env looks sane, false when a misconfig was found
 */
function assertDeployedEnvSane(logger) {
  if (isCloudPlatform() && !isProductionLike()) {
    // Last-resort fallback to console only when no logger is supplied (this util
    // is low-level and must not pull in the logger module to avoid a require cycle).
    // eslint-disable-next-line no-console
    const log = (logger && logger.error) ? logger.error.bind(logger) : console.error;
    log(
      `[env] ⚠️  DEPLOYED on a cloud platform but NODE_ENV='${process.env.NODE_ENV || '(unset)'}'. ` +
      `Non-production gates (CORS localhost, verbose errors, relaxed security) are ACTIVE in a deployed ` +
      `environment. Set NODE_ENV=production (or staging) on this host.`
    );
    return false;
  }
  return true;
}

module.exports = {
  isProduction,
  isStaging,
  isProductionLike,
  isDevelopment,
  isTest,
  isCloudPlatform,
  assertDeployedEnvSane,
};
