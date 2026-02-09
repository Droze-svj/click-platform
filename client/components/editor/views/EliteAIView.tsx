'use client'

import React, { useState, useEffect } from 'react'
import { Cpu, Zap, Loader2, MessageSquare, Scissors, Sparkles, TrendingUp, Copy, AlertCircle, Type } from 'lucide-react'
import { apiGet, apiPost } from '../../../lib/api'
import { getDefaultTrackForSegmentType } from '../../../types/editor'

interface EliteAIViewProps {
  videoId: string
  isTranscribing: boolean
  setIsTranscribing: (v: boolean) => void
  transcript: any
  setTranscript: (v: any) => void
  editingWords: any[]
  setEditingWords: (v: any[]) => void
  aiSuggestions: any[]
  setTimelineSegments: (v: any) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  setActiveCategory?: (c: any) => void
  setTextOverlays?: (fn: (prev: any[]) => any[]) => void
}

const EliteAIView: React.FC<EliteAIViewProps> = ({
  videoId, isTranscribing, setIsTranscribing, transcript, setTranscript, editingWords, setEditingWords, aiSuggestions, setTimelineSegments, showToast, setActiveCategory, setTextOverlays
}) => {
  const [viralQuotes, setViralQuotes] = useState<any[]>([])
  const [isExtractingQuotes, setIsExtractingQuotes] = useState(false)
  const [requirementsReady, setRequirementsReady] = useState<boolean | null>(null)
  const [requirementsMessage, setRequirementsMessage] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await apiGet<{ success?: boolean; data?: { openaiConfigured?: boolean; message?: string } }>('/video/transcribe-editor/status')
        const data = (res as any)?.data ?? (res as any)
        if (cancelled) return
        setRequirementsReady(!!data?.openaiConfigured)
        setRequirementsMessage(typeof data?.message === 'string' ? data.message : '')
      } catch {
        if (cancelled) return
        setRequirementsReady(false)
        setRequirementsMessage('Could not verify transcription setup. Set OPENAI_API_KEY and use a local upload.')
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  const handleExtractQuotes = async () => {
    if (!transcript) {
      showToast('Please transcribe the video first', 'error')
      return
    }

    try {
      setIsExtractingQuotes(true)
      showToast('Analyzing semantic weight...', 'info')

      // Build full transcript text
      const fullText = editingWords.map(w => w.word).join(' ')

      // Call the backend viral quote extraction
      const data = await apiPost<{ success?: boolean; quotes?: any[] }>('/ai/extract-quotes', { transcript: fullText })

      if (data?.success && data.quotes) {
        setViralQuotes(data.quotes)
        showToast(`${data.quotes.length} viral quotes extracted`, 'success')
      }
    } catch (error) {
      console.error('Quote extraction failed', error)
      showToast('Neural extraction error', 'error')
    } finally {
      setIsExtractingQuotes(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('Copied to clipboard', 'success')
  }

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
            <p className="text-[10px] text-sky-600 dark:text-sky-400 mt-1">AI as assistant: use transcripts to find moments; choose segments by <strong>strategy</strong>, not only viral score. Refine cuts &amp; captions in the timeline.</p>
          </div>
          <div className="px-2 py-1 text-[8px] font-black uppercase text-fuchsia-500 bg-fuchsia-500/10 rounded">PRO MODE</div>
        </div>

        <div className="space-y-4">
          {requirementsReady === false && (
            <div className="flex gap-3 p-4 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Transcription requirements</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{requirementsMessage || 'Set OPENAI_API_KEY in your environment. Use a local upload (not sample/remote).'}</p>
              </div>
            </div>
          )}
          <button
            onClick={async () => {
              if (!videoId) {
                showToast('No video loaded', 'error')
                return
              }
              if (requirementsReady === false) {
                showToast('Transcription unavailable. Check requirements above.', 'error')
                return
              }
              setIsTranscribing(true)
              showToast('Transcribing audio…', 'info')
              try {
                const res = await apiPost<{ success?: boolean; data?: { text: string; words: Array<{ word: string; start: number; end: number }> } }>(
                  '/video/transcribe-editor',
                  { videoId, language: 'en' }
                )
                const data = (res as any)?.data ?? (res as any)
                const words = data?.words ?? []
                const text = data?.text ?? ''
                if (words.length === 0) {
                  showToast('No speech detected or transcript empty', 'info')
                  setTranscript(null)
                  setEditingWords([])
                  return
                }
                setTranscript({ text, words })
                setEditingWords(words)
                showToast(`Transcription complete · ${words.length} words`, 'success')
              } catch (e: any) {
                console.error('Transcribe error', e)
                const code = e?.response?.data?.code
                const msg = e?.response?.data?.error ?? e?.message ?? 'Transcription failed'
                if (code === 'OPENAI_KEY_MISSING') {
                  showToast('Set OPENAI_API_KEY in .env and restart the server', 'error')
                  setRequirementsReady(false)
                  setRequirementsMessage('Add OPENAI_API_KEY to your environment to enable transcription.')
                } else if (code === 'REMOTE_VIDEO') {
                  showToast('Upload your own video; sample/remote videos cannot be transcribed', 'error')
                } else if (code === 'VIDEO_NOT_FOUND' || code === 'FILE_NOT_FOUND') {
                  showToast('Video not found. Upload a video first, then transcribe.', 'error')
                } else {
                  showToast(msg, 'error')
                }
                setTranscript(null)
                setEditingWords([])
              } finally {
                setIsTranscribing(false)
              }
            }}
            disabled={isTranscribing || requirementsReady === false}
            className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-black text-xs tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin text-fuchsia-500" /> : <MessageSquare className="w-4 h-4" />}
            {isTranscribing ? 'ANALYZING AUDIO...' : requirementsReady === false ? 'TRANSCRIBE UNAVAILABLE' : 'TRANSCRIBE & UNLOCK SEMANTIC EDIT'}
          </button>

          <div className="flex items-center justify-between bg-fuchsia-500/5 dark:bg-fuchsia-500/10 p-4 rounded-xl border border-fuchsia-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-fuchsia-500 rounded-lg"><Zap className="w-4 h-4 text-white" /></div>
              <div>
                <p className="text-xs font-black text-fuchsia-600 dark:text-fuchsia-400 uppercase">Master AI Edit</p>
                <p className="text-[10px] text-gray-500">Apply suggestions & go to timeline</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (viralQuotes.length && setTextOverlays) {
                  setTextOverlays((prev: any[]) => [...prev, ...viralQuotes.slice(0, 3).map((q: any) => ({
                    id: `quote-${Date.now()}-${Math.random()}`,
                    text: q.text,
                    x: 50, y: 50, fontSize: 28, color: '#ffffff', fontFamily: 'Inter, sans-serif',
                    startTime: q.start ?? 0, endTime: q.end ?? 5, style: 'shadow'
                  }))])
                  showToast('Top viral quotes added as text overlays', 'success')
                } else if (aiSuggestions?.length) {
                  const segments = aiSuggestions.map((s: any) => ({
                    id: s.id || `ai-${Date.now()}-${Math.random()}`,
                    startTime: s.time ?? 0,
                    endTime: (s.time ?? 0) + 2,
                    duration: 2,
                    type: 'text' as const,
                    name: s.description || 'AI suggestion',
                    color: '#8b5cf6',
                    track: getDefaultTrackForSegmentType('text')
                  }))
                  setTimelineSegments((prev: any[]) => [...prev, ...segments])
                  showToast(`${segments.length} AI suggestions applied to timeline`, 'success')
                } else {
                  showToast('Transcribe & extract quotes first for best results', 'info')
                }
                setActiveCategory?.('timeline')
              }}
              className="px-4 py-2 bg-fuchsia-500 text-white rounded-lg font-bold text-[10px] hover:bg-fuchsia-600 transition-all shadow-lg"
            >
              EXECUTE
            </button>
          </div>
        </div>
      </div>

      {transcript && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-black mb-4 uppercase tracking-tighter flex items-center gap-2">
              <Scissors className="w-4 h-4 text-purple-500" />
              Semantic Script Editor
            </h3>
            <div className="flex flex-wrap gap-1 max-h-[300px] overflow-y-auto">
              {editingWords.map((w, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-[11px] font-bold">{w.word}</span>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-gray-500 dark:text-gray-400">
              Enable &quot;Show captions&quot; in the Properties panel, choose a <strong>text style</strong>, and optionally <strong>Matching emojis</strong> to add contextually relevant emojis for more engagement.
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-500/5 to-pink-500/5 dark:from-orange-500/10 dark:to-pink-500/10 rounded-xl shadow-lg border border-orange-500/20 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tighter flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <TrendingUp className="w-4 h-4" />
                  Viral Quote Extraction
                </h3>
                <p className="text-[10px] text-gray-500 font-medium mt-1">Semantic weight analysis for high-impact moments</p>
              </div>
              <button
                onClick={handleExtractQuotes}
                disabled={isExtractingQuotes}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold text-[10px] hover:bg-orange-600 transition-all shadow-lg flex items-center gap-2"
              >
                {isExtractingQuotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {isExtractingQuotes ? 'ANALYZING...' : 'EXTRACT QUOTES'}
              </button>
            </div>

            {viralQuotes.length > 0 ? (
              <div className="space-y-3">
                {viralQuotes.map((quote, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-orange-500/20 group hover:border-orange-500/40 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="px-2 py-0.5 bg-orange-500 text-white rounded text-[8px] font-black uppercase tracking-widest">
                            Score: {(quote.score * 100).toFixed(0)}%
                          </div>
                          {quote.reason && (
                            <span className="text-[8px] text-gray-500 font-medium italic">{quote.reason}</span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white leading-relaxed">"{quote.text}"</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {setTextOverlays && (
                          <button
                            onClick={() => {
                              setTextOverlays((prev: any[]) => [...prev, {
                                id: `quote-${Date.now()}-${Math.random()}`,
                                text: quote.text,
                                x: 50, y: 50, fontSize: 24, color: '#ffffff', fontFamily: 'Inter, sans-serif',
                                startTime: quote.start ?? 0, endTime: quote.end ?? 5, style: 'shadow'
                              }])
                              showToast('Quote added as text overlay', 'success')
                            }}
                            className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-orange-500 hover:text-white"
                            title="Add as text overlay"
                          >
                            <Type className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => copyToClipboard(quote.text)}
                          className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-orange-500 hover:text-white"
                          title="Copy to clipboard"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs font-medium">Click "Extract Quotes" to analyze viral moments</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default EliteAIView
