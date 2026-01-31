
import React from 'react'
import { Mic, Zap, Loader2, Scissors, Split, Music, Sparkles } from 'lucide-react'

interface AutomateViewProps {
    voiceoverText: string
    setVoiceoverText: (v: string) => void
    selectedVoice: string
    setSelectedVoice: (v: string) => void
    isGeneratingVoiceover: boolean
    setIsGeneratingVoiceover: (v: boolean) => void
    videoId: string
    showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const AutomateView: React.FC<AutomateViewProps> = ({
    voiceoverText, setVoiceoverText, selectedVoice, setSelectedVoice, isGeneratingVoiceover, setIsGeneratingVoiceover, videoId, showToast
}) => {
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold mb-1 text-gray-900 dark:text-white flex items-center gap-2">
                    <Mic className="w-5 h-5 text-orange-500" />
                    AI Voiceover Generator
                </h3>
                <p className="text-xs text-gray-500 mb-4 italic">Convert script to professional narration</p>

                <div className="space-y-4">
                    <textarea
                        placeholder="Enter your script here..."
                        className="w-full h-24 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none"
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
                        onClick={() => {
                            setIsGeneratingVoiceover(true)
                            setTimeout(() => { setIsGeneratingVoiceover(false); showToast('Voiceover task queued', 'success') }, 1000)
                        }}
                        disabled={!voiceoverText || isGeneratingVoiceover}
                        className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-black shadow-lg flex items-center justify-center gap-2"
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
                <p className="text-xs text-gray-500 mb-4 italic opacity-70">Automatically remove silent pauses</p>
                <button className="w-full py-3 bg-red-600/10 text-red-600 border border-red-200 dark:border-red-900 hover:bg-red-600 hover:text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                    <Split className="w-4 h-4" />
                    Apply Smart Jumpcuts
                </button>
            </div>
        </div>
    )
}

export default AutomateView
