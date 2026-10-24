// Regression guard: the text-only hook-analysis fallback (used when neither
// GPT-4o nor Gemini answers) must be deterministic and must not invent claims.
// It used to add Math.random() to every score and return canned "insights"
// such as "I analyzed 1,000 videos…" and "72% of short-form is watched muted".

const fs = require('fs');
const path = require('path');

const ROUTE = path.join(__dirname, '../../../server/routes/video/hook-analysis.js');
const { generateFallbackAnalysis } = require(ROUTE);

const TRANSCRIPT = 'Why do most of your videos stop getting views after 3 days? Here is what I changed and what happened next. It is simpler than you think.';

describe('hook-analysis text-only fallback', () => {
  it('is deterministic — the same transcript always gets the same result', () => {
    const a = generateFallbackAnalysis(TRANSCRIPT, 12);
    const b = generateFallbackAnalysis(TRANSCRIPT, 12);
    expect(b).toEqual(a);
  });

  it('never uses Math.random in the fallback', () => {
    const src = fs.readFileSync(ROUTE, 'utf8');
    const body = src.slice(src.indexOf('function generateFallbackAnalysis'));
    expect(body).not.toMatch(/Math\.random\(/);
  });

  it('returns no canned claims, rewrites, titles or tags', () => {
    const r = generateFallbackAnalysis(TRANSCRIPT);
    const serialized = JSON.stringify(r);
    expect(serialized).not.toMatch(/1,000 videos/);
    expect(serialized).not.toMatch(/72%/);
    expect(r.rewrites).toEqual([]);
    expect(r.suggestedTitle).toBeNull();
    expect(r.suggestedDescription).toBeNull();
    expect(r.suggestedTags).toEqual([]);
    expect(r.isFallback).toBe(true);
  });

  it('scores stay within 0-100 and reflect what the opening line contains', () => {
    const question = generateFallbackAnalysis('Why does this work so well for you? Let me show you how it works in practice.');
    const plain = generateFallbackAnalysis('This is a video about my morning routine and the things that I do every day.');
    for (const r of [question, plain]) {
      for (const k of ['hookStrength', 'toneCohesion', 'pacing', 'viralPotential']) {
        expect(r[k]).toBeGreaterThanOrEqual(0);
        expect(r[k]).toBeLessThanOrEqual(100);
      }
    }
    expect(question.hookStrength).toBeGreaterThan(plain.hookStrength);
    expect(question.hookType).toBe('question');
  });
});
