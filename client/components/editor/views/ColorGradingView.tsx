'use client'

import React from 'react'
import { Palette, Sparkles, Activity, Layers, RefreshCw, CircleDot } from 'lucide-react'
import { VideoFilter } from '../../../types/editor'
import { useTranslation } from '../../../hooks/useTranslation'
import { Panel, Button, Badge, Slider, SectionHeader } from '../../ui'
import { cn } from '../../../lib/utils'

/** Color swatch hint for each preset (Tailwind gradient) */
const COLOR_PRESETS: { id: string; label: string; f: Partial<VideoFilter>; desc: string; swatch?: string; group: string }[] = [
  { id: 'warm', label: 'Warm', f: { saturation: 110, temperature: 115, vibrance: 108 }, desc: 'Golden hour', swatch: 'from-amber-400 to-orange-500', group: 'Atmosphere' },
  { id: 'cold', label: 'Cold', f: { saturation: 105, temperature: 85, tint: 8 }, desc: 'Cool tones', swatch: 'from-cyan-300 to-blue-600', group: 'Atmosphere' },
  { id: 'retro', label: 'Retro', f: { sepia: 35, saturation: 80, contrast: 110, vignette: 25 }, desc: 'Vintage film', swatch: 'from-amber-800 to-yellow-700', group: 'Cinematic' },
  { id: 'cinematic', label: 'Cinematic', f: { contrast: 108, saturation: 95, vignette: 35, sepia: 8 }, desc: 'Film look', swatch: 'from-amber-900/60 to-slate-800', group: 'Cinematic' },
  { id: 'teal-orange', label: 'Teal & Orange', f: { saturation: 120, temperature: 105, tint: -5, vibrance: 115 }, desc: 'Hollywood', swatch: 'from-teal-500 to-orange-500', group: 'Cinematic' },
  { id: 'cyberpunk', label: 'Cyberpunk', f: { saturation: 140, temperature: 80, tint: 25, contrast: 115, vibrance: 130 }, desc: 'Neon night', swatch: 'from-fuchsia-600 to-cyan-500', group: 'Cinematic' },
  { id: 'earthly', label: 'Earthly', f: { saturation: 90, temperature: 110, tint: -10, contrast: 105, shadows: 15 }, desc: 'Natural tones', swatch: 'from-emerald-800 to-amber-900', group: 'Atmosphere' },
  { id: 'vivid', label: 'Vivid', f: { saturation: 135, contrast: 108, vibrance: 125 }, desc: 'High pop', swatch: 'from-pink-400 via-purple-500 to-cyan-400', group: 'Vibrance' },
  { id: 'high-key', label: 'High Key', f: { brightness: 125, contrast: 90, shadows: -10, saturation: 105 }, desc: 'Bright & Airy', swatch: 'from-white to-slate-200', group: 'Stylistic' },
  { id: 'noir', label: 'Noir', f: { saturation: 0, contrast: 135, vignette: 55, brightness: 85 }, desc: 'B&W dramatic', swatch: 'from-gray-400 to-black', group: 'Stylistic' },
]

const INITIAL_FILTERS: VideoFilter = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  blur: 0,
  sharpen: 0,
  noise: 0,
  clarity: 0,
  dehaze: 0,
  temperature: 100,
  vibrance: 100,
  sepia: 0,
  vignette: 0,
  tint: 0,
  shadows: 0,
  highlights: 100,
  exposure: 100,
  lift: { r: 127, g: 127, b: 127 },
  gamma: { r: 127, g: 127, b: 127 },
  gain: { r: 127, g: 127, b: 127 }
}

interface ColorGradingViewProps {
  videoFilters: VideoFilter
  setVideoFilters: (v: any) => void
  colorGradeSettings: any
  setColorGradeSettings: (v: any) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  /** Optional: when provided, applying a preset records to the user's
   *  style profile so future suggestions can bias toward grades they pick. */
  onRecordPick?: (facet: 'colorGrades', key: string) => void
  /**
   * Weighted "what worked" map keyed by colorGrade id. When present the
   * preset grid is re-ranked so the top performer renders first and gets
   * a "Your top pick" badge. Pass `null`/`undefined` for cold-start
   * users — the grid then renders in its original authored order.
   */
  topPerformers?: Array<{ key: string; performanceScore?: number; sampleSize?: number }>
  /**
   * True once GET /style-profile/insights has resolved. Distinguishes
   * "still loading" from a genuine cold-start (no learned performance
   * data) so the UI shows an honest "learning" hint instead of implying
   * a ranking exists when it doesn't.
   */
  insightsLoaded?: boolean
}

