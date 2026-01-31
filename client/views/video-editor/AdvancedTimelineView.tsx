'use client'

import React from 'react'
import ProfessionalTimeline from '../../components/ProfessionalTimeline'
import AdvancedVideoTimeline from '../../components/AdvancedVideoTimeline'
import { AISuggestion, TimelineSegment, VideoState } from '../../types/editor'
import { getSegmentColor } from '../../utils/editorUtils'

interface AdvancedTimelineViewProps {
    useProfessionalTimeline: boolean
    setUseProfessionalTimeline: (val: boolean) => void
    videoState: VideoState
    setVideoState: (state: any) => void
    timelineSegments: TimelineSegment[]
    setTimelineSegments: (segments: any) => void
    videoUrl?: string
    aiSuggestions: AISuggestion[]
    showAiPreviews: boolean
    showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export const AdvancedTimelineView: React.FC<AdvancedTimelineViewProps> = ({
    useProfessionalTimeline,
    setUseProfessionalTimeline,
    videoState,
    setVideoState,
    timelineSegments,
    setTimelineSegments,
    videoUrl,
    aiSuggestions,
    showAiPreviews,
    showToast
}) => {
    return (
        <div className="space-y-6">
            {/* Timeline Mode Toggle */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Timeline Mode</h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setUseProfessionalTimeline(false)}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${!useProfessionalTimeline
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                        >
                            Basic
                        </button>
                        <button
                            onClick={() => setUseProfessionalTimeline(true)}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${useProfessionalTimeline
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                        >
                            Professional
                        </button>
                    </div>
                </div>
                {useProfessionalTimeline && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Professional timeline with razor tool, waveform visualization, in/out points, markers, and advanced editing modes.
                    </p>
                )}
            </div>

            {useProfessionalTimeline ? (
                <ProfessionalTimeline
                    duration={videoState.duration || 0}
                    currentTime={videoState.currentTime}
                    isPlaying={videoState.isPlaying}
                    clips={timelineSegments.map(seg => ({
                        ...seg,
                        sourceStartTime: seg.sourceStartTime ?? seg.startTime,
                        sourceEndTime: seg.sourceEndTime ?? seg.endTime,
                        sourceUrl: seg.sourceUrl || videoUrl
                    }))}
                    onTimeUpdate={(time) => {
                        setVideoState((prev: any) => ({ ...prev, currentTime: time }))
                        const videoElement = document.querySelector('.preview-video') as HTMLVideoElement
                        if (videoElement) {
                            videoElement.currentTime = time
                        }
                    }}
                    onPlayPause={() => {
                        setVideoState((prev: any) => {
                            const videoElement = document.querySelector('.preview-video') as HTMLVideoElement
                            if (videoElement) {
                                if (prev.isPlaying) {
                                    videoElement.pause()
                                } else {
                                    videoElement.play().catch(err => console.error('Play error:', err))
                                }
                            }
                            return { ...prev, isPlaying: !prev.isPlaying }
                        })
                    }}
                    onClipUpdate={(clipId, updates) => {
                        setTimelineSegments((prev: any[]) =>
                            prev.map(seg => seg.id === clipId ? { ...seg, ...updates } : seg)
                        )
                        showToast('Clip updated', 'success')
                    }}
                    onClipDelete={(clipId) => {
                        setTimelineSegments((prev: any[]) => prev.filter(seg => seg.id !== clipId))
                        showToast('Clip deleted', 'success')
                    }}
                    onClipAdd={(clip) => {
                        const newClip = {
                            ...clip,
                            id: Date.now().toString(),
                            color: getSegmentColor(clip.type),
                            sourceStartTime: clip.sourceStartTime ?? clip.startTime,
                            sourceEndTime: clip.sourceEndTime ?? clip.endTime,
                            sourceUrl: clip.sourceUrl || videoUrl,
                            type: clip.type === 'image' ? 'video' : clip.type
                        }
                        setTimelineSegments((prev: any[]) => [...prev, newClip])
                        showToast(`Added ${clip.type} clip`, 'success')
                    }}
                    onClipSplit={(clipId, splitTime) => {
                        const clip = timelineSegments.find(c => c.id === clipId)
                        if (!clip) return

                        const clipRelativeTime = splitTime - clip.startTime
                        const newSourceEndTime = clip.sourceStartTime! + clipRelativeTime

                        const secondClip = {
                            ...clip,
                            id: `${clip.id}-split-${Date.now()}`,
                            startTime: splitTime,
                            sourceStartTime: newSourceEndTime,
                            duration: clip.duration - clipRelativeTime,
                            name: `${clip.name} (Split)`
                        }

                        setTimelineSegments((prev: any[]) => {
                            const base = prev.map(c =>
                                c.id === clipId
                                    ? { ...c, endTime: splitTime, duration: clipRelativeTime, sourceEndTime: newSourceEndTime }
                                    : c
                            )
                            return [...base, secondClip]
                        })
                        showToast('Clip split', 'success')
                    }}
                    aiSuggestions={aiSuggestions}
                    showAiPreviews={showAiPreviews}
                    onApplyAiSuggestion={(suggestion) => {
                        if (suggestion.type === 'cut') {
                            const clipToSplit = timelineSegments.find(c => suggestion.time > c.startTime && suggestion.time < c.endTime);
                            if (clipToSplit) {
                                const splitTime = suggestion.time;
                                const clipRelativeTime = splitTime - clipToSplit.startTime;
                                const newSourceEndTime = (clipToSplit.sourceStartTime || 0) + clipRelativeTime;
                                const secondClip = { ...clipToSplit, id: `${clipToSplit.id}-split-${Date.now()}`, startTime: splitTime, sourceStartTime: newSourceEndTime, duration: clipToSplit.duration - clipRelativeTime, name: `${clipToSplit.name} (Split)` };
                                setTimelineSegments((prev: any[]) => prev.map(c => c.id === clipToSplit.id ? { ...c, endTime: splitTime, duration: clipRelativeTime, sourceEndTime: newSourceEndTime } : c).concat(secondClip as any));
                                showToast('AI cut applied', 'success');
                            }
                        } else {
                            showToast(`Applied ${suggestion.type} suggestion`, 'success');
                        }
                    }}
                    videoUrl={videoUrl as string}
                />
            ) : (
                <AdvancedVideoTimeline
                    duration={videoState.duration || 0}
                    currentTime={videoState.currentTime}
                    segments={timelineSegments}
                    keyframes={[]}
                    onTimeUpdate={(time) => {
                        setVideoState((prev: any) => ({ ...prev, currentTime: time }))
                    }}
                    onSegmentUpdate={(segmentId, updates) => {
                        setTimelineSegments((prev: any[]) =>
                            prev.map(seg => seg.id === segmentId ? { ...seg, ...updates } : seg)
                        )
                    }}
                    onSegmentDelete={(segmentId) => {
                        setTimelineSegments((prev: any[]) => prev.filter(seg => seg.id !== segmentId))
                        showToast('Segment deleted', 'success')
                    }}
                    onSegmentAdd={(segment) => {
                        const newSegment = {
                            ...segment,
                            id: Date.now().toString()
                        }
                        setTimelineSegments((prev: any[]) => [...prev, newSegment])
                        showToast(`Added ${segment.type} segment`, 'success')
                    }}
                    onKeyframeAdd={() => { }}
                    onKeyframeUpdate={() => { }}
                    onKeyframeDelete={() => { }}
                />
            )}
        </div>
    )
}
