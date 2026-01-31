'use client'

import React from 'react'
import AssetLibrary from '../../components/AssetLibrary'

interface AssetLibraryViewProps {
    currentTime: number
    videoDuration: number
    setTimelineSegments: (segments: any) => void
    showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export const AssetLibraryView: React.FC<AssetLibraryViewProps> = ({
    currentTime,
    videoDuration,
    setTimelineSegments,
    showToast
}) => {
    return (
        <div className="h-full flex flex-col overflow-hidden">
            <AssetLibrary
                onSelectAsset={(asset) => {
                    showToast(`${asset.type === 'music' ? 'Music' : asset.type === 'image' ? 'Image' : 'B-Roll'} selected`, 'success')
                }}
                onAddToTimeline={(asset, startTime, trimStart = 0, trimEnd = 0) => {
                    try {
                        const duration = trimEnd > trimStart ? trimEnd - trimStart : (asset.duration || 5)
                        const newClip = {
                            id: `asset-${asset.id}-${Date.now()}`,
                            startTime: Math.max(0, startTime),
                            endTime: Math.max(0, startTime + duration),
                            duration: Math.max(0.1, duration),
                            type: asset.type === 'music' ? 'audio' : asset.type === 'image' ? 'image' : 'video',
                            name: asset.title || asset.name || 'Asset',
                            color: asset.type === 'music' ? '#8B5CF6' : asset.type === 'image' ? '#10B981' : '#3B82F6',
                            track: asset.type === 'music' ? 1 : asset.type === 'image' ? 2 : 0,
                            sourceStartTime: Math.max(0, trimStart),
                            sourceEndTime: Math.max(0, trimEnd > trimStart ? trimEnd : (asset.duration || 5)),
                            sourceUrl: asset.url,
                            properties: {
                                speed: 1,
                                volume: asset.type === 'music' ? 50 : 100
                            }
                        }
                        setTimelineSegments((prev: any[]) => [...prev, newClip])
                        showToast(`${asset.type === 'music' ? 'Music' : asset.type === 'image' ? 'Image' : 'B-Roll'} added to timeline${trimEnd > trimStart ? ' (trimmed)' : ''}`, 'success')
                    } catch (error) {
                        showToast('Failed to add asset to timeline', 'error')
                    }
                }}
                currentTime={currentTime}
                videoDuration={videoDuration}
            />
        </div>
    )
}
