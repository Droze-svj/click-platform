// applyPersona — the single, uniform way a feature service prepends a creator's
// learned voice/brand/style system prompt onto a task prompt before an AI call.
//
// The googleAI wrapper (Gemini) bakes its own generic "elite creative director"
// systemInstruction and has no per-call system slot, so per-user personalization
// has to ride in the prompt text itself (same technique social-responder uses).
// A service passes its already-built task prompt plus the request's userId; if a
// `buildSystemPrompt` dep is wired (→ personalizationService.buildPersonalizedSystemPrompt)
// and a userId is present, the creator's persona is prepended. Everything is
// best-effort: a missing dep, missing userId, or a thrown personalization call
// falls back to the untouched task prompt so generation is NEVER blocked.
//
// deps.buildSystemPrompt: (args) => Promise<string>  (optional)

async function applyPersona(taskPrompt, { deps, userId, platform, niche, stage, role = 'copywriter' } = {}) {
  try {
    if (!deps || typeof deps.buildSystemPrompt !== 'function' || !userId) return taskPrompt;
    const sys = await deps.buildSystemPrompt({ userId, platform, niche, role, stage });
    if (!sys || !String(sys).trim()) return taskPrompt;
    return `${sys}\n\n── Task ──\n${taskPrompt}`;
  } catch (_) {
    // Personalization must never break the generator — fall back to the base prompt.
    return taskPrompt;
  }
}

module.exports = { applyPersona };
