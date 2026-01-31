'use client'

import React from 'react'
import { Mic, Zap, Loader2, Scissors, Split, Music, Sparkles } from 'lucide-react'

interface AutomateViewProps {
    voiceoverText: string
    setVoiceoverText: (text: string) => void
    selectedVoice: string
    setSelectedVoice: (voice: string) => void
    isGeneratingVoiceover: boolean
    setIsGeneratingVoiceover: (val: boolean) => void
    videoId?: string
    showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export const AutomateView: React.FC<AutomateViewProps> = ({
    voiceoverText,
    setVoiceoverText,
    selectedVoice,
    setSelectedVoice,
    isGeneratingVoiceover,
    setIsGeneratingVoiceover,
    videoId,
    showToast
}) => {
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold mb-1 text-gray-900 dark:text-white flex items-center gap-2">
                    <Mic className="w-5 h-5 text-orange-500" />
                    AI Voiceover Generator
                </h3>
                <p className="text-xs text-gray-500 mb-4 font-medium italic opacity-70">Convert script to professional narration</p>

                <div className="space-y-4">
                    <textarea
                        placeholder="Enter your script here..."
                        className="w-full h-24 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none transition-all"
                        value={voiceoverText}
                        onChange={(e) => setVoiceoverText(e.target.value)}
                    />

                    <div className="grid grid-cols-3 gap-2">
                        {['alloy', 'nova', 'shimmer'].map(voice => (
                            <button
                                key={voice}
                                onClick={() => setSelectedVoice(voice)}
                                className={`py-2 text-[10px] font-bold uppercase rounded-lg border-2 transition-all ${selectedVoice === voice ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600' : 'border-gray-100 dark:border-gray-800 text-gray-400'}`}
                            >
                                {voice}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={async () => {
                            setIsGeneratingVoiceover(true);
                            try {
                                const response = await fetch('/api/audio/voiceover/generate', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ text: voiceoverText, voice: selectedVoice, videoId })
                                });
                                const data = await response.json();
                                if (data.success) {
                                    showToast('Voiceover generated successfully!', 'success');
                                }
                            } catch (err) { showToast('Generation failed', 'error'); }
                            finally { setIsGeneratingVoiceover(false); }
                        }}
                        disabled={!voiceoverText || isGeneratingVoiceover}
                        className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-black shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all flex items-center justify-center gap-2 group"
                    >
                        {isGeneratingVoiceover ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-white" />}
                        {isGeneratingVoiceover ? 'SYNTHESIZING...' : 'GENERATE VOICEOVER'}
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold mb-1 text-gray-900 dark:text-white flex items-center gap-2">
                    <Scissors className="w-5 h-5 text-red-500" />
                    Auto-Jumpcut
                </h3>
                <p className="text-xs text-gray-500 mb-4 italic opacity-70">Automatically remove silent pauses from your speech</p>

                <button
                    onClick={() => {
                        showToast('Analyzing audio for silences...', 'info');
                    }}
                    className="w-full py-3 bg-red-600/10 text-red-600 border border-red-200 dark:border-red-900 hover:bg-red-600 hover:text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                    <Split className="w-4 h-4" />
                    Apply Smart Jumpcuts
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold mb-1 text-gray-900 dark:text-white flex items-center gap-2">
                    <Music className="w-5 h-5 text-indigo-500" />
                    AI Music Composer
                </h3>
                <p className="text-xs text-gray-500 mb-4 italic opacity-70">Generate original mood-matched soundtracks</p>

                <div className="grid grid-cols-2 gap-2 mb-4">
                    {['Cinematic', 'Lo-Fi', 'Upbeat', 'Ambient'].map(mood => (
                        <button
                            key={mood}
                            className="py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-[10px] font-black uppercase hover:border-indigo-500 transition-all"
                        >
                            {mood}
                        </button>
                    ))}
                </div>

                <button
                    onClick={async () => {
                        showToast('Composing original track...', 'info');
                    }}
                    className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-black shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all flex items-center justify-center gap-2"
                >
                    <Sparkles className="w-4 h-4" />
                    GENERATE SOUNDTRACK
                </button>
            </div>
        </div>
    )
}
