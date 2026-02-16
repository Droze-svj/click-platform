'use client'

import React from 'react'
import { Settings, X, Filter, Type, Subtitles } from 'lucide-react'
import { VideoFilter, TextOverlay, CaptionStyle, CaptionSize, CaptionLayout, CaptionTextStyle, CAPTION_FONTS, CAPTION_TEXT_STYLES, TextOverlayAnimationIn, TextOverlayAnimationOut, MOTION_GRAPHIC_PRESETS, MotionGraphicPreset, ImageOverlay, GradientOverlay } from '../../types/editor'
import { formatTime } from '../../utils/editorUtils'

const CAPTION_LAYOUTS: { id: CaptionLayout; label: string }[] = [
  { id: 'bottom-center', label: 'Bottom center' },
  { id: 'lower-third', label: 'Lower third' },
  { id: 'top-center', label: 'Top center' },
  { id: 'full-width-bottom', label: 'Full width bottom' }
]

const TEXT_ANIM_IN: { id: TextOverlayAnimationIn; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'fade', label: 'Fade in' },
  { id: 'pop', label: 'Pop' },
  { id: 'scale-in', label: 'Scale in' },
  { id: 'bounce', label: 'Bounce' },
  { id: 'zoom-in', label: 'Zoom in' },
  { id: 'blur-in', label: 'Blur in' },
  { id: 'flip-in', label: 'Flip in' },
  { id: 'slide-top', label: 'Slide from top' },
  { id: 'slide-bottom', label: 'Slide from bottom' },
  { id: 'slide-left', label: 'Slide from left' },
  { id: 'slide-right', label: 'Slide from right' },
  { id: 'typewriter', label: 'Typewriter' },
]
const TEXT_ANIM_OUT: { id: TextOverlayAnimationOut; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'fade', label: 'Fade out' },
  { id: 'pop', label: 'Pop out' },
  { id: 'scale-out', label: 'Scale out' },
  { id: 'bounce-out', label: 'Bounce out' },
  { id: 'zoom-out', label: 'Zoom out' },
  { id: 'flip-out', label: 'Flip out' },
  { id: 'slide-top', label: 'Slide to top' },
  { id: 'slide-bottom', label: 'Slide to bottom' },
  { id: 'slide-left', label: 'Slide to left' },
  { id: 'slide-right', label: 'Slide to right' },
]

