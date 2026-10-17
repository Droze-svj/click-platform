// Behavioral tests for the Morning Brief core (pure build/themes/delivery timing).

const {
  extractQuestionThemes,
  buildBrief,
  summarize,
  renderBriefEmail,
  sendBrief,
  isValidTimeZone,
  localClock,
  isDue,
  deliverDueBriefs,
} = require('../../server/services/morningBriefService');

const NOW = Date.parse('2026-10-17T06:00:00Z');
const HOUR = 3600 * 1000;

describe('morningBrief.extractQuestionThemes', () => {
  test('finds a word asked about in separate questions, with a real example', () => {
    const themes = extractQuestionThemes([
      'What microphone do you use?',
      'which microphone is that??',
      'How do you edit so fast?',
      'Is that microphone expensive?',
      'how long does editing take you?',
    ]);
    expect(themes[0]).toEqual({ theme: 'microphone', count: 3, example: 'What microphone do you use?' });
  });

  test('ignores stopwords, short words, numbers, links and handles; needs 2+ askers', () => {
    const themes = extractQuestionThemes([
      'what do you think about this? https://spam.example/x @someone',
      'what would you do 2026?',
      'Where is the course link?',
    ]);
    expect(themes).toEqual([]);
  });

  test('returns distinct asks (one theme per example) capped at max', () => {
    const qs = ['pricing for coaching?', 'coaching pricing?', 'lighting setup?', 'lighting setup please?', 'camera model?', 'camera model?'];
    const themes = extractQuestionThemes(qs, { max: 2 });
    expect(themes).toHaveLength(2);
    expect(new Set(themes.map((t) => t.example)).size).toBe(2);
  });
});

describe('morningBrief.buildBrief', () => {
  test('with no data every section is honest-empty and make-next is advice, not a metric', () => {
    const b = buildBrief({ now: NOW });
    expect(b.performance).toBeNull();
    expect(b.sales).toBeNull();
    expect(b.audience).toMatchObject({ scanned: 0, questions: 0, leads24h: 0, themes: [] });
    expect(b.needsYou).toEqual([]);
    expect(b.makeNext.source).toBe('baseline');
    expect(b.hasData).toBe(false);
  });

  test('performance shows week-over-week change only when there is a baseline', () => {
    const b = buildBrief({ now: NOW, week: { totalViews: 1500, totalEngagement: 90 }, priorWeek: { totalViews: 1000, totalEngagement: 0 } });
    expect(b.performance).toMatchObject({ views: 1500, viewsChangePct: 50, engagement: 90, engagementChangePct: null });
    expect(b.performance.window).toMatch(/last 7 days/);
  });

  test('sales section reports 24h + 7d and the day-over-day revenue change', () => {
    const b = buildBrief({
      now: NOW,
      sales: { day: { count: 2, revenue: 994, currency: 'USD' }, priorDay: { count: 1, revenue: 497 }, week: { count: 6, revenue: 2982, currency: 'USD' } },
    });
    expect(b.sales).toEqual({ currency: 'USD', last24h: { count: 2, revenue: 994 }, revenueChangePct: 100, last7d: { count: 6, revenue: 2982 } });
  });

  test('a zero-sale week hides the sales section rather than showing $0 as news', () => {
    const b = buildBrief({ now: NOW, sales: { day: { count: 0, revenue: 0 }, priorDay: { count: 0, revenue: 0 }, week: { count: 0, revenue: 0 } } });
    expect(b.sales).toBeNull();
  });

  test('recurring audience questions drive make-next; leads and pending work land in needs-you', () => {
    const recent = new Date(NOW - 2 * HOUR).toISOString();
    const old = new Date(NOW - 3 * 24 * HOUR).toISOString();
    const b = buildBrief({
      now: NOW,
      inbound: [
        { text: 'What microphone do you use?', createdAt: old },
        { text: 'which microphone is that?', createdAt: recent },
        { text: 'How much is the course? I want to buy', createdAt: recent },
        { text: 'love this!!', createdAt: recent },
      ],
      pending: { replies: 3, signoffs: 1 },
      digestActions: [{ source: 'next-best', title: 'Ignored when the audience is asking', detail: '' }],
    });
    expect(b.audience).toMatchObject({ scanned: 4, questions: 2 });
    expect(b.makeNext).toMatchObject({ source: 'audience', title: 'Answer this: "What microphone do you use?"' });
    expect(b.makeNext.why).toMatch(/2 separate questions/);
    expect(b.needsYou.map((n) => n.id)).toEqual(expect.arrayContaining(['replies', 'signoffs']));
    expect(b.needsYou.find((n) => n.id === 'signoffs').link).toBe('/dashboard/approvals');
    expect(b.hasData).toBe(true);
  });

  test('falls back to the weekly digest next-best idea when nobody is asking anything', () => {
    const b = buildBrief({ now: NOW, digestActions: [{ source: 'baseline', title: 'x' }, { source: 'next-best', title: 'Part 2 of your hook test', detail: 'Your top performer' }] });
    expect(b.makeNext).toEqual({ source: 'next-best', title: 'Part 2 of your hook test', why: 'Your top performer' });
  });
});

