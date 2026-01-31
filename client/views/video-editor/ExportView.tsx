'use client'

import React from 'react'
import SocialMediaExporter from '../../components/SocialMediaExporter'

interface ExportViewProps {
    videoId?: string
    videoUrl?: string
    textOverlays: any[]
    videoFilters: any
    showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export const ExportView: React.FC<ExportViewProps> = ({
    videoId,
    videoUrl,
    textOverlays,
    videoFilters,
    showToast
}) => {
    return (
        <div className="space-y-6">
            {videoUrl ? (
                <SocialMediaExporter
                    videoUrl={videoUrl}
                    videoId={videoId}
                    onExport={(preset, options) => {
                        showToast(`Starting export for ${preset.platform}...`, 'info')
                        console.log('Export config:', { preset, options, textOverlays, videoFilters })
                    }}
                />
            ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Please load a video first to access export features.
                </div>
            )}
        </div>
    )
}
