/**
 * COPPA / under-13 gate.
 *
 * Click is not directed to children under 13. Server-side enforcement at
 * registration: reject under-13 outright, require parental consent for 13–17.
 * The actual verifiable consent flow (parent email → tokenized verify link)
 * is staged here as a stub that returns a token; the email-sending wiring
 * lives alongside the existing transactional email path used by /verify-email.
 *
 * Don't trust the client. Always recompute age server-side from
 * `dateOfBirth`; the gate runs even if the UI age widget is bypassed.
 */

const crypto = require('crypto');

const MIN_AGE_FREE = 13;
const MIN_AGE_NO_CONSENT = 18;

function parseDob(input) {
  if (!input) return null;
  // Accept ISO 8601 (YYYY-MM-DD) or full ISO datetime.
  const dt = new Date(input);
  if (!isFinite(dt.getTime())) return null;
  if (dt.getTime() > Date.now()) return null; // future DOB
  return dt;
}

function computeAge(dob, now = new Date()) {
  if (!(dob instanceof Date) || !isFinite(dob.getTime())) return -1;
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

/**
 * Validate registration eligibility.
 *
 * @returns {
 *   ok: boolean,
 *   reason?: string,           // user-facing error
 *   age?: number,
 *   needsParentalConsent: boolean,
 *   parentalConsent?: { token: string, parentalEmail: string }
 * }
 */
function assertEligibility({ dateOfBirth, parentalEmail }) {
  const dob = parseDob(dateOfBirth);
  if (!dob) {
    return {
      ok: false,
      reason: 'Date of birth is required to create an account.',
      needsParentalConsent: false,
    };
  }
  const age = computeAge(dob);

  if (age < MIN_AGE_FREE) {
    return {
      ok: false,
      reason:
        'Click is not available for users under 13. If you believe this is a mistake, contact privacy@click.example.',
      age,
      needsParentalConsent: false,
    };
  }

  if (age < MIN_AGE_NO_CONSENT) {
    if (!parentalEmail || typeof parentalEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentalEmail)) {
      return {
        ok: false,
        reason:
          'Users 13–17 require a valid parent or guardian email for verifiable consent.',
        age,
        needsParentalConsent: true,
      };
    }
    const token = crypto.randomBytes(24).toString('hex');
    return {
      ok: true,
      age,
      needsParentalConsent: true,
      parentalConsent: { token, parentalEmail },
    };
  }

  return { ok: true, age, needsParentalConsent: false };
}

module.exports = {
  assertEligibility,
  computeAge,
  parseDob,
  MIN_AGE_FREE,
  MIN_AGE_NO_CONSENT,
};
