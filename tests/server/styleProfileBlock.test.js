// Regression tests for the creator style-profile block inside buildSystemPrompt.
// Guards two real bugs: (1) facet counter ARRAYS [{key,count}] were read via
// Object.entries → emitted array INDICES ("0 · 1") instead of keys; (2) averages
// were read flat (profile.avgCutDuration) but the model nests them under
// `averages`, so the pacing lines silently vanished. The block is private, so we
// assert through the public buildSystemPrompt output string.

const { buildSystemPrompt } = require('../../server/services/marketingKnowledge');

// Canonical UserStyleProfile.lean() shape: facets are counter arrays, averages nested.
const PROFILE = {
  userId: 'u1',
  fonts: [{ key: 'Inter', count: 14 }, { key: 'Roboto', count: 8 }, { key: 'Poppins', count: 2 }],
  captionStyles: [{ key: 'bold-kinetic', count: 9 }],
  colorGrades: [{ key: 'cinematic', count: 5 }],
  platforms: [{ key: 'tiktok', count: 12 }, { key: 'reels', count: 4 }],
  averages: { avgCutDuration: 1.6, avgFontSize: 32, avgCaptionLength: 48, avgVideoDuration: 30 },
};

describe('buildSystemPrompt — creator style profile block', () => {
  test('emits real facet KEYS sorted by count, never array indices', () => {
    const out = buildSystemPrompt({ persona: 'caption-writer', niche: 'finance', platform: 'tiktok', styleProfile: PROFILE });
    expect(out).toContain('Inter');
    expect(out).toContain('bold-kinetic');
    expect(out).toContain('cinematic');
    // top platform first (count desc)
    expect(out).toMatch(/Default platforms:\s*tiktok/);
    // the bug signature: indices leaking in as keys
    expect(out).not.toMatch(/Preferred fonts:\s*0/);
    expect(out).not.toMatch(/\b0 · 1\b/);
  });

  test('caps each facet at top 3 by count', () => {
    const out = buildSystemPrompt({ persona: 'caption-writer', niche: 'finance', platform: 'tiktok', styleProfile: PROFILE });
    const fontsLine = out.split('\n').find((l) => l.startsWith('Preferred fonts:')) || '';
    expect(fontsLine).toContain('Inter');
    expect(fontsLine.split('·').length).toBeLessThanOrEqual(3);
  });

  test('emits nested averages (pacing) lines', () => {
    const out = buildSystemPrompt({ persona: 'caption-writer', niche: 'finance', platform: 'tiktok', styleProfile: PROFILE });
    expect(out).toMatch(/Average cut length:\s*1\.6s/);
    expect(out).toMatch(/Average font size:\s*32px/);
    expect(out).toMatch(/Average caption length:\s*48 chars/);
  });

  test('still accepts the legacy object-map facet shape', () => {
    const legacy = { userId: 'u2', fonts: { Inter: 10, Roboto: 3 } };
    const out = buildSystemPrompt({ persona: 'caption-writer', niche: 'finance', platform: 'tiktok', styleProfile: legacy });
    expect(out).toMatch(/Preferred fonts:\s*Inter/);
    expect(out).not.toMatch(/Preferred fonts:\s*0/);
  });

  test('cold-start profile ({userId} only) emits no style lines and does not throw', () => {
    const out = buildSystemPrompt({ persona: 'caption-writer', niche: 'finance', platform: 'tiktok', styleProfile: { userId: 'u3' } });
    expect(out).not.toContain('Preferred fonts:');
    expect(out).not.toContain('Average cut length:');
  });
});