interface ColorWheelProps {
  label: string
  desc: string
  colorClass: string
  value: { r: number; g: number; b: number }
  onChange: (v: { r: number; g: number; b: number }) => void
}

const ColorWheel: React.FC<ColorWheelProps> = ({ label, desc, colorClass, value, onChange }) => {
  const wheelRef = React.useRef<HTMLDivElement>(null)

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!wheelRef.current) return
    const rect = wheelRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    // Calculate normalized distance from center (-1 to 1)
    let dx = (clientX - centerX) / (rect.width / 2)
    let dy = (clientY - centerY) / (rect.height / 2)

    // Constrain to circle
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance > 1) {
      dx /= distance
      dy /= distance
    }

    // Convert X/Y to color shifts (simplified: X shifts between Cyan/Red, Y between Yellow/Blue)
    // This is a common way to represent color wheels in simplified UIs
    onChange({
      r: Math.max(0, Math.min(255, 127 + dx * 127)),
      g: Math.max(0, Math.min(255, 127 + (-dx/2 - dy/2) * 127)),
      b: Math.max(0, Math.min(255, 127 + dy * 127)),
    })
  }

  // Calculate joystick position from RGB values (reverse of above)
  // Simplified: dx = (r-127)/127, dy = (b-127)/127
  const dx = (value.r - 127) / 127
  const dy = (value.b - 127) / 127

  return (
    <div className="flex flex-col items-center gap-5 group/wheel">
      <div className="text-center">
        <span className={cn('block ds-text-label', colorClass)}>{label}</span>
        <span className="ds-text-caption text-theme-muted">{desc}</span>
      </div>
      <div
        ref={wheelRef}
        onMouseDown={(e) => {
          handleMove(e)
          const onMove = (me: MouseEvent) => handleMove(me as any)
          const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}
        className="w-44 h-44 rounded-full ds-surface-subtle relative flex items-center justify-center overflow-hidden transition-colors cursor-crosshair"
      >
        <div className="absolute inset-0 bg-[conic-gradient(from_0deg,red,yellow,lime,aqua,blue,magenta,red)] opacity-15 blur-xl" />
        <div className="w-36 h-36 rounded-full border border-subtle relative">
          <div
            className="absolute top-1/2 left-1/2 w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg border-2 border-slate-900 pointer-events-none transition-transform"
            style={{ transform: `translate(calc(-50% + ${dx * 72}px), calc(-50% + ${dy * 72}px))` }}
          />
        </div>
        <div className="absolute bottom-3 inset-x-0 text-center">
          <span className="text-[10px] font-mono text-theme-muted">R:{Math.round(value.r)} G:{Math.round(value.g)} B:{Math.round(value.b)}</span>
        </div>
      </div>
      <div className="w-full space-y-2">
        <Slider
          min={0}
          max={200}
          value={((value.r + value.g + value.b) / 3 / 127) * 100}
          onValueChange={(v) => {
            const factor = v / 100
            onChange({ r: 127 * factor, g: 127 * factor, b: 127 * factor })
          }}
          title={`Adjust ${label} Offset`}
          aria-label={`Adjust ${label} Offset`}
        />
        <div className="flex justify-between">
          <span className="ds-text-caption text-theme-muted">Master Balance</span>
          <span className="text-[11px] font-mono text-theme-primary">{Math.round(((value.r + value.g + value.b) / 3 / 127) * 100)}%</span>
        </div>
      </div>
    </div>
  )
}

