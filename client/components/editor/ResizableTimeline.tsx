
import React from 'react'
import { Layers } from 'lucide-react'
import { TimelineSegment } from '../../types/editor'

interface ResizableTimelineProps {
    duration: number
    currentTime: number
    segments: TimelineSegment[]
    onTimeUpdate: (time: number) => void
}

const ResizableTimeline: React.FC<ResizableTimelineProps> = ({ duration, currentTime, segments, onTimeUpdate }) => {
    const progress = (currentTime / (duration || 1)) * 100

    return (
        <div className="h-full bg-white dark:bg-gray-950 rounded-2xl shadow-inner border border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-500" />
                    <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Master Timeline</span>
                </div>
                <div className="text-[10px] font-mono text-blue-600 font-black">
                    {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
                </div>
            </div>

            <div className="flex-1 relative overflow-x-auto overflow-y-auto custom-scrollbar p-4 space-y-4">
                {/* Playhead Layer */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-20 shadow-[0_0_10px_rgba(59,130,246,0.5)] pointer-events-none" style={{ left: `${progress}%` }} />

                {/* Seek Track */}
                <div
                    className="h-2 w-full bg-gray-100 dark:bg-gray-900 rounded-full relative cursor-pointer group"
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const x = e.clientX - rect.left
                        onTimeUpdate((x / rect.width) * duration)
                    }}
                >
                    <div className="absolute h-full bg-blue-500/20 group-hover:bg-blue-500/40 transition-colors rounded-full" style={{ width: `${progress}%` }} />
                </div>

                {/* Tracks area */}
                <div className="space-y-2">
                    {['Video', 'Audio', 'Graphics'].map(track => (
                        <div key={track} className="h-12 bg-gray-50 dark:bg-gray-900/50 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl flex items-center px-4">
                            <span className="text-[8px] font-black uppercase text-gray-400 w-12">{track}</span>
                            <div className="flex-1 h-8 bg-blue-500/10 rounded-lg border border-blue-500/20 relative" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default ResizableTimeline
