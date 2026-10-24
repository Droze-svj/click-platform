import { useState } from 'react';

/**
 * useCompetitorGhosting.ts
 * Example pacing templates that can be overlaid onto the user's timeline as a
 * dashed "energy" curve for comparison.
 *
 * These are hand-written EXAMPLE shapes (a fast-paced edit and a steady
 * explainer) — they are not measured from any real creator or channel, and the
 * UI must label them as examples. (Hook/export names are kept for callers.)
 */

export interface PacingTemplate {
  id: string;
  /** i18n key for the template's display name. */
  nameKey: string;
  /** i18n key for a short display name (toolbar button). */
  shortNameKey: string;
  pacingCurve: { timePct: number; energy: number }[]; // timePct 0.0 to 1.0, energy 0 to 100
}

/** @deprecated use PacingTemplate — kept so existing imports keep compiling. */
export type CompetitorProfile = PacingTemplate;

const EXAMPLE_PACING_TEMPLATES: PacingTemplate[] = [
  {
    id: 'example-fast-paced',
    nameKey: 'timelineView.pacingFastPaced',
    shortNameKey: 'timelineView.pacingFastPacedShort',
    pacingCurve: [
      { timePct: 0.0, energy: 100 }, // strong hook
      { timePct: 0.1, energy: 90 },
      { timePct: 0.2, energy: 85 },
      { timePct: 0.3, energy: 95 }, // re-hook
      { timePct: 0.5, energy: 80 },
      { timePct: 0.7, energy: 85 },
      { timePct: 0.9, energy: 95 }, // climax
      { timePct: 1.0, energy: 60 },
    ],
  },
  {
    id: 'example-steady-explainer',
    nameKey: 'timelineView.pacingExplainer',
    shortNameKey: 'timelineView.pacingExplainerShort',
    pacingCurve: [
      { timePct: 0.0, energy: 85 },
      { timePct: 0.1, energy: 70 },
      { timePct: 0.3, energy: 60 }, // steady explanation
      { timePct: 0.5, energy: 85 }, // key point
      { timePct: 0.6, energy: 60 },
      { timePct: 0.8, energy: 90 }, // call to action
      { timePct: 1.0, energy: 75 },
    ],
  },
];

export function useCompetitorGhosting() {
  const [activeProfile, setActiveProfile] = useState<PacingTemplate | null>(null);
  const [profiles] = useState<PacingTemplate[]>(EXAMPLE_PACING_TEMPLATES);

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
   * Map a normalized time (0 to 1) to the template's example energy (0 to 100)
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
