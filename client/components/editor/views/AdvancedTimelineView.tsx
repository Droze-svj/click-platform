
import React from 'react'
import { Layers, Zap, Clock } from 'lucide-react'
import { TimelineSegment } from '../../../types/editor'

interface AdvancedTimelineViewProps {
    useProfessionalTimeline: boolean
    setUseProfessionalTimeline: (v: boolean) => void
    videoState: any
    setVideoState: (v: any) => void
    timelineSegments: TimelineSegment[]
    setTimelineSegments: (v: any) => void
    videoUrl: string
    aiSuggestions: any[]
    showAiPreviews: boolean
    showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const AdvancedTimelineView: React.FC<AdvancedTimelineViewProps> = ({
    useProfessionalTimeline, setUseProfessionalTimeline, videoState, setVideoState, timelineSegments, setTimelineSegments, aiSuggestions, showToast
}) => {
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Timeline Orchestration</h3>
                    <div className="flex bg-gray-100 dark:bg-gray-950 p-1 rounded-xl">
                        <button
                            onClick={() => setUseProfessionalTimeline(false)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${!useProfessionalTimeline ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600' : 'text-gray-400'}`}
                        >Basic</button>
                        <button
                            onClick={() => setUseProfessionalTimeline(true)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${useProfessionalTimeline ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600' : 'text-gray-400'}`}
                        >Pro</button>
                    </div>
                </div>
                <p className="text-[10px] text-gray-500 font-medium">Toggle between rapid assembly and precision multi-track orchestration.</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
                <h4 className="text-xs font-black mb-4 uppercase text-gray-400 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    Active Segments ({timelineSegments.length})
                </h4>
                <div className="space-y-2">
                    {timelineSegments.map(s => (
                        <div key={s.id} className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center font-black text-blue-600 text-[10px] uppercase">{s.type[0]}</div>
                                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{s.name}</span>
                            </div>
                            <span className="text-[10px] font-mono text-gray-400">{s.duration.toFixed(2)}s</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default AdvancedTimelineView