const ColorGradingView: React.FC<ColorGradingViewProps> = ({
  videoFilters, setVideoFilters, colorGradeSettings, setColorGradeSettings, showToast, onRecordPick, topPerformers, insightsLoaded
}) => {
  const { t } = useTranslation()
  const [isComparing, setIsComparing] = React.useState(false)
  const [preCompareFilters, setPreCompareFilters] = React.useState<VideoFilter | null>(null)

  // A re-rank only happens when there's at least one learned color-grade
  // performer that maps to a real preset. Anything else (loading, or a
  // genuine cold start) leaves presets in their authored order — we never
  // claim a personalised ranking we don't have.
  const presetIds = React.useMemo(() => new Set(COLOR_PRESETS.map((p) => p.id)), [])
  const rankedPerformers = React.useMemo(
    () => (topPerformers || []).filter((p) => p?.key && presetIds.has(p.key) && (p.sampleSize || 0) > 0),
    [topPerformers, presetIds]
  )
  const hasPerformanceData = rankedPerformers.length > 0

  // Surface the re-rank exactly once per mount, and only when it's real.
  // Honest "still learning" hint stays inline (below) rather than as a toast
  // so we don't nag cold-start users on every visit.
  const announcedRef = React.useRef(false)
  React.useEffect(() => {
    if (hasPerformanceData && !announcedRef.current) {
      announcedRef.current = true
      showToast(t('colorGrading.rankedByPerformance'), 'info')
    }
  }, [hasPerformanceData, showToast, t])

  const toggleComparison = () => {
    if (!isComparing) {
      setPreCompareFilters({ ...videoFilters })
      setVideoFilters(INITIAL_FILTERS)
      setIsComparing(true)
      showToast('Viewing Original (No Grade)', 'info')
    } else {
      if (preCompareFilters) setVideoFilters(preCompareFilters)
      setIsComparing(false)
      setPreCompareFilters(null)
      showToast('Grade Re-applied', 'success')
    }
  }

  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setVideoFilters((prev: any) => ({ ...prev, ...preset.f }))
    onRecordPick?.('colorGrades', preset.id)
    showToast(`${preset.label} applied`, 'success')
  }

  const sliders = [
    { key: 'brightness', label: 'Luminosity', min: 0, max: 200, reset: 100 },
    { key: 'contrast', label: 'Contrast', min: 0, max: 200, reset: 100 },
    { key: 'saturation', label: 'Saturation', min: 0, max: 200, reset: 100 },
    { key: 'temperature', label: 'Temperature', min: 50, max: 150, reset: 100 },
    { key: 'vibrance', label: 'Vibrance', min: 0, max: 200, reset: 100 },
    { key: 'vignette', label: 'Vignette', min: 0, max: 100, reset: 0 },
  ]

  const wheels = [
    { id: 'lift', label: 'LIFT', desc: 'Shadow Control', color: 'text-indigo-500' },
    { id: 'gamma', label: 'GAMMA', desc: 'Midtone Control', color: 'text-amber-500' },
    { id: 'gain', label: 'GAIN', desc: 'Highlight Control', color: 'text-rose-500' }
  ]

  return (
    <div className="space-y-6 ds-anim-rise">
      {/* Color Presets */}
      <Panel variant="glass" className="p-6 sm:p-8">
        <SectionHeader
          className="mb-6"
          title={
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              Color Presets
            </span>
          }
          description="Graded looks — applied directly to your timeline"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant={isComparing ? 'primary' : 'secondary'}
                size="sm"
                onClick={toggleComparison}
                title={isComparing ? 'Apply Grade' : 'Compare with Original'}
                leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', isComparing && 'animate-spin')} aria-hidden />}
              >
                {isComparing ? 'Original Active' : 'Before / After'}
              </Button>
              {/* Real performance-ranking indicator. Only claims a ranking
                  when learned data actually re-ordered the grid; otherwise
                  shows an honest "learning" hint (or nothing while loading). */}
              {hasPerformanceData ? (
                <Badge variant="outline" className="gap-1.5 border-emerald-500/30 text-emerald-500">
                  <Activity className="h-3 w-3" aria-hidden />
                  {t('colorGrading.rankedByPerformance')}
                </Badge>
              ) : insightsLoaded ? (
                <Badge variant="outline" className="text-theme-muted">
                  {t('colorGrading.learningOrder')}
                </Badge>
              ) : null}
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* Re-rank presets by weighted performance score when learned
              signals are available. Tiles that don't appear in
              topPerformers keep their authored order beneath the
              promoted ones. The first promoted tile gets a "Your top
              pick" badge so the user understands why the order changed. */}
          {(() => {
            // No real data → authored order, untouched. This keeps the
            // cold-start experience honest (no implied personalisation).
            if (!hasPerformanceData) return COLOR_PRESETS
            const score = new Map<string, number>()
            rankedPerformers.forEach((perf) => {
              const s = (perf.performanceScore || 0) * Math.log((perf.sampleSize || 0) + 1)
              score.set(perf.key, s)
            })
            return COLOR_PRESETS.slice().sort((a, b) => (score.get(b.id) || 0) - (score.get(a.id) || 0))
          })().map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              title={`Apply ${p.label} Color Preset`}
              className="group relative flex flex-col items-start overflow-hidden rounded-xl ds-surface-subtle ds-hover-lift p-4 text-left transition-colors hover:border-indigo-500/40"
            >
              {p.swatch && (
                <div className={cn('absolute top-0 right-0 h-24 w-24 bg-gradient-to-br opacity-10 blur-2xl transition-opacity group-hover:opacity-20', p.swatch)} />
              )}
              <div className="mb-3 flex w-full items-center justify-between">
                <span className="ds-text-caption text-theme-muted">{p.group}</span>
                <div className={cn('h-2 w-2 rounded-full bg-gradient-to-r', p.swatch)} />
              </div>
              {/* "Your top pick" badge — surfaced only on the highest-
                   scoring preset (after re-rank). Quietly absent for
                   cold-start users so the editor never lies about what
                   it has learned. */}
              {hasPerformanceData && rankedPerformers[0]?.key === p.id && (
                <Badge variant="outline" className="absolute right-2 top-2 border-emerald-500/30 text-[10px] text-emerald-500">
                  {t('colorGrading.yourTopPick')}
                </Badge>
              )}
              <span className="block ds-text-h3 text-theme-primary transition-colors group-hover:text-indigo-500">{p.label}</span>
              <span className="mt-0.5 block text-xs text-theme-muted">{p.desc}</span>
            </button>
          ))}
        </div>
      </Panel>

      {/* Manual Adjustments */}
      <Panel variant="glass" className="p-6 sm:p-8">
        <SectionHeader
          className="mb-6"
          title={
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-500">
                <Activity className="h-5 w-5" aria-hidden />
              </span>
              Adjustments
            </span>
          }
          description="Fine-tune the grade"
        />

        <div className="space-y-6">
          {sliders.map(({ key, label, min, max, reset }) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="ds-text-label text-theme-secondary">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="rounded-md ds-surface-subtle px-2 py-0.5 text-xs font-semibold tabular-nums text-theme-primary">{(videoFilters as any)[key] ?? reset}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setVideoFilters((prev: any) => ({ ...prev, [key]: reset }))}
                    title="Reset to default"
                    aria-label={`Reset ${label}`}
                    className="h-7 w-7 p-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
              <Slider
                min={min}
                max={max}
                value={(videoFilters as any)[key] ?? reset}
                onValueChange={(v) => setVideoFilters((prev: any) => ({ ...prev, [key]: v }))}
                title={`Adjust ${label}`}
                aria-label={`Adjust ${label}`}
              />
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-subtle pt-5">
          <div className="flex items-center gap-2 text-theme-muted">
            <Layers className="h-4 w-4" aria-hidden />
            <span className="ds-text-caption">Multi-pass grading pipeline</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="ds-text-caption text-emerald-500">Synchronized</span>
          </div>
        </div>
      </Panel>

      {/* Color Wheels (Lift, Gamma, Gain) */}
      <Panel variant="glass" className="p-6 sm:p-8">
        <SectionHeader
          className="mb-6"
          title={
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <CircleDot className="h-5 w-5" aria-hidden />
              </span>
              Color Wheels
            </span>
          }
          description="Lift, gamma & gain balance"
        />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {wheels.map((wheel) => (
            <ColorWheel
              key={wheel.id}
              label={wheel.label}
              desc={wheel.desc}
              colorClass={wheel.color}
              value={(videoFilters as any)[wheel.id] ?? { r: 127, g: 127, b: 127 }}
              onChange={(v) => setVideoFilters((prev: any) => ({ ...prev, [wheel.id]: v }))}
            />
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-subtle pt-5">
          <p className="max-w-md text-xs text-theme-muted">
            Move the central reticle to shift the color balance of specific luminance ranges. Master Balance adjusts global luminosity for the target range.
          </p>
          <Button variant="secondary" size="sm" leftIcon={<Palette className="h-3.5 w-3.5" aria-hidden />} title="Match Color Node">
            Match Node
          </Button>
        </div>
      </Panel>
    </div>
  )
}

export default ColorGradingView
