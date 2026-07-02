// Regression guards for the Batch-3 backup-hardening + mass-assignment residuals
// (audit-b3-backup-massassign).

const fs = require('fs');
const path = require('path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '../../../', rel), 'utf8');

describe('Batch-3 backup + mass-assignment regressions', () => {
  test('#29 restore existence checks are scoped to the caller', () => {
    const src = read('server/services/backupService.js');
    // No unscoped by-id existence probes remain.
    expect(src).not.toMatch(/findById\(item\._id\)/);
    expect(src).toMatch(/Content\.findOne\(\{ _id: item\._id, userId \}\)/);
    expect(src).toMatch(/ScheduledPost\.findOne\(\{ _id: item\._id, userId \}\)/);
    expect(src).toMatch(/Script\.findOne\(\{ _id: item\._id, userId \}\)/);
  });

  test('#31 backup routes unlink the temp file in finally', () => {
    const src = read('server/routes/backup.js');
    // Both /restore and /preview clean up in a finally block.
    const finallies = (src.match(/\} finally \{\s*\n\s*\/\/ Always remove the uploaded temp file/g) || []).length;
    expect(finallies).toBeGreaterThanOrEqual(2);
  });

  test('#32 backup create/export are rate-limited', () => {
    const src = read('server/routes/backup.js');
    expect(src).toMatch(/router\.post\('\/create', auth, uploadLimiter/);
    expect(src).toMatch(/router\.get\('\/export', auth, uploadLimiter/);
  });

  test('#35 customBenchmark update uses an allow-list, not Object.assign', () => {
    const src = read('server/services/customBenchmarkService.js');
    expect(src).not.toMatch(/Object\.assign\(benchmark, updates\)/);
    expect(src).toMatch(/applySafeUpdates\(benchmark, updates, \{ allow: \['name', 'platform', 'metrics', 'isActive'\] \}\)/);
  });
});
