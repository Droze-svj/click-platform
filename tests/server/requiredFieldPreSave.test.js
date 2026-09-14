/**
 * Guard for a whole bug class: a REQUIRED schema field whose value is first
 * assigned inside a `pre('save')` hook.
 *
 * Mongoose registers its own validation hook when the schema is constructed, so
 * that hook runs BEFORE any user-defined `pre('save')`. A required field that is
 * only populated in `pre('save')` is therefore still undefined when it is
 * validated, and EVERY save() of that model fails with
 * "Path `x` is required" — regardless of what the caller passed.
 *
 * This failed silently and totally: SupportTicket.ticketNumber killed all three
 * ticket-creating features (billing support, help-center tickets, invoice
 * correction requests), and SupportChat.chatId, EmailApprovalToken.token,
 * MembershipPackage.slug and Scene.duration were broken the same way.
 *
 * The fix is either a field `default:` (for self-contained generated values) or
 * a `pre('validate')` hook (for values derived from sibling fields).
 *
 * NOTE this only flags hooks that SUPPLY a missing value. Assignments that
 * TRANSFORM the field's own existing value — `this.password =
 * await bcrypt.hash(this.password, …)` — are fine: the caller supplied it, so
 * validation passes. They are recognised by the field appearing on the
 * right-hand side.
 */

const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '../../server/models');

/** Field names declared `required: true` with no `default:` in the same block. */
function requiredFieldsWithoutDefault(src) {
  const found = new Set();
  const block = /(\w+)\s*:\s*\{(?:[^{}]|\{[^{}]*\})*?\}/g;
  let m;
  while ((m = block.exec(src))) {
    if (/required\s*:\s*true/.test(m[0]) && !/default\s*:/.test(m[0])) found.add(m[1]);
  }
  return found;
}

/** Bodies of every `.pre('save', …)` hook in the file. */
function preSaveHooks(src) {
  return [...src.matchAll(/\.pre\(\s*['"]save['"][\s\S]*?\n\}\);/g)].map((h) => h[0]);
}

describe('required fields are never first assigned in pre(save)', () => {
  const files = fs.readdirSync(MODELS_DIR).filter((f) => f.endsWith('.js'));

  it('finds the model files', () => {
    // Floor, so a broken walk cannot make the real assertion vacuously pass.
    expect(files.length).toBeGreaterThan(50);
  });

  it('no model populates a required field in pre(save)', () => {
    const offenders = [];

    for (const file of files) {
      const src = fs.readFileSync(path.join(MODELS_DIR, file), 'utf8');
      const required = requiredFieldsWithoutDefault(src);
      if (!required.size) continue;

      for (const body of preSaveHooks(src)) {
        for (const field of required) {
          const assignment = new RegExp(`this\\.${field}\\s*=\\s*([^;\\n]*)`);
          const hit = body.match(assignment);
          if (!hit) continue;
          // Transforming the field's own value is safe — the caller supplied it.
          if (new RegExp(`this\\.${field}\\b`).test(hit[1])) continue;
          offenders.push(`${file}: ${field}`);
        }
      }
    }

    expect(offenders.sort()).toEqual([]);
  });
});
