import { useMemo } from 'react'
import { TimelineSegment, StyleDNA } from '../types/editor'
import type { StyleProfile } from './useStyleProfile'

/**
 * Style DNA — derives a creator's signature from two sources:
 *   1. The current edit (timeline segments + overlays) — what they're doing right now.
 *   2. (Optional) Their persisted UserStyleProfile — what they've consistently chosen
 *      over previous edits. When provided, affinity scores are biased by the profile
 *      so the editor surfaces tiles that match the creator's established taste.
 *
 * Without a profile, the hook falls back to a heuristic derivation from the current
 * edit only. This preserves backwards-compatibility with the legacy callers that
 * computed Style DNA before useStyleProfile existed.
 */

// Transition bucketing — picks the affinity dimension each transition family
// signals. Used both to score the current edit and to interpret the profile.
const HIGH_OCTANE_TRANSITIONS = new Set(['zoom', 'slam', 'glitch', 'shake', 'whip', 'kick', 'snap', 'bounce', 'flash', 'rgb', 'pop'])
const CINEMATIC_TRANSITIONS = new Set(['fade', 'dissolve', 'crossfade', 'iris', 'wipe-soft', 'fadeblack', 'longfade'])
const MINIMALIST_TRANSITIONS = new Set(['none', 'cut', 'hard-cut', 'jumpcut'])

const HIGH_OCTANE_FONTS = /(impact|bebas|teko|anton|montserrat black|inter black|oswald|kanit)/i
const CINEMATIC_FONTS = /(playfair|cormorant|garamond|libre|lora|crimson|trajan|cinzel)/i

function tally(arr: { key: string; count: number }[] | undefined): Map<string, number> {
  const m = new Map<string, number>()
  if (!arr) return m
  for (const c of arr) m.set(c.key.toLowerCase(), c.count || 0)
  return m
}

function bucketSum(counts: Map<string, number>, matcher: Set<string> | RegExp): number {
  let total = 0
  for (const [key, count] of counts) {
    if (matcher instanceof RegExp ? matcher.test(key) : matcher.has(key)) total += count
  }
  return total
}

function normalize(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  if (total <= 0) return weights
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(weights)) out[k] = Math.round((v / total) * 100) / 100
  return out
}

