'use client'

import React from 'react'
import VideoEditingTemplates from '../../components/VideoEditingTemplates'
import { VideoFilter, TextOverlay } from '../../types/editor'

interface BasicEditorViewProps {
    videoFilters: VideoFilter
    setVideoFilters: (filters: any) => void
    setColorGradeSettings: (settings: any) => void
    setTextOverlays: (overlays: any) => void
    showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export const BasicEditorView: React.FC<BasicEditorViewProps> = ({
    videoFilters,
    setVideoFilters,
    setColorGradeSettings,
    setTextOverlays,
    showToast
}) => {
    return (
        <div className="space-y-6">
            <VideoEditingTemplates
                onApplyTemplate={(template) => {
                    const colorGrade = template.settings.colorGrade || {}
                    let temperaturePercent = videoFilters.temperature
                    if (colorGrade.temperature !== undefined) {
                        if (colorGrade.temperature > 100) {
                            temperaturePercent = Math.max(0, Math.min(200, ((colorGrade.temperature - 2500) / 6000) * 200))
                        } else {
                            temperaturePercent = colorGrade.temperature
                        }
                    }

                    const updatedFilters = {
                        ...videoFilters,
                        brightness: colorGrade.brightness ?? videoFilters.brightness,
                        contrast: colorGrade.contrast ?? videoFilters.contrast,
                        saturation: colorGrade.saturation ?? videoFilters.saturation,
                        temperature: temperaturePercent,
                        tint: colorGrade.tint ?? videoFilters.tint,
                        highlights: colorGrade.highlights ?? videoFilters.highlights,
                        shadows: colorGrade.shadows ?? videoFilters.shadows,
                        clarity: (colorGrade as any).clarity ?? videoFilters.clarity,
                        dehaze: (colorGrade as any).dehaze ?? videoFilters.dehaze,
                        vignette: template.settings.effects?.vignette ? 30 : (template.settings.effects?.vignette === false ? 0 : videoFilters.vignette),
                        sepia: template.settings.effects?.grain ? 10 : (template.settings.effects?.grain === false ? 0 : videoFilters.sepia),
                        blur: template.settings.effects?.glow ? 2 : (template.settings.effects?.glow === false ? 0 : videoFilters.blur)
                    }

                    setVideoFilters(updatedFilters)
                    setColorGradeSettings(updatedFilters)

                    setTextOverlays(template.textOverlays.map(overlay => ({
                        id: `template-${overlay.id}-${Date.now()}`,
                        text: overlay.text,
                        x: overlay.position.x,
                        y: overlay.position.y,
                        fontSize: overlay.fontSize,
                        color: overlay.color,
                        fontFamily: overlay.fontFamily,
                        startTime: overlay.startTime,
                        endTime: overlay.endTime
                    })))

                    showToast(`"${template.name}" template applied successfully!`, 'success')
                }}
            />
        </div>
    )
}
