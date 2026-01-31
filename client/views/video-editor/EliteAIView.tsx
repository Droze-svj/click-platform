'use client'

import React from 'react'
import { Cpu, Loader2, MessageSquare, Zap, Scissors } from 'lucide-react'
import { AISuggestion, TimelineSegment } from '../../types/editor'
import { apiPost } from '../../lib/api'

interface EliteAIViewProps {
    videoId?: string
    isTranscribing: boolean
    setIsTranscribing: (val: boolean) => void
    transcript: any
    setTranscript: (val: any) => void
    editingWords: any[]
    setEditingWords: (val: any[]) => void
    aiSuggestions: AISuggestion[]
    setTimelineSegments: (segments: any) => void
    showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export const EliteAIView: React.FC<EliteAIViewProps> = ({
    videoId,
    isTranscribing,
    setIsTranscribing,
    transcript,
    setTranscript,
    editingWords,
    setEditingWords,
    aiSuggestions,
    setTimelineSegments,
    showToast
}) => {
    const handleExtractQuotes = async () => {
        try {
            const data = await apiPost('/ai/extract-quotes', {
                transcript: transcript?.text || ''
            });
            if (data.success) {
                showToast('Viral quotes extracted successfully!', 'success');
            }
        } catch (err) {
            console.error('Quote extraction failed', err);
            showToast('Failed to extract quotes', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Cpu className="w-5 h-5 text-fuchsia-500" />
                            Elite AI Control
                        </h3>
                        <p className="text-[10px] text-gray-500 font-medium">Professional automated mastery</p>
                    </div>
                    <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-800">
                        <div className="px-2 py-1 text-[8px] font-black uppercase text-fuchsia-500">PRO MODE</div>
                    </div>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={async () => {
                            setIsTranscribing(true);
                            try {
                                const data = await apiPost('/transcribe', { videoId });
                                if (data.success) {
                                    setTranscript(data);
                                    setEditingWords(data.words);
                                    showToast('Transcription complete! Ready for semantic editing.', 'success');
                                }
                            } catch (err) {
                                console.error('Transcription failed', err);
                                showToast('Transcription failed', 'error');
                            }
                            finally { setIsTranscribing(false); }
                        }}
                        disabled={isTranscribing}
                        className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-black text-xs tracking-widest hover:scale-102 transition-all flex items-center justify-center gap-3 shadow-xl"
                    >
                        {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin text-fuchsia-500" /> : <MessageSquare className="w-4 h-4" />}
                        {isTranscribing ? 'ANALYZING AUDIO...' : 'TRANSCRIBE & UNLOCK SEMANTIC EDIT'}
                    </button>

                    <div className="flex items-center justify-between bg-fuchsia-500/5 dark:bg-fuchsia-500/10 p-4 rounded-xl border border-fuchsia-500/20">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-fuchsia-500 rounded-lg">
                                <Zap className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-fuchsia-600 dark:text-fuchsia-400 uppercase">Master AI Edit</p>
                                <p className="text-[10px] text-gray-500">Apply all suggestions with variety</p>
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                showToast('Executing Master AI Edit sequence...', 'info');
                                try {
                                    const data = await apiPost('/video/apply-all', {
                                        videoId,
                                        suggestions: aiSuggestions
                                    });
                                    if (data.success) {
                                        setTimelineSegments(data.timeline);
                                        showToast('Sequence applied with 100% variety engine coverage.', 'success');
                                    }
                                } catch (err) {
                                    console.error('Master AI Edit failed', err);
                                    showToast('Failed to apply AI edits', 'error');
                                }
                            }}
                            className="px-4 py-2 bg-fuchsia-500 text-white rounded-lg font-bold text-[10px] hover:bg-fuchsia-600 transition-all shadow-lg shadow-fuchsia-500/20"
                        >
                            EXECUTE
                        </button>
                    </div>
                </div>
            </div>

            {transcript && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-sm font-black mb-4 uppercase tracking-tighter flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-purple-500" />
                        Semantic Script Editor
                    </h3>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="flex flex-wrap gap-1">
                            {editingWords.map((word, idx) => (
                                <span
                                    key={idx}
                                    className="px-1.5 py-0.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-[11px] hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-500/30 transition-all cursor-pointer group relative"
                                    title={`${word.start}s - ${word.end}s`}
                                >
                                    {word.word}
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
