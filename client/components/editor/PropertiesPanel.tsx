'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, HelpCircle, Layers, SlidersHorizontal, Sun, PaintBucket,
  ZoomIn, Type, MonitorPlay, Zap, RefreshCw, Smartphone, Monitor, Hexagon,
  ImageIcon, Sparkles, Move, SplitSquareHorizontal, MoveVertical, Palette, Lock, Scissors, Volume2, Headphones,
  Settings, Fingerprint, Activity, Subtitles
} from 'lucide-react'
import {
  VideoFilter,
  TextOverlay,
  CaptionStyle,
  CaptionSize,
  CaptionLayout,
  CaptionTextStyle,
  CAPTION_FONTS,
  CAPTION_TEXT_STYLES,
  CAPTION_CREATIVE_PRESETS,
  TextOverlayAnimationIn,
  TextOverlayAnimationOut,
  MOTION_GRAPHIC_PRESETS,
  MotionGraphicPreset,
  ImageOverlay,
  GradientOverlay
} from '../../types/editor'
import { formatTime } from '../../utils/editorUtils'

const CAPTION_LAYOUTS: { id: CaptionLayout; label: string }[] = [
  { id: 'bottom-center', label: 'Adaptive Bottom' },
  { id: 'lower-third', label: 'Lower Third' },
  { id: 'top-center', label: 'Zenith Center' },
  { id: 'full-width-bottom', label: 'Immersive Bar' }
]

