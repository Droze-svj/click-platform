// Registration invite gate.
//
// Keeps sign-up closed during a private beta without building a full invite
// system. Two independent, optional mechanisms (set either or both via env):
//
//   BETA_ALLOWED_EMAILS  comma-separated allowlist — only these emails may register.
//   BETA_INVITE_CODE     a shared secret — the request must include a matching code.
//
// If NEITHER is set, registration is open (current behavior — dev, public launch).
// If both are set, an email on the allowlist OR a valid code is accepted.

const crypto = require('crypto');

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function parseAllowedEmails() {
  return (process.env.BETA_ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @param {{ email?: string, inviteCode?: string }} input
 * @returns {{ allowed: boolean, message?: string }}
 */
function checkRegistrationGate({ email, inviteCode } = {}) {
  const allowed = parseAllowedEmails();
  const code = process.env.BETA_INVITE_CODE;

  // No gate configured → open registration.
  if (allowed.length === 0 && !code) return { allowed: true };

  const emailOk = allowed.length > 0 && email && allowed.includes(String(email).toLowerCase());
  const codeOk = !!code && inviteCode && timingSafeEqualStr(inviteCode, code);

  if (emailOk || codeOk) return { allowed: true };

  let message;
  if (allowed.length > 0 && code) {
    message = 'Sign-up is invite-only right now. Use an invited email address or a valid invite code.';
  } else if (allowed.length > 0) {
    message = 'Sign-up is invite-only right now. This email isn’t on the invite list — ask the team to add it.';
  } else {
    message = 'Sign-up is invite-only right now. Enter a valid invite code to create an account.';
  }
  return { allowed: false, message };
}

/** True when a gate is configured (so the UI can show the invite-code field). */
function isRegistrationGated() {
  return parseAllowedEmails().length > 0 || !!process.env.BETA_INVITE_CODE;
}

module.exports = { checkRegistrationGate, isRegistrationGated };