interface PropertiesPanelProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  videoFilters: VideoFilter
  setVideoFilters: (filters: any) => void
  textOverlays: TextOverlay[]
  setTextOverlays: (overlays: any) => void
  imageOverlays?: ImageOverlay[]
  setImageOverlays?: (v: ImageOverlay[] | ((prev: ImageOverlay[]) => ImageOverlay[])) => void
  gradientOverlays?: GradientOverlay[]
  setGradientOverlays?: (v: GradientOverlay[] | ((prev: GradientOverlay[]) => GradientOverlay[])) => void
  captionStyle: CaptionStyle | null
  setCaptionStyle: (s: CaptionStyle | null) => void
  isOledTheme?: boolean
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  isOpen,
  setIsOpen,
  videoFilters,
  setVideoFilters,
  textOverlays,
  setTextOverlays,
  imageOverlays = [],
  setImageOverlays,
  gradientOverlays = [],
  setGradientOverlays,
  captionStyle,
  setCaptionStyle,
  isOledTheme
}) => {
  const cap = captionStyle ?? { enabled: false, size: 'medium' as CaptionSize, font: 'Inter, sans-serif', layout: 'bottom-center' as CaptionLayout, textStyle: 'default' as CaptionTextStyle, emojisEnabled: false }
  if (!isOpen) return null

  const FilterSlider = ({ label, value, min, max, field, resetValue = 100 }: { label: string, value: number, min: number, max: number, field: keyof VideoFilter, resetValue?: number }) => (
    <div>
      <label className="block text-xs text-theme-primary mb-1.5 flex items-center justify-between">
        <span>{label}: {value}{field === 'hue' ? '°' : '%'}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setVideoFilters((prev: any) => ({ ...prev, [field]: resetValue }))}
            className="text-[10px] text-theme-muted hover:text-theme-primary transition-colors px-1"
          >
            Reset
          </button>
          <span className="text-[10px] text-theme-muted">● Live</span>
        </div>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => setVideoFilters((prev: any) => ({ ...prev, [field]: parseInt(e.target.value) }))}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full accent-purple-500 cursor-grab active:cursor-grabbing h-1.5"
      />
    </div>
  )

  return (
    <div className={`${isOledTheme ? 'bg-black/95 border-slate-800' : 'bg-surface-card border-subtle'} backdrop-blur-lg border-l flex flex-col shadow-theme-card flex-shrink-0 overflow-hidden transition-all duration-300`}
      style={{ width: 'clamp(280px, 20vw, 320px)' }}>
      <div className="p-2 border-b border-subtle flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-theme-primary flex items-center gap-2 text-sm">
          <Settings className="w-4 h-4" />
          Properties
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-surface-card-hover rounded-lg transition-colors text-theme-secondary"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="editor-auto flex-1 p-3 overflow-y-auto min-w-0">
        <div className="space-y-4">
          <div className="bg-surface-elevated p-3 rounded-xl border border-subtle">
            <h4 className="font-semibold mb-3 text-theme-primary flex items-center gap-2 text-sm">
              <Filter className="w-4 h-4 text-purple-500" />
              Global Filters
            </h4>
            <div className="space-y-3">
              <FilterSlider label="Brightness" value={videoFilters.brightness} min={0} max={200} field="brightness" />
              <FilterSlider label="Contrast" value={videoFilters.contrast} min={0} max={200} field="contrast" />
              <FilterSlider label="Saturation" value={videoFilters.saturation} min={0} max={200} field="saturation" />
              <FilterSlider label="Hue" value={videoFilters.hue} min={-180} max={180} field="hue" resetValue={0} />
              <FilterSlider label="Temperature" value={videoFilters.temperature} min={0} max={200} field="temperature" />
              <FilterSlider label="Vibrance" value={videoFilters.vibrance} min={0} max={200} field="vibrance" />
              <FilterSlider label="Clarity" value={videoFilters.clarity} min={-100} max={100} field="clarity" resetValue={0} />
              <FilterSlider label="Dehaze" value={videoFilters.dehaze} min={-100} max={100} field="dehaze" resetValue={0} />
              <FilterSlider label="Vignette" value={videoFilters.vignette} min={0} max={100} field="vignette" resetValue={0} />
              <FilterSlider label="Blur" value={videoFilters.blur} min={0} max={100} field="blur" resetValue={0} />
            </div>
          </div>

          <div className="bg-surface-elevated p-4 rounded-xl border border-subtle">
            <h4 className="font-semibold mb-4 text-theme-primary flex items-center gap-2 text-sm">
              <Subtitles className="w-4 h-4 text-emerald-500" />
              Transcript captions
            </h4>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cap.enabled}
                  onChange={(e) => setCaptionStyle({ ...cap, enabled: e.target.checked })}
                  className="rounded accent-emerald-500"
                />
                <span className="text-xs font-medium text-emerald-900 dark:text-emerald-100">Show captions</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!cap.emojisEnabled}
                  onChange={(e) => setCaptionStyle({ ...cap, emojisEnabled: e.target.checked })}
                  className="rounded accent-emerald-500"
                />
                <span className="text-xs font-medium text-emerald-900 dark:text-emerald-100">Matching emojis</span>
              </label>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 -mt-1.5">
                Add contextually relevant emojis to captions for more engagement. Toggle off to remove.
              </p>
              <div>
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase block mb-1.5">Size</span>
                <div className="flex gap-1.5 flex-wrap">
                  {(['small', 'medium', 'large'] as CaptionSize[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setCaptionStyle({ ...cap, size: s })}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${cap.size === s ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase block mb-1.5">Font</span>
                <select
                  value={CAPTION_FONTS.find((f) => f.family === cap.font)?.id ?? 'Inter'}
                  onChange={(e) => {
                    const f = CAPTION_FONTS.find((x) => x.id === e.target.value)
                    if (f) setCaptionStyle({ ...cap, font: f.family })
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-800 text-emerald-900 dark:text-emerald-100 text-xs font-medium"
                >
                  {CAPTION_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase block mb-1.5">Layout</span>
                <div className="flex flex-col gap-1">
                  {CAPTION_LAYOUTS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setCaptionStyle({ ...cap, layout: l.id })}
                      className={`px-2.5 py-1.5 rounded-lg text-left text-[10px] font-bold transition-all ${cap.layout === l.id ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'}`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase block mb-1.5">Text style</span>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-1.5">Word-level transcript; style applies to captions.</p>
                <div className="flex flex-wrap gap-1.5">
                  {CAPTION_TEXT_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setCaptionStyle({ ...cap, textStyle: s.id })}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${(cap.textStyle ?? 'default') === s.id ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {textOverlays.length > 0 && (
            <div className="bg-surface-elevated p-4 rounded-xl border border-subtle">
              <h4 className="font-semibold mb-4 text-theme-primary flex items-center gap-2 text-sm">
                <Type className="w-4 h-4 text-blue-500" />
                Text Overlays ({textOverlays.length})
              </h4>
              <div className="space-y-3">
                {textOverlays.map(overlay => (
                  <div key={overlay.id} className="p-3 bg-surface-card rounded-lg border border-subtle space-y-2">
                    <div className="font-medium text-xs text-theme-primary truncate">{overlay.text}</div>
                    <div className="text-[10px] text-theme-secondary">
                      {formatTime(overlay.startTime)} - {formatTime(overlay.endTime)}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-bold text-gray-500 uppercase">Color</span>
                      <input
                        type="color"
                        value={overlay.color || '#ffffff'}
                        onChange={(e) => setTextOverlays((prev: any[]) => prev.map(o => o.id === overlay.id ? { ...o, color: e.target.value } : o))}
                        className="w-8 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                      {(overlay.style === 'outline' || overlay.style === 'shadow') && (
                        <>
                          <span className="text-[9px] font-bold text-gray-500 uppercase">Outline</span>
                          <input
                            type="color"
                            value={overlay.outlineColor || overlay.shadowColor || '#ffffff'}
                            onChange={(e) => setTextOverlays((prev: any[]) => prev.map(o => o.id === overlay.id ? { ...o, outlineColor: e.target.value, shadowColor: e.target.value } : o))}
                            className="w-8 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                          />
                        </>
                      )}
                      <label className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Background</span>
                        <input
                          type="color"
                          value={overlay.backgroundColor || '#333333'}
                          onChange={(e) => setTextOverlays((prev: any[]) => prev.map(o => o.id === overlay.id ? { ...o, backgroundColor: e.target.value } : o))}
                          className="w-8 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                          title="Optional background for text"
                        />
                        {overlay.backgroundColor && (
                          <button type="button" onClick={() => setTextOverlays((prev: any[]) => prev.map(o => o.id === overlay.id ? { ...o, backgroundColor: undefined } : o))} className="text-[9px] text-gray-500 hover:text-red-500">Clear</button>
                        )}
                      </label>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Font</span>
                      <select
                        value={CAPTION_FONTS.find(f => f.family === overlay.fontFamily)?.id ?? 'Inter'}
                        onChange={(e) => {
                          const f = CAPTION_FONTS.find(x => x.id === e.target.value)
                          if (f) setTextOverlays((prev: any[]) => prev.map(o => o.id === overlay.id ? { ...o, fontFamily: f.family } : o))
                        }}
                        className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
                      >
                        {CAPTION_FONTS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Animation in</span>
                      <select
                        value={overlay.animationIn ?? 'none'}
                        onChange={(e) => setTextOverlays((prev: any[]) => prev.map(o => o.id === overlay.id ? { ...o, animationIn: e.target.value as TextOverlayAnimationIn } : o))}
                        className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-[10px]"
                      >
                        {TEXT_ANIM_IN.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Animation out</span>
                      <select
                        value={overlay.animationOut ?? 'none'}
                        onChange={(e) => setTextOverlays((prev: any[]) => prev.map(o => o.id === overlay.id ? { ...o, animationOut: e.target.value as TextOverlayAnimationOut } : o))}
                        className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-[10px]"
                      >
                        {TEXT_ANIM_OUT.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Motion graphic</span>
                      <select
                        value={overlay.motionGraphic ?? 'none'}
                        onChange={(e) => setTextOverlays((prev: any[]) => prev.map(o => o.id === overlay.id ? { ...o, motionGraphic: e.target.value as MotionGraphicPreset } : o))}
                        className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-[10px]"
                      >
                        {MOTION_GRAPHIC_PRESETS.map((p) => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <label className="flex items-center gap-1 text-[10px]">
                        <span className="text-gray-500">In (s)</span>
                        <input
                          type="number"
                          min={0.1}
                          max={2}
                          step={0.1}
                          value={overlay.animationInDuration ?? 0.3}
                          onChange={(e) => setTextOverlays((prev: any[]) => prev.map(o => o.id === overlay.id ? { ...o, animationInDuration: parseFloat(e.target.value) || 0.3 } : o))}
                          className="w-12 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-[10px]"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-[10px]">
                        <span className="text-gray-500">Out (s)</span>
                        <input
                          type="number"
                          min={0.1}
                          max={2}
                          step={0.1}
                          value={overlay.animationOutDuration ?? 0.3}
                          onChange={(e) => setTextOverlays((prev: any[]) => prev.map(o => o.id === overlay.id ? { ...o, animationOutDuration: parseFloat(e.target.value) || 0.3 } : o))}
                          className="w-12 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-[10px]"
                        />
                      </label>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setTextOverlays((prev: any[]) => prev.filter(o => o.id !== overlay.id))}
                        className="text-[10px] px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {imageOverlays.length > 0 && setImageOverlays && (
            <div className="bg-surface-elevated p-4 rounded-xl border border-subtle mt-4">
              <h4 className="font-semibold mb-3 text-theme-primary flex items-center gap-2 text-sm">Image Overlays ({imageOverlays.length})</h4>
              <div className="space-y-3">
                {imageOverlays.map((img) => (
                  <div key={img.id} className="p-3 bg-surface-card rounded-lg border border-subtle space-y-2">
                    <div className="text-[10px] text-teal-700 dark:text-teal-300 truncate" title={img.url}>{img.url.slice(0, 40)}…</div>
                    <div className="text-[10px] text-teal-600 dark:text-teal-400">{formatTime(img.startTime)} - {formatTime(img.endTime)}</div>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <label><span className="text-gray-500">X %</span></label>
                      <input type="number" min={0} max={100} value={img.x} onChange={(e) => setImageOverlays((prev) => prev.map((o) => o.id === img.id ? { ...o, x: Number(e.target.value) } : o))} className="w-full px-1 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800" />
                      <label><span className="text-gray-500">Y %</span></label>
                      <input type="number" min={0} max={100} value={img.y} onChange={(e) => setImageOverlays((prev) => prev.map((o) => o.id === img.id ? { ...o, y: Number(e.target.value) } : o))} className="w-full px-1 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800" />
                      <label><span className="text-gray-500">Width %</span></label>
                      <input type="number" min={1} max={100} value={img.width} onChange={(e) => setImageOverlays((prev) => prev.map((o) => o.id === img.id ? { ...o, width: Number(e.target.value) } : o))} className="w-full px-1 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800" />
                      <label><span className="text-gray-500">Height %</span></label>
                      <input type="number" min={1} max={100} value={img.height} onChange={(e) => setImageOverlays((prev) => prev.map((o) => o.id === img.id ? { ...o, height: Number(e.target.value) } : o))} className="w-full px-1 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800" />
                      <label><span className="text-gray-500">Opacity</span></label>
                      <input type="number" min={0} max={1} step={0.1} value={img.opacity} onChange={(e) => setImageOverlays((prev) => prev.map((o) => o.id === img.id ? { ...o, opacity: Number(e.target.value) } : o))} className="w-full px-1 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800" />
                    </div>
                    <button onClick={() => setImageOverlays((prev) => prev.filter((o) => o.id !== img.id))} className="text-[10px] px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {gradientOverlays.length > 0 && setGradientOverlays && (
            <div className="bg-surface-elevated p-4 rounded-xl border border-subtle mt-4">
              <h4 className="font-semibold mb-3 text-theme-primary text-sm">Gradient Overlays ({gradientOverlays.length})</h4>
              <div className="space-y-3">
                {gradientOverlays.map((g) => (
                  <div key={g.id} className="p-3 bg-surface-card rounded-lg border border-subtle space-y-2">
                    <div className="text-[10px] text-amber-700 dark:text-amber-300">{g.region ?? 'full'} · {g.direction}</div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400">{formatTime(g.startTime)} - {formatTime(g.endTime)}</div>
                    <label className="flex items-center gap-2 text-[10px]">
                      <span className="text-gray-500">Opacity</span>
                      <input type="number" min={0} max={1} step={0.1} value={g.opacity} onChange={(e) => setGradientOverlays((prev) => prev.map((o) => o.id === g.id ? { ...o, opacity: Number(e.target.value) } : o))} className="w-16 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800" />
                    </label>
                    <button onClick={() => setGradientOverlays((prev) => prev.filter((o) => o.id !== g.id))} className="text-[10px] px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
