const { scoreVideoSeo, generateSeoRewrite, normalizeTags } = require('../../../server/services/seoScorecardService');

describe('scoreVideoSeo (pure)', () => {
  it('rewards a well-optimized YouTube video', () => {
    const card = scoreVideoSeo({
      title: 'CapCut Editing: 7 Pro Tricks to Edit Faster',
      description: 'CapCut editing made easy — these 7 tricks will speed up your workflow. Subscribe for more. Link in bio.'.padEnd(220, '.'),
      tags: ['capcut editing', 'capcut tutorial', 'video editing', 'editing tricks', 'capcut tips', 'edit faster', 'capcut 2026', 'short form'],
      thumbnail: 'https://cdn/thumb.jpg',
    }, { targetKeyword: 'capcut editing', platform: 'youtube' });
    expect(card.score).toBeGreaterThanOrEqual(80);
    expect(['A', 'B']).toContain(card.grade);
    expect(card.subscores.keyword).toBe(100);
  });

  it('penalizes a missing keyword + thumbnail and surfaces quick wins', () => {
    const card = scoreVideoSeo({
      title: 'my video',
      description: '',
      tags: [],
      thumbnail: null,
    }, { targetKeyword: 'capcut editing', platform: 'youtube' });
    expect(card.score).toBeLessThan(45);
    expect(card.grade).toBe('F');
    const fields = card.issues.map((i) => i.field);
    expect(fields).toEqual(expect.arrayContaining(['title', 'thumbnail', 'tags']));
    expect(card.quickWins.length).toBeGreaterThan(0);
  });

  it('flags a missing target keyword explicitly (null keyword subscore)', () => {
    const card = scoreVideoSeo({ title: 'A decent title here', description: 'x'.repeat(250), tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], thumbnail: 't' });
    expect(card.subscores.keyword).toBeNull();
    expect(card.issues.some((i) => i.field === 'keyword')).toBe(true);
  });

  it('is platform-aware (tiktok ideal title is shorter)', () => {
    const meta = { title: 'Editing tricks every creator should know', description: 'follow for more #editing', tags: ['editing', 'capcut', 'fyp'], thumbnail: 't' };
    const tt = scoreVideoSeo(meta, { targetKeyword: 'editing', platform: 'tiktok' });
    expect(tt.platform).toBe('tiktok');
    expect(tt.subscores.title).toBeGreaterThan(40);
  });

  it('normalizeTags handles string + object tag shapes', () => {
    expect(normalizeTags(['a', { name: 'b' }, { tag: 'c' }, null, 5])).toEqual(['a', 'b', 'c']);
  });

  it('is safe on empty input', () => {
    const card = scoreVideoSeo();
    expect(card.score).toBeGreaterThanOrEqual(0);
    expect(card.score).toBeLessThanOrEqual(100);
  });
});

describe('generateSeoRewrite (honest fallback)', () => {
  it('always returns usable metadata (template fallback when AI is down)', async () => {
    const r = await generateSeoRewrite(
      { title: 'old title', description: 'old desc', tags: ['x'] },
      { targetKeyword: 'capcut editing', platform: 'youtube' },
    );
    expect(typeof r.title).toBe('string');
    expect(r.title.length).toBeGreaterThan(0);
    expect(Array.isArray(r.tags)).toBe(true);
    expect(['ai', 'template']).toContain(r.source);
    // The keyword should be present in the fallback tags.
    expect(r.tags.join(' ').toLowerCase()).toContain('capcut editing');
  });
});
