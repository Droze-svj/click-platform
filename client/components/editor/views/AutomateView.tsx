'use client'

import React from 'react'
import { Mic, Zap, Loader2, Scissors, Split, Type, Sparkles } from 'lucide-react'

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
  voiceoverText,
  setVoiceoverText,
  selectedVoice,
  setSelectedVoice,
  isGeneratingVoiceover,
  setIsGeneratingVoiceover,
  videoId,
  showToast,
}) => {
  return (
    <div className="space-y-8 pb-6">
      {/* Auto Pilot hero */}
      <div className="rounded-2xl border border-violet-200/60 dark:border-violet-800/60 bg-gradient-to-br from-violet-50/80 to-fuchsia-50/60 dark:from-violet-900/20 dark:to-fuchsia-900/20 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-violet-500/20 dark:bg-violet-500/30">
            <Sparkles className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Auto Pilot</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Set it and forget it — AI voiceover, jumpcuts, and more.</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          Run one-click automations to speed up your workflow. Refine results in the Edit or Timeline tab.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-3">
        {/* AI Voiceover */}
        <div className="bg-white dark:bg-gray-800/90 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-orange-300 dark:hover:border-orange-700/50 transition-colors">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700/80">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Mic className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">AI Voiceover</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Convert script to professional narration</p>
          </div>
          <div className="p-5 space-y-4">
            <textarea
              placeholder="Enter your script here..."
              className="w-full h-20 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none transition-shadow"
              value={voiceoverText}
              onChange={(e) => setVoiceoverText(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {['alloy', 'nova', 'shimmer'].map((voice) => (
                <button
                  key={voice}
                  onClick={() => setSelectedVoice(voice)}
                  className={`px-2.5 py-1.5 text-[10px] font-bold uppercase rounded-lg border-2 transition-all ${selectedVoice === voice ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-orange-300 dark:hover:border-orange-700'}`}
                >
                  {voice}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setIsGeneratingVoiceover(true)
                setTimeout(() => {
                  setIsGeneratingVoiceover(false)
                  showToast('Voiceover task queued', 'success')
                }, 1000)
              }}
              disabled={!voiceoverText.trim() || isGeneratingVoiceover}
              className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:pointer-events-none transition-all"
            >
              {isGeneratingVoiceover ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {isGeneratingVoiceover ? 'Synthesizing…' : 'Generate voiceover'}
            </button>
            <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-2">After generating, find your file in <strong>Assets</strong> or add it to the timeline in <strong>Timeline</strong>.</p>
          </div>
        </div>

        {/* Auto-Jumpcut */}
        <div className="bg-white dark:bg-gray-800/90 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-red-300 dark:hover:border-red-700/50 transition-colors">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700/80">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30">
                <Scissors className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Auto-Jumpcut</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Remove silent pauses for tighter pacing</p>
          </div>
          <div className="p-5">
            <button
              className="w-full py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-800 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              onClick={() => showToast('Open the video edit page and run AI Auto Edit with “Remove silence” enabled', 'info')}
            >
              <Split className="w-4 h-4" />
              Apply smart jumpcuts
            </button>
          </div>
        </div>

        {/* Auto-Captions / Edit page CTA */}
        <div className="bg-white dark:bg-gray-800/90 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-blue-300 dark:hover:border-blue-700/50 transition-colors">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700/80">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Type className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Auto-Captions</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Burned-in captions from transcript</p>
          </div>
          <div className="p-5">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Use <strong>AI Auto Edit</strong> on the video edit page with “Add captions” enabled for smart, readable captions.
            </p>
            <a
              href={videoId ? `/dashboard/video/edit/${videoId}` : '/dashboard/video'}
              className="block w-full py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-2 border-blue-200 dark:border-blue-800 rounded-xl font-bold text-center hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              Go to edit page
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AutomateView
