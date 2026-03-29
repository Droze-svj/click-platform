import { useMemo } from 'react'
import { TimelineSegment, StyleDNA } from '../types/editor'

export function useStyleDNA(segments: TimelineSegment[], overlays: any[] = []): StyleDNA {
  return useMemo(() => {
    // 1. Calculate CPM (Cuts Per Minute)
    // We count 'cut' segments or the number of video segments
    const videoSegments = segments.filter(s => s.track < 6) // Track < 6 are video tracks
    const durationInSeconds = Math.max(...segments.map(s => s.endTime), 60) // Floor at 1 min for calc
    const durationInMinutes = durationInSeconds / 60
    const cpm = videoSegments.length / durationInMinutes

    // 2. Calculate Visual Density
    // Frequency of overlays, b-roll, text pop-ups per minute
    const densityElements = segments.filter(s => s.type === 'image' || s.track >= 2 && s.track < 5) // B-roll + Graphics
    const totalVisuals = densityElements.length + overlays.length
    const visualDensity = totalVisuals / durationInMinutes

    // 3. Audio Ducking Preference
    const duckingSegments = segments.filter(s => s.audioDucking || s.audioEnvelope)
    const avgDuckLevel = duckingSegments.length > 0 ? -12 : -10 // Mock default if not found

    // 4. Asset Affinity Cluster (Mocking based on types present)
    const affinity: Record<string, number> = {
      'minimalist': 0.5,
      'high-octane': 0.2,
      'cinematic': 0.3
    }
    
    // 5. Preferred Transitions
    const transitions = Array.from(new Set(segments.map(s => s.transitionOut).filter(Boolean))) as string[]

    // 6. Neural Theme detection (Mapping CPM/Density to Personas)
    let theme: 'cinematic' | 'vlog' | 'high-octane' | 'corporate' = 'vlog'
    if (cpm > 12 && visualDensity > 8) theme = 'high-octane'
    else if (cpm < 4 && visualDensity < 3) theme = 'cinematic'
    else if (visualDensity > 10) theme = 'corporate'

    return {
      cpm: Math.round(cpm * 10) / 10,
      visualDensity: Math.round(visualDensity * 10) / 10,
      assetAffinity: affinity,
      audioDuckingPreference: avgDuckLevel,
      foleyFrequency: segments.filter(s => s.track >= 8).length / durationInMinutes,
      preferredTransitions: transitions,
      preferredFonts: Array.from(new Set(overlays.map(o => o.fontFamily).filter(Boolean))),
      theme,
      sentimentDrift: 0.1 // Placeholder for sentiment analysis integration
    }
  }, [segments, overlays])
}
