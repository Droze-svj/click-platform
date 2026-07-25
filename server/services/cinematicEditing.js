/**
 * cinematicEditing.js
 *
 * Click's "unlimited insight on cinematic editing craft" — the motion/rhythm/
 * sound/composition counterpart to marketingKnowledge.js. It is a single source
 * of truth AI-facing planners (AI Director, auto-edit) pull from so generated
 * edit plans follow proven cinematic principles instead of decorating every cut.
 *
 * The principles are a "case-law" distillation adapted from real product-video
 * rework (motion-design practice; see video-shotcraft's aesthetic case-law),
 * re-expressed against Click's concrete step vocabulary (cut / hook / transition /
 * effect / caption / color / pacing / cta / audio / broll) so a model can act on
 * them. Each rule is one executable sentence + a self-check the reviewer can run.
 *
 * Usage:
 *   const { buildEditingPrinciples, EDITING_PRINCIPLES } = require('./cinematicEditing');
 *   sections.push('', buildEditingPrinciples());
 */

// R — RHYTHM · Q — MOTION/COMPOSITION · S — SOUND · C — COPY · P — STRUCTURE.
// Kept terse and Click-vocabulary-specific so it stays actionable in a prompt.
const EDITING_PRINCIPLES = [
  { id: 'R1', text: 'Let key moments breathe: after a hook, a headline caption, or the CTA lands, hold it ≥1s before cutting away. Give the pause to the point you want remembered, not to filler.' },
  { id: 'R2', text: 'Speed comes from ACCELERATION, not uniform fast cutting. A rapid sequence should get tighter toward a beat; after it, insert a ~0.3–0.5s rest before the next beat. Never machine-gun equal-length cuts.' },
  { id: 'R3', text: 'Default a touch SLOWER than feels right: the opening beat and any demonstrated action need ≥2–3s to read. First cuts are almost always too fast — favor pacing "steady"/"dynamic" over relentless "punchy".' },
  { id: 'Q3', text: 'Keep the frame stable. Do not add shake/jitter-style motion to talking-head or product footage unless a gritty documentary mood is explicitly wanted.' },
  { id: 'Q4', text: 'Flashy effects (vhs-glitch, chromatic-aberration, light-leak, film-burn) are a SEASONING, not a coat of paint. Use at most one as a signature moment; never one on every cut. Grain/vignette can be constant; glitches cannot.' },
  { id: 'Q5', text: 'Open on ONE clear subject/idea — a single strong hook — not a wall of effects or competing captions. First impression = one thing done well.' },
  { id: 'Q6', text: 'Transitions serve the cut, not decoration: pick a transition because it fits that specific edit point. Do not apply the same showy transition (whip/glitch/zoom) to every boundary.' },
  { id: 'S1', text: 'Use a cinematic SFX vocabulary — whoosh on moves, impact on a landing/reveal, riser before a reveal, sparkle on a highlight, a transition swell on cuts. Never tinny "game-UI" click/pluck sounds on a product video.' },
  { id: 'S4', text: 'Match sound to the on-screen action (foley) — a real typing sound over typing, a pop per item that drops in — rather than a generic whoosh smeared over everything. For a rapid repeated SFX, step the volume DOWN across the burst so it does not machine-gun.' },
  { id: 'C1', text: 'Captions must match what is on screen at that moment. Do not leave >3s of pure animation with no caption/voice; the brand/outro card is the one allowed clean, text-light beat.' },
  { id: 'C2', text: 'Write concrete hooks and CTAs — the specific benefit, number, or feature name — not abstract slogans. Replace vague metaphors with the real payoff.' },
  { id: 'Q8', text: 'Build the ending to the energy PEAK: the CTA/outro is the highest-energy beat (riser → impact → sparkle, a strong final caption). Do not let the video taper off.' },
  { id: 'P4', text: 'One technique is the hero only ONCE — do not make the same effect or transition the centerpiece twice. Every step must add NEW information or value; cut anything that repeats an earlier beat or line.' },
];

/**
 * A compact, model-actionable prompt block of the principles. Injected into edit
 * planners' prompts so plans follow cinematic craft. Terse on purpose.
 */
function buildEditingPrinciples() {
  const lines = EDITING_PRINCIPLES.map((p) => `  - ${p.id}. ${p.text}`);
  return [
    'CINEMATIC EDITING PRINCIPLES (apply when choosing steps, pacing, and their timing):',
    ...lines,
  ].join('\n');
}

module.exports = { EDITING_PRINCIPLES, buildEditingPrinciples };
