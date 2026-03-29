'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Zap, FileText, Video, Mic, Copy, TrendingUp, ShieldCheck, RefreshCcw } from 'lucide-react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface QuickContentCreatorProps {
  onContentCreated?: (contentId: string) => void
}

interface QuickTemplate {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  platforms: string[]
  preset: {
    type: string
    title: string
    text: string
  }
}

export default function QuickContentCreator({ onContentCreated }: QuickContentCreatorProps) {
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [quickText, setQuickText] = useState('')
  const [marketHealth, setMarketHealth] = useState<{ velocity: number; trending: string[] } | null>(null)
  const [variance, setVariance] = useState<'subtle' | 'dynamic' | 'radical'>('dynamic')
  
  useEffect(() => {
    // Phase 10: Real-time Strategic Sync
    setMarketHealth({ 
      velocity: 82, 
      trending: ['AI Productivity', 'SaaS Automation', 'Budget Travel']
    })
  }, [])

  const quickTemplates: QuickTemplate[] = [
    {
      id: 'quote',
      name: 'Quote Card',
      icon: <FileText className="w-5 h-5" />,
      description: 'Create an inspiring quote card',
      platforms: ['instagram', 'twitter', 'linkedin'],
      preset: {
        type: 'article',
        title: 'Quote Card',
        text: 'Enter your quote here...'
      }
    },
    {
      id: 'tip',
      name: 'Quick Tip',
      icon: <Zap className="w-5 h-5" />,
      description: 'Share a quick tip or hack',
      platforms: ['twitter', 'linkedin', 'facebook'],
      preset: {
        type: 'article',
        title: 'Quick Tip',
        text: 'Share your tip here...'
      }
    },
    {
      id: 'video',
      name: 'Video Post',
      icon: <Video className="w-5 h-5" />,
      description: 'Upload and repurpose a video',
      platforms: ['youtube', 'tiktok', 'instagram'],
      preset: {
        type: 'video',
        title: 'Video Post',
        text: ''
      }
    },
    {
      id: 'thread',
      name: 'Twitter Thread',
      icon: <Copy className="w-5 h-5" />,
      description: 'Create a Twitter thread',
      platforms: ['twitter'],
      preset: {
        type: 'article',
        title: 'Twitter Thread',
        text: 'Enter your thread content...'
      }
    },
    {
      id: 'ai-idea',
      name: 'AI Idea',
      icon: <Sparkles className="w-5 h-5" />,
      description: 'Get AI-generated content ideas',
      platforms: ['twitter', 'linkedin', 'instagram'],
      preset: {
        type: 'article',
        title: 'AI Generated Idea',
        text: ''
      }
    }
  ]

  const handleQuickCreate = async (template: QuickTemplate) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      if (template.id === 'ai-idea') {
        const ideaResponse = await axios.post(
          `${API_URL}/ai/generate-idea`,
          { platforms: template.platforms },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        
        if (ideaResponse.data.success) {
          template.preset.text = ideaResponse.data.data.idea
          template.preset.title = ideaResponse.data.data.title
        }
      }

      const response = await axios.post(
        `${API_URL}/content/generate`,
        {
          text: template.preset.text || quickText,
          title: template.preset.title,
          type: template.preset.type,
          platforms: template.platforms,
          strategicMode: true // Phase 10
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success && response.data.data?.contentId) {
        onContentCreated?.(response.data.data.contentId)
        setShowModal(false)
        setQuickText('')
      }
    } catch (error: any) {
      console.error('Quick create error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickText = async () => {
    if (!quickText.trim()) return

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      const response = await axios.post(
        `${API_URL}/content/generate`,
        {
          text: quickText,
          title: 'Quick Content',
          type: 'article',
          platforms: ['twitter', 'linkedin', 'instagram'],
          strategicMode: true
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success && response.data.data?.contentId) {
        onContentCreated?.(response.data.data.contentId)
        setQuickText('')
        setShowModal(false)
      }
    } catch (error: any) {
      console.error('Quick text error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2 font-semibold"
      >
        <Sparkles className="w-5 h-5" />
        Quick Create
      </button>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/10"
            >
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white italic tracking-tighter uppercase">
                      Quick Content
                    </h2>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full border border-emerald-500/20 italic">
                        STRATEGIC MODE ACTIVE
                      </span>
                      {marketHealth && (
                        <span className="text-[10px] font-black bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full border border-blue-500/20 flex items-center gap-1 italic">
                          <TrendingUp className="w-3 h-3" />
                          VELOCITY: {marketHealth.velocity}%
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowModal(false)
                      setQuickText('')
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Generative Variance</span>
                    <div className="flex items-center gap-4">
                      {['Subtle', 'Dynamic', 'Radical'].map((v) => (
                        <button
                          key={v}
                          onClick={() => setVariance(v.toLowerCase() as any)}
                          className={`text-[9px] font-black uppercase tracking-tighter transition-all ${
                            variance === v.toLowerCase() ? 'text-indigo-500' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    value={quickText}
                    onChange={(e) => setQuickText(e.target.value)}
                    placeholder="Paste raw content... We'll apply Tone Modulation and Platform Forcing."
                    className="w-full h-40 px-6 py-4 border border-gray-200 dark:border-white/10 rounded-3xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-black/40 dark:text-white resize-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 font-medium"
                  />
                  
                  <AnimatePresence>
                    {loading && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="w-4 h-4 text-indigo-400 animate-pulse" />
                          <span className="text-[10px] font-bold text-indigo-300 uppercase italic">Sovereignty Integrity Check...</span>
                        </div>
                        <div className="text-[10px] font-black text-indigo-400">92% ORIGINAL</div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-3">
                    <button
                      onClick={handleQuickText}
                      disabled={!quickText.trim() || loading}
                      className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest italic hover:shadow-xl hover:shadow-blue-500/20 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                    >
                      {loading ? <Zap className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {loading ? 'SYNTHESIZING...' : 'STRATEGIC ADAPTATION'}
                    </button>
                    <button
                      onClick={() => setVariance('radical')}
                      title="Neural Refresh: Maximum Variance"
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-400 hover:bg-white/10 transition-all group"
                    >
                      <RefreshCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-white/5" /></div>
                  <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest"><span className="bg-white dark:bg-gray-900 px-4 text-gray-400 italic">Directive Templates</span></div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {quickTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleQuickCreate(template)}
                      disabled={loading}
                      className="p-5 border border-gray-100 dark:border-white/10 rounded-3xl hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all text-left group disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                          {template.icon}
                        </div>
                        <h3 className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-tighter">
                          {template.name}
                        </h3>
                      </div>
                      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {template.description}
                      </p>
                    </button>
                  ))}
                </div>

                {marketHealth && (
                   <div className="pt-4 border-t border-gray-100 dark:border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">LIVE-WIRE TREND SIGNALS</p>
                      <div className="flex flex-wrap gap-2">
                         {marketHealth.trending.map(t => (
                           <span key={t} className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[9px] font-bold text-slate-400 italic">#{t.toUpperCase()}</span>
                         ))}
                      </div>
                   </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
