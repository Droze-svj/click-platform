export class HookSimulator {
  private static MAX_SCORE = 100;

  simulateHook(captionSpeed: 'slow' | 'moderate' | 'fast') {
    const baseScore = captionSpeed === 'fast' ? 85 : 45;
    const variance = Math.random() * 15;
    const totalScore = Math.min(baseScore + variance, this.MAX_SCORE);

    return {
      variant: captionSpeed.toUpperCase(),
      score: Math.floor(totalScore),
      status: totalScore > 80 ? 'GOLD' : 'NORMAL',
      confidence: 0.85
    };
  }
}
export default new HookSimulator();
