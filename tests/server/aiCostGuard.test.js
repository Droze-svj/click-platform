// H4: the AI-content routes now consult the per-tier aiBudgetUsd ceiling via
// req.assertBudget before each LLM call (and meter spend after). This tests the
// gate logic those handlers rely on (costGuard.assertBudget), offline.

const { assertBudget, estimateCostUsd } = require('../../server/middleware/costGuard');

describe('costGuard budget gate (H4 enforcement)', () => {
  test('blocks an over-budget call with a 402 + upgrade payload', async () => {
    // userId:null → fail-closed to the free ceiling ($0.50). A large Opus-tier
    // call (~$2.6) must be rejected before any spend.
    await expect(
      assertBudget({
        userId: null,
        provider: 'anthropic',
        model: 'claude-opus-4-8',
        prompt: 'x'.repeat(100000),
        expectedOutputTokens: 100000,
      })
    ).rejects.toMatchObject({ statusCode: 402, payload: { reason: 'budget-exceeded' } });
  });

  test('allows a small call under budget', async () => {
    const r = await assertBudget({
      userId: null, provider: 'gemini', model: 'default', prompt: 'hi', expectedOutputTokens: 100,
    });
    expect(r.estimate.usd).toBeLessThan(0.5);
    expect(r.remainingUsd).toBeGreaterThan(0);
  });

  test('estimated cost scales with the fan-out (more output tokens → more $)', () => {
    const one = estimateCostUsd({ provider: 'gemini', model: 'default', prompt: 'x'.repeat(400), expectedOutputTokens: 4000 });
    const ten = estimateCostUsd({ provider: 'gemini', model: 'default', prompt: 'x'.repeat(400), expectedOutputTokens: 40000 });
    expect(ten.usd).toBeGreaterThan(one.usd);
  });
});
