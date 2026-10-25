#!/usr/bin/env node
/**
 * coverage-merge-check.js — merge the coverage the unit and integration CI
 * steps already collected, write one lcov report, and enforce jest.config.js's
 * coverageThreshold on the merged numbers.
 *
 * CI used to re-run every unit + integration suite a SECOND time, serially in
 * one process, just to measure coverage (~75–190 min). That run starved the
 * runner until GitHub lost contact with it ("The hosted runner lost
 * communication with the server") and blocked merges. The test steps now
 * collect coverage themselves; this only merges and checks.
 *
 *   node scripts/coverage-merge-check.js coverage/unit coverage/integration
 *
 * Exit 1 when a threshold is missed or an input is missing (so a step that
 * silently produced no coverage can't pass the ratchet).
 */

const fs = require('fs');
const path = require('path');
const libCoverage = require('istanbul-lib-coverage');
const libReport = require('istanbul-lib-report');
const reports = require('istanbul-reports');

const dirs = process.argv.slice(2);
if (!dirs.length) {
  console.error('usage: coverage-merge-check.js <coverage dir>...');
  process.exit(2);
}

const map = libCoverage.createCoverageMap({});
for (const dir of dirs) {
  const file = path.join(dir, 'coverage-final.json');
  if (!fs.existsSync(file)) {
    console.error(`::error::missing ${file} — that test step produced no coverage`);
    process.exit(1);
  }
  map.merge(JSON.parse(fs.readFileSync(file, 'utf8')));
}

const outDir = path.resolve('coverage');
const context = libReport.createContext({ dir: outDir, coverageMap: map });
for (const r of ['lcovonly', 'json', 'text-summary']) reports.create(r).execute(context);

const summary = map.getCoverageSummary().toJSON();
const thresholds = (require(path.join(__dirname, '..', 'jest.config.js')).coverageThreshold || {}).global || {};
const failures = [];
for (const [metric, min] of Object.entries(thresholds)) {
  const pct = summary[metric] && summary[metric].pct;
  if (typeof pct !== 'number' || pct < min) failures.push(`${metric} ${pct}% < ${min}%`);
}
console.log(`merged ${dirs.length} report(s): ` + ['lines', 'statements', 'functions', 'branches'].map((m) => `${m} ${summary[m].pct}%`).join(', '));
if (failures.length) {
  console.error(`::error::coverage below threshold: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('coverage thresholds met');