export function useStyleDNA(segments: TimelineSegment[], overlays: any[] = [], profile?: StyleProfile): StyleDNA {
  return useMemo(() => {
    // 1. Calculate CPM (Cuts Per Minute)
    const videoSegments = segments.filter(s => s.track < 6) // Track < 6 are video tracks
    const durationInSeconds = Math.max(...segments.map(s => s.endTime), 60) // Floor at 1 min for calc
    const durationInMinutes = durationInSeconds / 60
    const cpm = videoSegments.length / durationInMinutes

    // 2. Calculate Visual Density — frequency of overlays, b-roll, text pop-ups per minute
    const densityElements = segments.filter(s => s.type === 'image' || (s.track >= 2 && s.track < 5))
    const totalVisuals = densityElements.length + overlays.length
    const visualDensity = totalVisuals / durationInMinutes

    // 3. Audio Ducking Preference
    const duckingSegments = segments.filter(s => s.audioDucking || s.audioEnvelope)
    const avgDuckLevel = duckingSegments.length > 0 ? -12 : -10

    // 4. Asset Affinity — derived from the current edit AND, when available, the user's
    //    persisted style profile. Each axis collects weighted votes:
    //      • high-octane: fast transitions, bold display fonts, dense overlay use
    //      • cinematic:   slow transitions, serif/display-script fonts, sparse cuts
    //      • minimalist:  hard cuts, low overlay use, tight font palette
    const editTransitions = segments.map(s => (s.transitionOut || '').toLowerCase()).filter(Boolean)
    const editFonts = overlays.map(o => (o.fontFamily || '').toLowerCase()).filter(Boolean)

    const editHighOctane = editTransitions.filter(t => HIGH_OCTANE_TRANSITIONS.has(t)).length
                          + editFonts.filter(f => HIGH_OCTANE_FONTS.test(f)).length
                          + (cpm > 12 ? 4 : 0) + (visualDensity > 8 ? 3 : 0)
    const editCinematic = editTransitions.filter(t => CINEMATIC_TRANSITIONS.has(t)).length
                          + editFonts.filter(f => CINEMATIC_FONTS.test(f)).length
                          + (cpm < 4 ? 4 : 0) + (visualDensity < 3 ? 2 : 0)
    const editMinimalist = editTransitions.filter(t => MINIMALIST_TRANSITIONS.has(t)).length
                          + (overlays.length === 0 ? 3 : 0) + (totalVisuals < 5 ? 2 : 0)
                          + (new Set(editFonts).size <= 1 ? 2 : 0)

    // Profile contribution — votes from the user's persistent picks, scaled so a
    // creator with 50+ historical picks substantially outweighs a single edit.
    let profHighOctane = 0, profCinematic = 0, profMinimalist = 0
    if (profile) {
      const transitionCounts = tally(profile.transitions)
      const fontCounts = tally(profile.fonts)
      profHighOctane = bucketSum(transitionCounts, HIGH_OCTANE_TRANSITIONS)
                      + bucketSum(fontCounts, HIGH_OCTANE_FONTS)
      profCinematic = bucketSum(transitionCounts, CINEMATIC_TRANSITIONS)
                     + bucketSum(fontCounts, CINEMATIC_FONTS)
      profMinimalist = bucketSum(transitionCounts, MINIMALIST_TRANSITIONS)
                      + Math.max(0, 6 - fontCounts.size) // tighter font palette → more minimalist
    }

    // Combine — profile counts dominate when present, current edit fills in the bias.
    const affinity = normalize({
      'high-octane': editHighOctane + profHighOctane * 1.5,
      'cinematic':   editCinematic  + profCinematic  * 1.5,
      'minimalist':  editMinimalist + profMinimalist * 1.5,
    })

    // Ensure non-zero defaults so downstream rendering doesn't divide by zero
    // when the user has no history and no telling current-edit signals yet.
    if (affinity['high-octane'] + affinity['cinematic'] + affinity['minimalist'] === 0) {
      affinity['high-octane'] = 0.2
      affinity['cinematic']   = 0.3
      affinity['minimalist']  = 0.5
    }

    // 5. Preferred Transitions — current edit first, profile fills in
    const transitionsFromEdit = Array.from(new Set(segments.map(s => s.transitionOut).filter(Boolean))) as string[]
    const transitionsFromProfile = profile?.transitions
      ?.slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(c => c.key) || []
    const preferredTransitions = Array.from(new Set([...transitionsFromEdit, ...transitionsFromProfile]))

    // 6. Preferred Fonts — same merging strategy
    const fontsFromEdit = Array.from(new Set(overlays.map(o => o.fontFamily).filter(Boolean)))
    const fontsFromProfile = profile?.fonts
      ?.slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(c => c.key) || []
    const preferredFonts = Array.from(new Set([...fontsFromEdit, ...fontsFromProfile]))

    // 7. Neural Theme detection — picks the dominant affinity bucket
    let theme: 'cinematic' | 'vlog' | 'high-octane' | 'corporate' = 'vlog'
    const top = Object.entries(affinity).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (top === 'high-octane') theme = 'high-octane'
    else if (top === 'cinematic') theme = 'cinematic'
    else if (visualDensity > 10) theme = 'corporate'

    return {
      cpm: Math.round(cpm * 10) / 10,
      visualDensity: Math.round(visualDensity * 10) / 10,
      assetAffinity: affinity,
      audioDuckingPreference: avgDuckLevel,
      foleyFrequency: segments.filter(s => s.track >= 8).length / durationInMinutes,
      preferredTransitions,
      preferredFonts,
      theme,
      sentimentDrift: 0.1, // Placeholder for sentiment analysis integration
    }
  }, [segments, overlays, profile])
}
