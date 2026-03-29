export interface StylePreference {
  keyword: string;
  action: 'zoom' | 'fade' | 'speed' | 'brightness';
  magnitude: number;
  confidence: number;
  timestamp: string;
}

export class StyleFingerprint {
  private preferences: StylePreference[] = [];
  private threshold = 1.2;

  recordUserDelta(clip: { id: string; keyword: string }, zoomLevel: number) {
    if (zoomLevel >= this.threshold && ['Zoom', 'Punchline'].includes(clip.keyword)) {
      this.preferences.push({
        keyword: clip.keyword,
        action: 'zoom',
        magnitude: zoomLevel,
        confidence: 0.85,
        timestamp: new Date().toISOString()
      });
    }
  }

  getPreferenceWeight(keyword: string) {
    const found = this.preferences.find(p => p.keyword === keyword);
    return found ? { weight: found.magnitude, action: found.action } : null;
  }
}
