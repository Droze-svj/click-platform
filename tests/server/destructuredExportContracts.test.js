/**
 * Exhaustive version of the export-mismatch guard.
 *
 * serviceExportContracts.test.js pins a hand-written list of contracts that were
 * fixed once. This one instead walks EVERY `const { a, b } = require('./x')` in
 * the server tree and asserts each destructured name actually exists on the
 * module being imported. A name that does not is silently `undefined`, and the
 * failure only surfaces as "x is not a function" if and when that line runs —
 * which is why several sat undetected: they were imported at the top of a file
 * and never called, so nothing ever threw.
 *
 * Cleared in the 2026-09-10 sweep (7 bindings across 6 files, all dead imports
 * pointing at names their target never exported — e.g. `uploadFileToS3` when
 * storageService exports `uploadFile`, and `trackApiCall` when
 * performanceMonitoringService exports `trackAPIRequest`).
 */

const fs = require('fs');
const path = require('path');

const SERVER = path.join(__dirname, '../../server');
const DIRS = ['routes', 'services', 'middleware', 'workers', 'jobs']
  .map((d) => path.join(SERVER, d))
  .filter((d) => fs.existsSync(d));

const DESTRUCTURED_REQUIRE = /const\s*\{([^}]+)\}\s*=\s*require\(\s*['"](\.[^'"]+)['"]\s*\)/g;

/** `{ a, b: c, d = 1 }` -> ['a','b','d'] (the names read off the module). */
function importedNames(clause) {
  return clause
    .split(',')
    .map((s) => s.split(':')[0].trim().replace(/\s*=.*$/, ''))
    .filter((n) => /^[A-Za-z_$][\w$]*$/.test(n));
}

describe('destructured requires match what the target module exports', () => {
  const files = DIRS.flatMap((dir) =>
    fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f))
  );

  it('finds the server source files', () => {
    // Floor, so a broken walk cannot make the real assertion vacuously pass.
    expect(files.length).toBeGreaterThan(200);
  });

  it('every destructured name exists on the module it is required from', () => {
    const missing = [];

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(DESTRUCTURED_REQUIRE)) {
        let mod;
        try {
          mod = require(path.resolve(path.dirname(file), m[2]));
        } catch {
          // A module that cannot be loaded in the test env (missing optional
          // dep, side-effectful boot) is out of scope here — routeMounts and
          // the smoke sweeps cover loadability.
          continue;
        }
        // Only object/function exports can carry named properties.
        if (mod == null || (typeof mod !== 'object' && typeof mod !== 'function')) continue;

        for (const name of importedNames(m[1])) {
          if (!(name in mod)) {
            missing.push(`${path.relative(SERVER, file)} <- ${m[2]} :: ${name}`);
          }
        }
      }
    }

    expect(missing.sort()).toEqual([]);
  });
});
