// Guards the /api/posts scheduled-blog-post fix. That path used to enqueue to the
// SCHEDULED_POSTS BullMQ queue — which has NO worker — so a scheduled blog post
// was stored but NEVER published, while the API logged "scheduled successfully".
// Fix: drop the dead enqueue; auto-publish lazily on GET once scheduled_at passes.
// (The path is Supabase-only, so it can't be integration-tested in CI — this locks
// the shape so the dead-queue coupling can't silently return.)

const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '../../../server/routes/posts.js'), 'utf8');

describe('/api/posts scheduling — no dead queue, lazy publish', () => {
  it('no longer imports or calls the consumer-less addScheduledPostJob', () => {
    expect(SRC).not.toMatch(/addScheduledPostJob/);
    expect(SRC).not.toMatch(/require\(['"]\.\.\/queues['"]\)/);
  });

  it('does not falsely claim "scheduled successfully via background job"', () => {
    expect(SRC).not.toMatch(/scheduled successfully via background job/);
  });

  it('lazy-publishes due scheduled posts (status scheduled -> published where scheduled_at <= now)', () => {
    // the update flips scheduled -> published, scoped to the author + due time.
    expect(SRC).toMatch(/status:\s*'published'/);
    expect(SRC).toMatch(/\.eq\(\s*'status'\s*,\s*'scheduled'\s*\)/);
    expect(SRC).toMatch(/\.lte\(\s*'scheduled_at'/);
  });
});