describe('morningBrief.summarize', () => {
  test('one line: headline numbers then make-next', () => {
    const b = buildBrief({ now: NOW, week: { totalViews: 12400, totalEngagement: 300 }, pending: { replies: 2 } });
    expect(summarize(b)).toBe("12,400 views on this week's posts · 2 things need you. Make next: Answer the question you hear most");
  });
});

describe('morningBrief delivery timing', () => {
  test('validates IANA timezones', () => {
    expect(isValidTimeZone('Europe/Rome')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });

  test('localClock gives the local date + hour', () => {
    expect(localClock(NOW, 'Europe/Rome')).toEqual({ date: '2026-10-17', hour: 8 });
    expect(localClock(NOW, 'America/New_York')).toEqual({ date: '2026-10-17', hour: 2 });
    expect(localClock(NOW, 'Asia/Tokyo')).toEqual({ date: '2026-10-17', hour: 15 });
  });

  test('due only at the local hour, once per local date, and only when enabled', () => {
    const sub = { enabled: true, timezone: 'Europe/Rome', hour: 8, lastSentLocalDate: null };
    expect(isDue(sub, NOW)).toBe(true);
    expect(isDue({ ...sub, lastSentLocalDate: '2026-10-17' }, NOW)).toBe(false);
    expect(isDue({ ...sub, hour: 7 }, NOW)).toBe(false);
    expect(isDue({ ...sub, enabled: false }, NOW)).toBe(false);
    expect(isDue({ ...sub, timezone: 'Nope/Nope' }, NOW)).toBe(false);
  });

  test('deliverDueBriefs notifies due subscribers once and records the local date', async () => {
    const subs = [
      { _id: 'a', userId: 'u-rome', enabled: true, timezone: 'Europe/Rome', hour: 8, lastSentLocalDate: null },
      { _id: 'b', userId: 'u-ny', enabled: true, timezone: 'America/New_York', hour: 7, lastSentLocalDate: null },
      { _id: 'c', userId: 'u-done', enabled: true, timezone: 'Europe/Rome', hour: 8, lastSentLocalDate: '2026-10-17' },
    ];
    const updateOne = jest.fn().mockResolvedValue({});
    const BriefSubscription = {
      find: jest.fn(() => ({ sort: () => ({ limit: () => ({ lean: async () => subs }) }) })),
      updateOne,
    };
    const getBriefForUser = jest.fn(async () => buildBrief({ now: NOW }));
    const createNotification = jest.fn().mockResolvedValue({});

    const out = await deliverDueBriefs(NOW, { BriefSubscription, getBriefForUser, createNotification });
    expect(out).toEqual({ sent: 1, failed: 0 });
    expect(getBriefForUser).toHaveBeenCalledWith('u-rome', { now: NOW });
    expect(createNotification).toHaveBeenCalledWith(
      'u-rome', 'Your morning brief', expect.stringContaining('Make next:'), 'info', '/dashboard/features#brief',
      expect.objectContaining({ category: 'brief', priority: 'high' }),
    );
    expect(updateOne).toHaveBeenCalledWith({ _id: 'a' }, { $set: { lastSentLocalDate: '2026-10-17' } });
  });

  test('a failed send is counted and does not mark the day as sent', async () => {
    const subs = [{ _id: 'a', userId: 'u1', enabled: true, timezone: 'Europe/Rome', hour: 8, lastSentLocalDate: null }];
    const updateOne = jest.fn();
    const BriefSubscription = { find: () => ({ sort: () => ({ limit: () => ({ lean: async () => subs }) }) }), updateOne };
    const out = await deliverDueBriefs(NOW, {
      BriefSubscription,
      getBriefForUser: async () => buildBrief({ now: NOW }),
      createNotification: jest.fn().mockRejectedValue(new Error('push down')),
    });
    expect(out).toEqual({ sent: 0, failed: 1 });
    expect(updateOne).not.toHaveBeenCalled();
  });
});

describe('morningBrief.renderBriefEmail', () => {
  test('escapes audience-written text and links back to the brief + settings', () => {
    const b = buildBrief({
      now: NOW,
      inbound: [
        { text: 'Is the <script>alert(1)</script> microphone good?', createdAt: new Date(NOW).toISOString() },
        { text: 'which microphone "really" works?', createdAt: new Date(NOW).toISOString() },
      ],
    });
    const { subject, html, text } = renderBriefEmail(b, { appUrl: 'https://app.example.com/' });
    expect(subject).toBe('Your morning brief');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Answer this: &quot;Is the &lt;script&gt;alert(1)&lt;/script&gt; microphone good?&quot;');
    expect(html).toContain('href="https://app.example.com/dashboard/settings?tab=notifications"');
    expect(html).toContain('href="https://app.example.com/dashboard/features#brief"');
    expect(text).toContain('Make next:');
  });
});

describe('morningBrief.sendBrief channels', () => {
  const brief = buildBrief({ now: NOW });
  const deps = (over = {}) => ({
    notify: jest.fn().mockResolvedValue({ _id: 'n1' }),
    sendEmail: jest.fn().mockResolvedValue({ success: true }),
    getUserEmail: jest.fn().mockResolvedValue('me@example.com'),
    appUrl: 'https://app.example.com',
    ...over,
  });

  test('in-app only by default', async () => {
    const d = deps();
    await sendBrief({ userId: 'u1' }, brief, d);
    expect(d.notify).toHaveBeenCalled();
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  test('email channel sends to the account address', async () => {
    const d = deps();
    await sendBrief({ userId: 'u1', channels: { inApp: false, email: true } }, brief, d);
    expect(d.notify).not.toHaveBeenCalled();
    expect(d.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'me@example.com', subject: 'Your morning brief' }));
  });

  test('one working channel is enough; all channels failing throws', async () => {
    const d = deps({ sendEmail: jest.fn().mockResolvedValue({ success: false, error: 'not configured' }) });
    await expect(sendBrief({ userId: 'u1', channels: { inApp: true, email: true } }, brief, d)).resolves.toBe(true);
    const dead = deps({ notify: jest.fn().mockResolvedValue(null), sendEmail: jest.fn().mockResolvedValue({ success: false, error: 'not configured' }) });
    await expect(sendBrief({ userId: 'u1', channels: { inApp: true, email: true } }, brief, dead))
      .rejects.toThrow(/in-app notifications are turned off.*email: not configured/);
  });

  test('email with no address on the account fails that channel', async () => {
    const d = deps({ getUserEmail: jest.fn().mockResolvedValue(null) });
    await expect(sendBrief({ userId: 'u1', channels: { inApp: false, email: true } }, brief, d)).rejects.toThrow(/no email address/);
  });
});
