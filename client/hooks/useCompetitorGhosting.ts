import { useState, useEffect } from 'react';

/**
 * useCompetitorGhosting.ts
 * Loads pacing and retention heatmap data from top-performing benchmarks (e.g. MrBeast intros).
 * Exposes a normalized curve that can be overlaid onto the user's timeline.
 */

export interface CompetitorProfile {
  id: string;
  name: string;
  category: string;
  pacingCurve: { timePct: number; energy: number }[]; // 0.0 to 1.0
  averageCutsPerMinute: number;
}

const MOCK_PROFILES: CompetitorProfile[] = [
  {
    id: 'mrbeast-hyper',
    name: 'Jimmy (Hyper-Retention)',
    category: 'Entertainment',
    averageCutsPerMinute: 45,
    pacingCurve: [
      { timePct: 0.0, energy: 100 }, // Huge hook
      { timePct: 0.1, energy: 90 },
      { timePct: 0.2, energy: 85 },
      { timePct: 0.3, energy: 95 }, // Re-hook
      { timePct: 0.5, energy: 80 },
      { timePct: 0.7, energy: 85 },
      { timePct: 0.9, energy: 95 }, // Climax
      { timePct: 1.0, energy: 60 },
    ],
  },
  {
    id: 'hormozi-value',
    name: 'Value Drop (Educational)',
    category: 'Business',
    averageCutsPerMinute: 20,
    pacingCurve: [
      { timePct: 0.0, energy: 85 },
      { timePct: 0.1, energy: 70 },
      { timePct: 0.3, energy: 60 }, // Steady explanation
      { timePct: 0.5, energy: 85 }, // Value drop
      { timePct: 0.6, energy: 60 },
      { timePct: 0.8, energy: 90 }, // Call to action start
      { timePct: 1.0, energy: 75 },
    ],
  }
];

export function useCompetitorGhosting() {
  const [activeProfile, setActiveProfile] = useState<CompetitorProfile | null>(null);
  const [profiles] = useState<CompetitorProfile[]>(MOCK_PROFILES);

  const loadGhostCurve = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      setActiveProfile(profile);
    }
  };

  const clearGhostCurve = () => {
    setActiveProfile(null);
  };

  /**
   * Helper to map a normalized time (0 to 1) to the ghost's expected energy (0 to 100)
   */
  const getExpectedEnergyAtTime = (timePct: number): number => {
    if (!activeProfile) return 0;

    // Find surrounding points
    const curve = activeProfile.pacingCurve;
    let prev = curve[0];
    let next = curve[curve.length - 1];

    for (let i = 0; i < curve.length; i++) {
        if (curve[i].timePct === timePct) return curve[i].energy;
        if (curve[i].timePct < timePct) prev = curve[i];
        if (curve[i].timePct > timePct) {
            next = curve[i];
            break;
        }
    }

    if (prev === next) return prev.energy;

    // Linear interpolation
    const ratio = (timePct - prev.timePct) / (next.timePct - prev.timePct);
    return prev.energy + (next.energy - prev.energy) * ratio;
  };

  return {
    profiles,
    activeProfile,
    loadGhostCurve,
    clearGhostCurve,
    getExpectedEnergyAtTime
  };
}
