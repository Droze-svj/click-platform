'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Play, Pause, Eye, EyeOff } from 'lucide-react'
import { VideoFilter, TextOverlay, CaptionStyle, CAPTION_SIZE_PX, TemplateLayout, TEMPLATE_LAYOUTS, CaptionTextStyle } from '../../types/editor'
import { getMatchingEmojiForChunk } from '../../utils/captionEmojiMap'

export interface TranscriptWord {
    word: string
    start: number
    end: number
}

interface RealTimeVideoPreviewProps {
    videoUrl: string
    currentTime: number
    isPlaying: boolean
    volume: number
    isMuted: boolean
    playbackSpeed: number
    filters: VideoFilter
    textOverlays: TextOverlay[]
    editingWords?: TranscriptWord[]
    captionStyle?: CaptionStyle | null
    templateLayout?: TemplateLayout
    onTimeUpdate: (time: number) => void
    onDurationChange: (duration: number) => void
    onPlayPause: () => void
}

const RealTimeVideoPreview: React.FC<RealTimeVideoPreviewProps> = ({
    videoUrl, currentTime, isPlaying, volume, isMuted, playbackSpeed = 1, filters, textOverlays, editingWords = [], captionStyle, templateLayout = 'standard', onTimeUpdate, onDurationChange, onPlayPause
}) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [showAppliedFilters, setShowAppliedFilters] = useState(true)
    const [videoDimensions, setVideoDimensions] = useState<{ w: number; h: number } | null>(null)

    const layoutSpec = (() => {
        const t = TEMPLATE_LAYOUTS.find((l) => l.id === templateLayout) ?? TEMPLATE_LAYOUTS[1]
        if (templateLayout === 'auto' && videoDimensions && videoDimensions.w > 0 && videoDimensions.h > 0) {
            return { ...t, aspect: `${videoDimensions.w}/${videoDimensions.h}` }
        }
        return t
    })()

    useEffect(() => {
        const v = videoRef.current
        if (!v) return
        if (isPlaying) v.play().catch(() => { })
        else v.pause()
    }, [isPlaying])

    useEffect(() => {
        const v = videoRef.current
        if (!v) return
        v.volume = volume
        v.muted = isMuted
    }, [volume, isMuted])

    useEffect(() => {
        const v = videoRef.current
        if (!v) return
        v.playbackRate = Math.max(0.25, Math.min(4, playbackSpeed || 1))
    }, [playbackSpeed])

    const filterString = showAppliedFilters ? `
    brightness(${filters.brightness}%) 
    contrast(${filters.contrast}%) 
    saturate(${filters.saturation}%) 
    hue-rotate(${filters.hue}deg) 
    blur(${filters.blur}px) 
    sepia(${filters.sepia}%)
  ` : 'none'

    return (
        <div className="w-full max-w-full flex flex-col items-center" style={{ aspectRatio: layoutSpec.aspect }}>
            <div className="relative w-full h-full min-h-0 bg-black rounded-3xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center border border-white/10 group">
            <video
                ref={videoRef}
                src={videoUrl}
                className="max-w-full max-h-full object-contain transition-all duration-700 ease-in-out"
                style={{ filter: filterString }}
                onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                    const v = e.currentTarget
                    onDurationChange(v.duration)
                    if (v.videoWidth > 0 && v.videoHeight > 0) {
                        setVideoDimensions({ w: v.videoWidth, h: v.videoHeight })
                    }
                }}
                onClick={onPlayPause}
            />

            {/* Audio Waveform Simulation Overlay */}
            <div className="absolute inset-x-0 bottom-0 h-24 pointer-events-none overflow-hidden opacity-40">
                <div className="flex items-end gap-[1px] h-full px-4 w-fit animate-pulse">
                    {Array.from({ length: 120 }).map((_, i) => (
                        <div
                            key={i}
                            className="w-1 bg-blue-500/50 rounded-full"
                            style={{ height: `${Math.random() * 80 + 20}%`, transition: 'height 0.2s ease-in-out' }}
                        />
                    ))}
                </div>
            </div>

            <div className="absolute top-6 right-6 flex items-center gap-2">
                <button
                    onClick={() => setShowAppliedFilters(!showAppliedFilters)}
                    className={`p-2 rounded-xl backdrop-blur-xl border transition-all ${showAppliedFilters ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white/40'}`}
                    title="Toggle Filters (Before/After)"
                >
                    {showAppliedFilters ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
            </div>

            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 px-8 py-4 bg-black/40 backdrop-blur-2xl rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                <button onClick={onPlayPause} className="text-white hover:text-blue-400 transition-colors">
                    {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
                </button>
                <div className="w-[1px] h-4 bg-white/20" />
                <div className="text-[10px] font-black font-mono text-white/60 tracking-widest uppercase">Elite V3 Engine</div>
            </div>

            {textOverlays
                .filter((o) => {
                    if (o.startTime == null || o.endTime == null) return true
                    return currentTime >= o.startTime && currentTime <= o.endTime
                })
                .map((overlay) => {
                    const s = overlay.style ?? 'none'
                    const baseShadow = '0 2px 10px rgba(0,0,0,0.5)'
                    const overlayShadows: Record<string, string> = {
                        none: baseShadow,
                        shadow: '0 4px 16px rgba(0,0,0,0.7), 0 2px 6px rgba(0,0,0,0.5)',
                        outline: 'none',
                        neon: `0 0 10px ${overlay.color}, 0 0 20px ${overlay.color}, 0 0 30px rgba(0,0,0,0.8)`,
                        minimal: '0 1px 3px rgba(0,0,0,0.4)',
                        'bold-kinetic': '0 3px 12px rgba(0,0,0,0.6)',
                    }
                    const stroke = s === 'outline' ? `1.5px ${overlay.shadowColor || '#fff'}` : undefined
                    return (
                        <div
                            key={overlay.id}
                            className="absolute pointer-events-none select-none text-center"
                            style={{
                                left: `${overlay.x}%`,
                                top: `${overlay.y}%`,
                                fontSize: `${overlay.fontSize}px`,
                                color: s === 'outline' ? 'transparent' : overlay.color,
                                fontFamily: overlay.fontFamily,
                                transform: 'translate(-50%, -50%)',
                                textShadow: overlayShadows[s] ?? baseShadow,
                                WebkitTextStroke: stroke,
                                fontWeight: s === 'bold-kinetic' ? 800 : undefined,
                            }}
                        >
                            {overlay.text}
                        </div>
                    )
                })}

            {/* Transcript captions – word-level, synced to video dialogue */}
            {captionStyle?.enabled && editingWords.length > 0 && (() => {
                const words = editingWords as TranscriptWord[]
                const firstStart = words[0]?.start ?? 0
                const activeIdx = words.findIndex((w) => currentTime >= w.start && currentTime <= w.end)
                const windowSize = 8
                let start: number
                if (activeIdx >= 0) {
                    start = Math.max(0, Math.min(activeIdx - 2, words.length - windowSize))
                } else if (currentTime < firstStart) {
                    start = 0
                } else {
                    start = Math.max(0, words.length - windowSize)
                }
                const chunk = words.slice(start, start + windowSize)
                const activeWord = activeIdx >= 0 ? words[activeIdx] : null
                const emoji = (captionStyle.emojisEnabled && getMatchingEmojiForChunk(chunk, activeWord)) || null
                const fontSize = CAPTION_SIZE_PX[captionStyle.size]
                const fontFamily = captionStyle.font || 'Inter, sans-serif'
                const ts: CaptionTextStyle = captionStyle.textStyle ?? 'default'

                const layoutStyles: Record<string, React.CSSProperties> = {
                    'bottom-center': {
                        bottom: '10%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 'auto',
                        maxWidth: '90%',
                        textAlign: 'center',
                        justifyContent: 'center'
                    },
                    'lower-third': {
                        bottom: '20%',
                        left: '6%',
                        right: 'auto',
                        width: '60%',
                        maxWidth: '70%',
                        textAlign: 'left',
                        justifyContent: 'flex-start'
                    },
                    'top-center': {
                        top: '8%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 'auto',
                        maxWidth: '90%',
                        textAlign: 'center',
                        justifyContent: 'center'
                    },
                    'full-width-bottom': {
                        bottom: 0,
                        left: 0,
                        right: 0,
                        width: '100%',
                        padding: '12px 16px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                        textAlign: 'center',
                        justifyContent: 'center'
                    }
                }
                const pos = layoutStyles[captionStyle.layout] || layoutStyles['bottom-center']

                const baseShadow = '0 2px 8px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,1)'
                const shadowStrong = '0 4px 12px rgba(0,0,0,0.95), 0 2px 4px rgba(0,0,0,0.9)'
                const neonShadow = '0 0 8px #fff, 0 0 16px #0ef, 0 0 24px #0ef'
                const minimalShadow = '0 1px 2px rgba(0,0,0,0.6)'

                return (
                    <div
                        className="absolute flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-4 pointer-events-none select-none"
                        style={{
                            ...pos,
                            fontFamily,
                            fontSize: `${fontSize}px`,
                            color: ts === 'outline' ? 'transparent' : '#fff',
                            textShadow: ts === 'outline' ? 'none' : ts === 'shadow' ? shadowStrong : ts === 'neon' ? neonShadow : ts === 'minimal' ? minimalShadow : baseShadow,
                            lineHeight: 1.3,
                            WebkitTextStroke: ts === 'outline' ? '1.5px #fff' : undefined
                        }}
                    >
                        {emoji && (
                            <span className="shrink-0" style={{ fontSize: `${Math.round(fontSize * 1.1)}px`, lineHeight: 1, opacity: 0.95 }} aria-hidden="true">
                                {emoji}
                            </span>
                        )}
                        {chunk.map((w) => {
                            const isActive = words.indexOf(w) === activeIdx
                            const isPast = currentTime > w.end
                            const isFuture = currentTime < w.start
                            const dimmed = activeIdx < 0 && (currentTime < firstStart ? isFuture : isPast)
                            const opacity = dimmed ? 0.4 : isActive ? 1 : 0.7
                            const fontWeight = ts === 'bold' || ts === 'kinetic' ? (isActive && ts === 'kinetic' ? 800 : 700) : isActive ? 700 : 400
                            const scale = ts === 'kinetic' && isActive ? 1.15 : 1
                            const transform = `scale(${scale})`
                            const pill = ts === 'pill'
                            return (
                                <span
                                    key={`${w.word}-${w.start}-${w.end}`}
                                    style={{
                                        fontWeight,
                                        opacity,
                                        transition: 'opacity 0.1s ease, font-weight 0.1s ease, transform 0.12s ease',
                                        transform,
                                        textTransform: ts === 'uppercase' ? 'uppercase' : undefined,
                                        backgroundColor: pill ? 'rgba(0,0,0,0.75)' : undefined,
                                        borderRadius: pill ? 9999 : undefined,
                                        padding: pill ? '2px 8px' : undefined,
                                        margin: pill ? '0 2px' : undefined
                                    }}
                                >
                                    {w.word}
                                </span>
                            )
                        })}
                    </div>
                )
            })()}
            </div>
        </div>
    )
}

export default RealTimeVideoPreview
