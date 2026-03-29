'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, 
  CheckCircle2, 
  Loader2, 
  X, 
  ShieldAlert, 
  RefreshCw, 
  Zap, 
  Target, 
  BarChart3,
  Globe,
  Smartphone,
  MessageSquare,
  Sparkles,
  ToggleLeft as Toggle
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { apiPost } from '../lib/api'

interface Platform {
  id: string
  name: string
  icon: React.ElementType
  connected: boolean
  color: string
}

interface OneClickPublishProps {
  contentId: string
  platforms?: Platform[]
}

const glassStyle = "backdrop-blur-xl bg-black/80 border border-white/10 shadow-2xl"

export default function OneClickPublish({ contentId, platforms }: OneClickPublishProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [isPublishing, setIsPublishing] = useState(false)
  const [published, setPublished] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [salvageActive, setSalvageActive] = useState(true)
  const [toneModulation, setToneModulation] = useState<'casual' | 'professional'>('casual')
  const [showSalvageAlert, setShowSalvageAlert] = useState(false)
  const { showToast } = useToast()

  const defaultPlatforms: Platform[] = platforms || [
    { id: 'tiktok', name: 'TikTok', icon: Smartphone, connected: true, color: 'text-pink-500' },
    { id: 'linkedin', name: 'LinkedIn', icon: Globe, connected: true, color: 'text-blue-500' },
    { id: 'twitter', name: 'Twitter/X', icon: MessageSquare, connected: true, color: 'text-slate-400' },
    { id: 'instagram', name: 'Instagram', icon: Target, connected: true, color: 'text-fuchsia-500' },
  ]

  // Phase 10: Salvage Protocol Simulation
  useEffect(() => {
    if (published.length > 0 && salvageActive) {
      const timer = setTimeout(() => {
        setShowSalvageAlert(true)
        showToast('Salvage Protocol: Low initial CTR detected on TikTok. Prepare for pivot.', 'warning')
      }, 5000) // Fast simulation
      return () => clearTimeout(timer)
    }
  }, [published, salvageActive, showToast])

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    )
  }

  const handlePublish = async () => {
    if (selectedPlatforms.length === 0) {
      showToast('Please select at least one platform', 'error')
      return
    }

    setIsPublishing(true)
    const publishedPlatforms: string[] = []

    try {
      for (const platformId of selectedPlatforms) {
        try {
          await apiPost('/social/post', {
            platform: platformId,
            contentId,
            tone: toneModulation,
            salvageEnabled: salvageActive
          })

          publishedPlatforms.push(platformId)
        } catch (error) {
          console.error(`Failed to publish to ${platformId}:`, error)
        }
      }

      if (publishedPlatforms.length > 0) {
        setPublished(publishedPlatforms)
        showToast(
          `Neural Distribution Sync Complete: ${publishedPlatforms.length} nodes active.`,
          'success'
        )
      } else {
        showToast('Failed to publish to any platform', 'error')
      }
    } catch (error) {
      showToast('Distribution engine failure', 'error')
    } finally {
      setIsPublishing(false)
    }
  }

  const handleSalvageSwap = () => {
    showToast('A/B Variant B deployed. Headline and Thumbnail swapped.', 'success')
    setShowSalvageAlert(false)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white rounded-2xl hover:scale-105 transition-all shadow-lg shadow-indigo-600/20 font-black uppercase tracking-widest text-[10px]"
      >
        <Send className="w-4 h-4" />
        <span>Deploy Content</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`${glassStyle} rounded-[3rem] max-w-2xl w-full p-10 overflow-hidden relative`}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
             <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-400" />
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400">Phase 10 Engine</span>
             </div>
             <h3 className="text-3xl font-black italic text-white uppercase tracking-tighter">
               Neural Distribution
             </h3>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
           {/* Platform Grid */}
           <div className="space-y-4">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                 <Globe className="w-3 h-3" /> Target Ecosystems
              </div>
              <div className="space-y-2">
                {defaultPlatforms.map((platform) => {
                  const isSelected = selectedPlatforms.includes(platform.id)
                  const isPublished = published.includes(platform.id)

                  return (
                    <button
                      key={platform.id}
                      onClick={() => !isPublished && handlePlatformToggle(platform.id)}
                      disabled={isPublishing || isPublished || !platform.connected}
                      title={`Toggle ${platform.name}${isPublished ? ' (Published)' : ''}`}
                      className={`w-full flex items-center justify-between p-4 rounded-3xl border-2 transition-all group ${
                        isPublished
                          ? 'border-emerald-500/50 bg-emerald-500/10'
                          : isSelected
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-white/5 bg-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <platform.icon className={`w-5 h-5 ${isSelected ? platform.color : 'text-slate-500'}`} />
                        <span className="text-xs font-black italic text-white uppercase">
                          {platform.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPublished ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] text-white">✓</div>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
           </div>

           {/* Strategic Options */}
           <div className="space-y-8">
              <div className="space-y-4">
                 <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-purple-400" /> Strategic Protocols
                 </div>
                 
                 {/* Salvage Toggle */}
                 <div className="p-5 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div className="space-y-1">
                       <div className="text-[11px] font-black text-white uppercase italic">Salvage Protocol</div>
                       <div className="text-[8px] font-bold text-slate-500 uppercase">Auto-Pivot if CTR &lt; 2%</div>
                    </div>
                    <button 
                       onClick={() => setSalvageActive(!salvageActive)}
                       title={salvageActive ? "Deactivate Salvage Protocol" : "Activate Salvage Protocol"}
                       className={`w-12 h-6 rounded-full transition-all relative ${salvageActive ? 'bg-indigo-600' : 'bg-white/10'}`}
                    >
                       <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${salvageActive ? 'left-7' : 'left-1'}`} />
                    </button>
                 </div>

                 {/* Tone Modulator */}
                 <div className="p-5 rounded-3xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                       <div className="text-[11px] font-black text-white uppercase italic">Tone Modulation</div>
                       <div className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">{toneModulation}</div>
                    </div>
                    <div className="flex gap-2">
                       {['casual', 'professional'].map(t => (
                         <button
                           key={t}
                           onClick={() => setToneModulation(t as any)}
                           className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                             toneModulation === t ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-white'
                           }`}
                         >
                           {t}
                         </button>
                       ))}
                    </div>
                 </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handlePublish}
                disabled={isPublishing || selectedPlatforms.length === 0 || published.length > 0}
                className="w-full py-5 bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white rounded-3xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20"
              >
                {isPublishing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <BarChart3 className="w-5 h-5" />
                )}
                <span className="text-xs font-black uppercase tracking-widest italic">
                  {isPublishing ? 'Synchronizing Nodes...' : 'Execute Distribution'}
                </span>
              </button>
           </div>
        </div>

        {/* Salvage Alert Overlay */}
        <AnimatePresence>
           {showSalvageAlert && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="absolute inset-0 bg-indigo-950/80 backdrop-blur-md flex items-center justify-center p-12 z-[101]"
             >
                <div className="flex flex-col items-center text-center space-y-6 max-w-sm">
                   <div className="w-20 h-20 rounded-[2.5rem] bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                      <ShieldAlert className="w-10 h-10 text-rose-500 animate-pulse" />
                   </div>
                   <h4 className="text-2xl font-black italic text-white uppercase">Critical Under-Performance</h4>
                   <p className="text-sm text-slate-300 font-medium">
                      Initial retention data for <span className="text-white font-black italic">TIKTOK</span> is below baseline. Salvage Protocol suggests swapping to <span className="text-indigo-400 font-bold uppercase tracking-widest">Variant B</span> (High Friction Hook).
                   </p>
                   <div className="flex gap-4 w-full">
                      <button 
                        onClick={() => setShowSalvageAlert(false)}
                        className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white"
                      >
                        Ignore
                      </button>
                      <button 
                        onClick={handleSalvageSwap}
                        title="Swap to Variant B"
                        className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20"
                      >
                        Swap Variant B
                      </button>
                   </div>
                </div>
             </motion.div>
           )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}






