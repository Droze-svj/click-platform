// importFromCalendar returned { imported: 0, message: 'Calendar import not yet
// implemented' } — an endpoint that reported success while doing nothing. It now
// parses the same ICS this service exports (round-trip) and the JSON shape.

const mongoose = require('mongoose');
const ScheduledPost = require('../../../server/models/ScheduledPost');
const { importFromCalendar } = require('../../../server/services/calendarIntegrationService');

const userId = new mongoose.Types.ObjectId().toString();

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Click//Content Scheduler//EN',
  'BEGIN:VEVENT',
  'UID:abc@click.app',
  'DTSTART:20260901T140000Z',
  'DTEND:20260901T150000Z',
  'SUMMARY:Launch day teaser',
  'DESCRIPTION:Platform: instagram\\nThe teaser post',
  'LOCATION:instagram',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:def@click.app',
  'DTSTART:20260902T090000Z',
  'SUMMARY:Follow-up thread',
  'LOCATION:twitter',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('calendar import', () => {
  afterEach(async () => { await ScheduledPost.deleteMany({ userId }); });

  it('creates a scheduled post per VEVENT, at the event start time', async () => {
    const res = await importFromCalendar(userId, ICS, 'ics');

    expect(res.imported).toBe(2);
    expect(res.skipped).toEqual([]);

    const posts = await ScheduledPost.find({ userId }).sort({ scheduledTime: 1 }).lean();
    expect(posts).toHaveLength(2);
    expect(posts[0].platform).toBe('instagram');
    expect(posts[0].content.text).toBe('Launch day teaser');
    expect(new Date(posts[0].scheduledTime).toISOString()).toBe('2026-09-01T14:00:00.000Z');
    expect(posts[1].platform).toBe('twitter');
  });

  it('imports as pending_approval so nothing auto-publishes to a real account', async () => {
    await importFromCalendar(userId, ICS, 'ics');
    const posts = await ScheduledPost.find({ userId }).lean();
    // The publish cron only selects status:'scheduled'.
    for (const p of posts) expect(p.status).toBe('pending_approval');
    expect(await ScheduledPost.countDocuments({ userId, status: 'scheduled' })).toBe(0);
  });

  it('skips events it cannot import instead of aborting the whole file', async () => {
    const mixed = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT', 'DTSTART:20260901T140000Z', 'SUMMARY:Good', 'LOCATION:tiktok', 'END:VEVENT',
      // No platform → ScheduledPost.platform is a required enum.
      'BEGIN:VEVENT', 'DTSTART:20260901T150000Z', 'SUMMARY:No platform', 'END:VEVENT',
      // Unparseable start.
      'BEGIN:VEVENT', 'DTSTART:not-a-date', 'SUMMARY:Bad date', 'LOCATION:tiktok', 'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const res = await importFromCalendar(userId, mixed, 'ics');
    expect(res.imported).toBe(1);
    expect(res.skipped).toHaveLength(2);
    expect(res.skipped.map((s) => s.reason).join(' ')).toMatch(/platform|start time/);
  });

  it('unfolds RFC 5545 folded lines and unescapes text', async () => {
    const folded = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20260901T140000Z',
      'SUMMARY:A very long title that the exporter',
      '  folded across lines',
      'LOCATION:linkedin',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const res = await importFromCalendar(userId, folded, 'ics');
    expect(res.imported).toBe(1);
    const post = await ScheduledPost.findOne({ userId }).lean();
    expect(post.content.text).toBe('A very long title that the exporter folded across lines');
  });

  it('accepts the JSON calendar shape too', async () => {
    const json = {
      events: [
        { title: 'From JSON', start: '2026-09-03T10:00:00.000Z', platform: 'youtube' },
      ],
    };
    const res = await importFromCalendar(userId, json, 'json');
    expect(res.imported).toBe(1);
    const post = await ScheduledPost.findOne({ userId }).lean();
    expect(post.platform).toBe('youtube');
  });

  it('rejects missing input rather than reporting a successful no-op', async () => {
    await expect(importFromCalendar(userId, null, 'ics')).rejects.toThrow(/calendarData is required/);
    await expect(importFromCalendar(null, ICS, 'ics')).rejects.toThrow(/userId is required/);
    await expect(importFromCalendar(userId, ICS, 'xlsx')).rejects.toThrow(/Unsupported calendar format/);
  });
});
