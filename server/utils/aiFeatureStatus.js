// AI feature wiring status — reports which OPTIONAL external-AI integrations are
// configured, so an operator can VERIFY the wiring after adding keys to the env
// store (via the startup log or GET /api/admin/ai-features).
//
// Each feature's required env vars are the SAME ones the corresponding service
// checks before it does real work (else it returns an honest notImplemented). A
// feature is:
//   - 'enabled'      → all required vars for at least one provider are set
//   - 'misconfigured'→ SOME (but not all) of a required set are set. This is the
//                      important one: a half-set integration silently stays off,
//                      which looks like "my key didn't work". We surface it loudly.
//   - 'disabled'     → none set (intentionally off; shows honest "coming soon").
//
// It only ever reports PRESENCE (boolean), never the secret values.

const FEATURES = [
  { key: 'voiceDubbing', label: 'Voice dubbing (ElevenLabs)', requires: ['ELEVENLABS_API_KEY'] },
  { key: 'eyeContact', label: 'Eye-contact fix', requires: ['EYE_CONTACT_API_URL', 'EYE_CONTACT_API_KEY'] },
  {
    key: 'aiAvatar',
    label: 'AI avatar (HeyGen or Sora)',
    // Either provider fully satisfies it.
    requiresAny: [['HEYGEN_API_KEY'], ['SORA_API_KEY', 'SORA_GATEWAY_URL']],
  },
  { key: 'objectRemoval', label: 'Temporal object removal', requires: ['OBJECT_REMOVAL_API_URL', 'OBJECT_REMOVAL_API_KEY'] },
  { key: 'bgReplace', label: 'Generative background replace', requires: ['BG_REPLACE_API_URL', 'BG_REPLACE_API_KEY'] },
];

function isSet(env, v) { return !!(env[v] && String(env[v]).trim()); }

function statusFor(feature, env) {
  const has = (v) => isSet(env, v);
  if (feature.requiresAny) {
    const groups = feature.requiresAny;
    if (groups.some((g) => g.every(has))) return { state: 'enabled', providers: groups };
    const partial = groups.some((g) => g.some(has) && !g.every(has));
    return { state: partial ? 'misconfigured' : 'disabled', providers: groups };
  }
  const req = feature.requires;
  const missing = req.filter((v) => !has(v));
  if (missing.length === 0) return { state: 'enabled', requires: req };
  if (missing.length < req.length) return { state: 'misconfigured', requires: req, missing };
  return { state: 'disabled', requires: req };
}

/** Full status array for every optional AI feature. */
function aiFeatureStatus(env = process.env) {
  return FEATURES.map((f) => ({ feature: f.key, label: f.label, ...statusFor(f, env) }));
}

/** Compact { enabled: [...], misconfigured: [...] } summary for a boot log. */
function summarize(env = process.env) {
  const all = aiFeatureStatus(env);
  return {
    enabled: all.filter((f) => f.state === 'enabled').map((f) => f.feature),
    misconfigured: all.filter((f) => f.state === 'misconfigured').map((f) => ({ feature: f.feature, missing: f.missing })),
  };
}

module.exports = { aiFeatureStatus, summarize, FEATURES };