const glassStyle = "backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl"

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
  style?: React.CSSProperties
  videoTransform?: { scale?: number, positionX?: number, positionY?: number, rotation?: number }
  setVideoTransform?: (t: { scale?: number, positionX?: number, positionY?: number, rotation?: number }) => void
  videoTransformKeyframes?: any[]
  setVideoTransformKeyframes?: (v: any) => void
  currentTime?: number
  onTimeUpdate?: (t: number) => void
  timelineSegments?: any[]
  setTimelineSegments?: (v: any) => void
  selectedSegmentId?: string | null
  transcript?: any
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
  isOledTheme,
  style,
  videoTransform,
  setVideoTransform,
  videoTransformKeyframes,
  setVideoTransformKeyframes,
  currentTime = 0,
  onTimeUpdate,
  timelineSegments,
  setTimelineSegments,
  selectedSegmentId,
  transcript
}) => {
  const [activeTab, setActiveTab] = React.useState<'synthesis' | 'projection' | 'entities' | 'transform' | 'clip'>('synthesis')

  React.useEffect(() => {
    if (selectedSegmentId) setActiveTab('clip')
    else if (activeTab === 'clip') setActiveTab('synthesis')
  }, [selectedSegmentId, activeTab])

  const cap = captionStyle ?? {
    enabled: false,
    size: 'medium' as CaptionSize,
    font: 'Inter, sans-serif',
    layout: 'bottom-center' as CaptionLayout,
    textStyle: 'default' as CaptionTextStyle,
    emojisEnabled: false
  }

  if (!isOpen) return null

  const ControllerSlider = ({
    label,
    value,
    min,
    max,
    field,
    resetValue = 100
  }: {
    label: string,
    value: number,
    min: number,
    max: number,
    field: keyof VideoFilter | 'scale' | 'positionX' | 'positionY' | 'rotation',
    resetValue?: number
  }) => (
    <div className="group/slider relative space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest group-hover/slider:text-indigo-400 transition-colors">
          {label}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono font-bold text-white/50">{value}</span>
          <button
            onClick={() => setVideoFilters((prev: any) => ({ ...prev, [field]: resetValue }))}
            className="text-[8px] font-black text-slate-700 hover:text-white uppercase tracking-tighter"
          >
            Reset
          </button>
        </div>
      </div>
      <div className="relative h-6 flex items-center">
        <div className="absolute inset-x-0 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
            style={{ width: `${((value - min) / (max - min)) * 100}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          title={`${label}: ${value}`}
          onChange={(e) => {
            if (field === 'scale' || field === 'positionX' || field === 'positionY' || field === 'rotation') {
               if (setVideoTransform) {
                 const v = parseInt(e.target.value)
                 setVideoTransform({ ...(videoTransform || {}), [field]: field === 'scale' ? v / 100 : v })
               }
            } else {
               setVideoFilters((prev: any) => ({ ...prev, [field]: parseInt(e.target.value) }))
            }
          }}
          className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
        />
        <motion.div
          className="absolute w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] border border-indigo-500 pointer-events-none"
          style={{ left: `calc(${((value - min) / (max - min)) * 100}% - 5px)` }}
        />
      </div>
    </div>
  )

  return (
    <motion.aside
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={`relative z-40 h-full p-6 flex flex-col pointer-events-none w-full`}
      style={{ ...style, maxWidth: style?.width }}
    >
      <div className={`${glassStyle} h-full rounded-[3rem] border-white/5 flex flex-col overflow-hidden pointer-events-auto shadow-[0_0_100px_rgba(0,0,0,0.8)]`}>
        {/* Header */}
        <div className="px-6 py-6 border-b border-white/5 bg-white/[0.02] flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center text-indigo-400">
                <Settings className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">PROPERTIES MATRIX</span>
                <span className="text-sm font-black text-white italic tracking-tight uppercase">{activeTab} node active</span>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white border border-white/5"
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Tab Navigation */}
          <div className="flex p-1 bg-black/40 rounded-2xl border border-white/5 relative z-10 w-full overflow-x-auto custom-scrollbar">
            {(['transform', 'synthesis', 'projection', 'entities', ...(selectedSegmentId ? ['clip'] : [])] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all relative ${
                  activeTab === tab ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="active-property-tab"
                    className="absolute inset-0 bg-white/5 border border-white/10 rounded-xl shadow-inner"
                  />
                )}
                <span className="relative z-10">{tab}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Attributes */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8 pb-12">
          <AnimatePresence mode="wait">
            {activeTab === 'clip' && selectedSegmentId && (
              <motion.div
                key="clip"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-3">
                  <Scissors className="w-4 h-4 text-emerald-400" />
                  <span className="text-[11px] font-black text-white uppercase tracking-[0.4em] italic">Clip Properties</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/50 to-transparent ml-2" />
                </div>
                
                {(() => {
                  const seg = timelineSegments?.find((s: any) => s.id === selectedSegmentId)
                  if (!seg) return null
                  return (
                     <div className="space-y-8">
                        <div className="p-4 rounded-[1.2rem] bg-emerald-500/5 border border-emerald-500/20 shadow-inner">
                          <span className="text-[9px] uppercase font-black tracking-[0.3em] text-emerald-400 block mb-1">Target Segment</span>
                          <span className="text-sm font-bold text-white tracking-tight truncate flex items-center gap-2">
                             <Fingerprint className="w-3 h-3 text-slate-500" />
                             {seg.name}
                          </span>
                        </div>

                        <div className="space-y-4">
                           <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest">Playback Velocity</span>
                              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">{(seg.playbackSpeed ?? 1).toFixed(2)}x</span>
                           </div>
                           <input
                              type="range" min={0.1} max={4.0} step={0.1} value={seg.playbackSpeed ?? 1}
                              title={`Playback Speed: ${(seg.playbackSpeed ?? 1).toFixed(2)}x`}
                              onChange={(e) => {
                                 const val = parseFloat(e.target.value)
                                 setTimelineSegments?.((prev: any) => prev.map((s: any) => s.id === selectedSegmentId ? { ...s, playbackSpeed: val } : s))
                              }}
                              className="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all outline-none"
                           />
                           <p className="text-[9px] text-slate-500 italic max-w-xs leading-relaxed">Adjusts internal media playback engine time-scale logic.</p>
                        </div>
                        
                        <div className="space-y-4 pt-6 border-t border-white/10">
                           <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest">Optical SteadyCam</span>
                              <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">{seg.stabilization ?? 0}%</span>
                           </div>
                           <div className="flex items-center gap-4">
                              <Lock className={`w-5 h-5 ${(seg.stabilization ?? 0) > 0 ? 'text-indigo-400' : 'text-slate-600'}`} />
                              <input
                                 type="range" min={0} max={100} step={1} value={seg.stabilization ?? 0}
                                 title={`Stabilization: ${seg.stabilization ?? 0}%`}
                                 onChange={(e) => {
                                    const val = parseInt(e.target.value)
                                    setTimelineSegments?.((prev: any) => prev.map((s: any) => s.id === selectedSegmentId ? { ...s, stabilization: val } : s))
                                 }}
                                 className="flex-1 h-2 bg-white/5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-indigo-400 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all outline-none"
                              />
                           </div>
                           <p className="text-[9px] text-slate-500 italic max-w-xs leading-relaxed">Applies Gyro-Smooth padding to edge-bounds of frame data to reduce jitters.</p>
                        </div>

                        {(seg.type === 'video' || seg.type === 'audio') && (
                          <div className="space-y-6 pt-6 border-t border-white/10">
                             <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                     <Volume2 className="w-4 h-4 text-rose-400" />
                                     <span className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest">Master Volume</span>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded">{Math.round((seg.volume ?? 1) * 100)}%</span>
                                </div>
                                <input
                                   type="range" min={0} max={2.0} step={0.05} value={seg.volume ?? 1}
                                   title={`Volume: ${Math.round((seg.volume ?? 1) * 100)}%`}
                                   onChange={(e) => {
                                      const val = parseFloat(e.target.value)
                                      setTimelineSegments?.((prev: any) => prev.map((s: any) => s.id === selectedSegmentId ? { ...s, volume: val } : s))
                                   }}
                                   className="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-rose-400 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all outline-none"
                                />
                             </div>

                             {seg.type === 'audio' && (
                               <div className="flex items-center justify-between p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
                                  <div className="flex items-center gap-3">
                                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${seg.audioDucking ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                        <Headphones className="w-4 h-4" />
                                     </div>
                                     <div className="flex flex-col">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-200">Auto-Ducking</span>
                                        <span className="text-[9px] text-slate-500 italic">Lower DB against Dialogue</span>
                                     </div>
                                  </div>
                                  <button
                                     title="Toggle Auto-Ducking"
                                     onClick={() => {
                                        setTimelineSegments?.((prev: any) => prev.map((s: any) => {
                                           if (s.id !== selectedSegmentId) return s
                                           
                                           const isEnabling = !s.audioDucking
                                           let newEnvelope = undefined
                                           
                                           // Generate dynamic envelope if enabling and transcript exists
                                           if (isEnabling && transcript?.words) {
                                              newEnvelope = [] as { time: number, volume: number }[]
                                              let isDucked = false
                                              
                                              // Start normal volume
                                              newEnvelope.push({ time: 0, volume: 1.0 })
                                              
                                              // Simple envelope generator: dip volume 0.3s before speech, restore 0.5s after pause
                                              transcript.words.forEach((w: any, i: number, arr: any[]) => {
                                                 const prevWord = arr[i - 1]
                                                 const gap = prevWord ? w.start - prevWord.end : w.start
                                                 
                                                 // If gap > 1s, we had a pause. Swell volume up, then dip for next word
                                                 if (gap > 1.0 || i === 0) {
                                                    if (i > 0) newEnvelope!.push({ time: w.start - 0.8, volume: 1.0 }) // Swell up
                                                    newEnvelope!.push({ time: Math.max(0, w.start - 0.3), volume: 0.15 }) // Dip down
                                                 }
                                              })
                                           }
                                           
                                           return { 
                                              ...s, 
                                              audioDucking: isEnabling,
                                              audioEnvelope: newEnvelope
                                           }
                                        }))
                                     }}
                                     className={`w-10 h-5 rounded-full relative transition-colors ${seg.audioDucking ? 'bg-orange-500' : 'bg-white/10'}`}
                                  >
                                     <motion.div
                                        animate={{ x: seg.audioDucking ? 20 : 2 }}
                                        className="absolute top-0.5 left-0 w-4 h-4 rounded-full bg-white shadow-sm"
                                     />
                                  </button>
                               </div>
                             )}
                          </div>
                        )}
                     </div>
                  )
                })()}
              </motion.div>
            )}

            {activeTab === 'transform' && (
              <motion.div
                key="transform"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-rose-400" />
                  <span className="text-[11px] font-black text-white uppercase tracking-[0.4em] italic">Spatial Transform</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent ml-2" />
                </div>
                {setVideoTransform && (
                  <div className="space-y-6">
                    <ControllerSlider label="Scale (%)" value={(videoTransform?.scale || 1) * 100} min={10} max={400} field="scale" resetValue={100} />
                    <ControllerSlider label="X Position" value={videoTransform?.positionX || 0} min={-100} max={100} field="positionX" resetValue={0} />
                    <ControllerSlider label="Y Position" value={videoTransform?.positionY || 0} min={-100} max={100} field="positionY" resetValue={0} />
                    <ControllerSlider label="Rotation (deg)" value={videoTransform?.rotation || 0} min={-180} max={180} field="rotation" resetValue={0} />

                    {setVideoTransformKeyframes && (
                      <div className="pt-4 border-t border-white/10">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Animation</span>
                          <span className="text-[9px] text-indigo-400 font-bold">{videoTransformKeyframes?.length || 0} Keyframes</span>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            const newKf = {
                              id: `kf-${Date.now()}`,
                              time: currentTime,
                              positionX: videoTransform?.positionX || 0,
                              positionY: videoTransform?.positionY || 0,
                              scale: videoTransform?.scale || 1,
                              rotation: videoTransform?.rotation || 0,
                              easing: 'ease-in-out'
                            }
                            setVideoTransformKeyframes([...(videoTransformKeyframes || []), newKf].sort((a,b) => a.time - b.time))
                          }}
                          className="w-full py-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(79,70,229,0.2)]"
                        >
                          + Add Keyframe at Playhead
                        </motion.button>

                        {onTimeUpdate && videoTransformKeyframes && videoTransformKeyframes.length > 0 && (
                           <div className="flex items-center gap-2 mt-2">
                             <button
                               onClick={() => {
                                 const prevKfs = videoTransformKeyframes.filter(k => k.time < currentTime - 0.05).sort((a,b) => b.time - a.time);
                                 if (prevKfs.length > 0) onTimeUpdate(prevKfs[0].time);
                               }}
                               className="flex-1 py-1.5 rounded bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-colors border border-white/5"
                             >
                               ◁ Prev
                             </button>
                             <button
                               onClick={() => {
                                 const nextKfs = videoTransformKeyframes.filter(k => k.time > currentTime + 0.05).sort((a,b) => a.time - b.time);
                                 if (nextKfs.length > 0) onTimeUpdate(nextKfs[0].time);
                               }}
                               className="flex-1 py-1.5 rounded bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[9px] font-bold uppercase tracking-widest transition-colors border border-white/5"
                             >
                               Next ▷
                             </button>
                           </div>
                        )}

                        {videoTransformKeyframes && videoTransformKeyframes.length > 0 && (
                          <div className="mt-4 space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                            {videoTransformKeyframes.map((kf, i) => (
                              <div key={kf.id} className="flex flex-col gap-2 p-3 rounded-lg bg-black/40 border border-white/5 group hover:border-indigo-500/30">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    <span className="text-[10px] text-slate-300 font-mono">{kf.time.toFixed(2)}s</span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setVideoTransformKeyframes(videoTransformKeyframes.filter(k => k.id !== kf.id))
                                    }}
                                    className="text-[9px] text-slate-500 hover:text-rose-400 uppercase font-black"
                                  >
                                    Remove
                                  </button>
                                </div>

                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Curve</span>
                                  <select
                                    title="Curve"
                                    value={kf.easing || 'ease-in-out'}
                                    onChange={(e) => {
                                      setVideoTransformKeyframes(
                                        videoTransformKeyframes.map(k => k.id === kf.id ? { ...k, easing: e.target.value } : k)
                                      )
                                    }}
                                    className="bg-white/5 border border-white/10 text-[9px] text-slate-300 font-bold p-1 rounded outline-none"
                                  >
                                    <option value="linear">Linear</option>
                                    <option value="ease-in">Ease In</option>
                                    <option value="ease-out">Ease Out</option>
                                    <option value="ease-in-out">Ease In-Out</option>
                                    <option value="bounce-out">Bounce Out</option>
                                    <option value="elastic-out">Elastic Out</option>
                                    <option value="ease-in-out-cubic">Cubic IO</option>
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'synthesis' && (
              <motion.div
                key="synthesis"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-3">
                  <Palette className="w-4 h-4 text-indigo-400" />
                  <span className="text-[11px] font-black text-white uppercase tracking-[0.4em] italic">Global Synthesis</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent ml-2" />
                </div>
                <div className="space-y-6">
                  <ControllerSlider label="Luminosity" value={videoFilters.brightness} min={0} max={200} field="brightness" />
                  <ControllerSlider label="Dynamic Contrast" value={videoFilters.contrast} min={0} max={200} field="contrast" />
                  <ControllerSlider label="Neural Chroma" value={videoFilters.saturation} min={0} max={200} field="saturation" />
                  <ControllerSlider label="Tone Bias" value={videoFilters.temperature} min={0} max={200} field="temperature" />
                  <ControllerSlider label="Edge Clarity" value={videoFilters.clarity} min={-100} max={100} field="clarity" resetValue={0} />
                  <ControllerSlider label="Atmospheric Dehaze" value={videoFilters.dehaze} min={-100} max={100} field="dehaze" resetValue={0} />
                </div>
              </motion.div>
            )}

            {activeTab === 'projection' && (
              <motion.div
                key="projection"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-3">
                  <Subtitles className="w-4 h-4 text-emerald-400" />
                  <span className="text-[11px] font-black text-white uppercase tracking-[0.4em] italic">Intelligence Captions</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent ml-2" />
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 group hover:border-emerald-500/20 transition-all cursor-pointer"
                    onClick={() => setCaptionStyle({ ...cap, enabled: !cap.enabled })}>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Projection Active</span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Render real-time transcript</span>
                    </div>
                    <div className={`w-10 h-5 rounded-full border border-white/10 relative transition-all ${cap.enabled ? 'bg-emerald-600' : 'bg-white/5'}`}>
                      <motion.div animate={{ x: cap.enabled ? 20 : 2 }} className="absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {CAPTION_CREATIVE_PRESETS.map((pre) => {
                      const isActive = cap.enabled && cap.textStyle === pre.textStyle && cap.layout === pre.layout
                      return (
                        <motion.button
                          key={pre.id}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setCaptionStyle({ ...cap, enabled: true, textStyle: pre.textStyle, layout: pre.layout, size: pre.size, font: pre.font })}
                          className={`relative p-4 rounded-[1.5rem] border text-left overflow-hidden group/preset ${isActive ? 'bg-indigo-600 border-white/20 shadow-xl' : 'bg-white/[0.02] border-white/5 hover:border-indigo-500/30'}`}
                        >
                          <span className={`block text-[11px] font-black italic uppercase tracking-tight ${isActive ? 'text-white' : 'text-slate-400 group-hover/preset:text-white'}`}>{pre.label}</span>
                          <span className={`block text-[8px] mt-1 font-bold italic uppercase ${isActive ? 'text-white/60' : 'text-slate-600'}`}>{pre.description}</span>
                        </motion.button>
                      )
                    })}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Projection Logic</span>
                    <div className="flex gap-2">
                      {CAPTION_LAYOUTS.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => setCaptionStyle({ ...cap, layout: l.id })}
                          className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${cap.layout === l.id ? 'bg-white text-black border-white' : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'}`}
                        >
                          {l.label.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'entities' && (
              <motion.div
                key="entities"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-3">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px] font-black text-white uppercase tracking-[0.4em] italic">Neural entities</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent ml-2" />
                </div>

                <div className="space-y-3">
                  {textOverlays.length === 0 ? (
                    <div className="p-12 text-center rounded-3xl border border-white/5 bg-white/[0.01]">
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest italic">No active entities detected</span>
                    </div>
                  ) : (
                    textOverlays.map(overlay => (
                      <div key={overlay.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between group-hover:border-amber-500/20 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                            <Type className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-white italic truncate max-w-[120px]">{overlay.text}</span>
                            <span className="text-[8px] font-bold text-slate-500 uppercase">{formatTime(overlay.startTime)} - {formatTime(overlay.endTime)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setTextOverlays((prev: any[]) => prev.filter(o => o.id !== overlay.id))}
                          className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Diagnostic Footer */}
        <div className="px-4 py-5 border-t border-white/5 bg-black/40 backdrop-blur-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Fingerprint className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Matrix Synchronized</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-amber-500 animate-pulse" />
          </div>
        </div>
      </div>
    </motion.aside>
  )
}

const Trash2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
)
