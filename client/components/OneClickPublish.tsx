'use client'

import { useState, useEffect } from 'react'
import { m } from 'framer-motion'
import { 
  Send, 
  CheckCircle2, 
  Loader2, 
  X, 
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
import { apiGet, apiPost, handleApiError } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { useDialogBehavior } from './ui/modal'

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
  const [toneModulation, setToneModulation] = useState<'casual' | 'professional'>('casual')
  // Real connection status (was hardcoded "connected" for every platform).
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    apiGet<any>('/oauth/connections')
      .then((res: any) => {
        const accounts = res?.accounts || res?.data?.accounts || {}
        setConnectedIds(new Set(Object.keys(accounts).filter((k) => Array.isArray(accounts[k]) && accounts[k].length > 0)))
      })
      .catch(() => setConnectedIds(new Set()))
  }, [])
  const { showToast } = useToast()
  const { t } = useTranslation()

  const basePlatforms: Platform[] = platforms || [
    { id: 'tiktok', name: 'TikTok', icon: Smartphone, connected: false, color: 'text-pink-500' },
    { id: 'linkedin', name: 'LinkedIn', icon: Globe, connected: false, color: 'text-blue-500' },
    { id: 'twitter', name: 'Twitter/X', icon: MessageSquare, connected: false, color: 'text-slate-400' },
    { id: 'instagram', name: 'Instagram', icon: Target, connected: false, color: 'text-fuchsia-500' },
  ]
  const defaultPlatforms: Platform[] = basePlatforms.map((p) => (platforms ? p : { ...p, connected: connectedIds.has(p.id) }))


  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    )
  }

  const handlePublish = async () => {
    if (selectedPlatforms.length === 0) {
      showToast(t('oneClickPublish.selectAtLeastOne'), 'error')
      return
    }

    setIsPublishing(true)
    const publishedPlatforms: string[] = []
    const failed: { platform: string; reason: string }[] = []
    const nameOf = (id: string) => defaultPlatforms.find((p) => p.id === id)?.name || id

    try {
      for (const platformId of selectedPlatforms) {
        try {
          // The server loads the (owned) content by id; it answers 502 when the
          // platform rejects the post, so only a 2xx counts as published.
          await apiPost('/social/post', {
            platform: platformId,
            contentId,
            options: { tone: toneModulation },
          })

          publishedPlatforms.push(platformId)
        } catch (error) {
          failed.push({ platform: platformId, reason: handleApiError(error) })
        }
      }

      if (publishedPlatforms.length > 0) {
        setPublished(publishedPlatforms)
        showToast(
          t('oneClickPublish.syncComplete', { count: publishedPlatforms.length }),
          'success'
        )
      }
      if (failed.length > 0) {
        const list = failed.map((f) => (f.reason ? `${nameOf(f.platform)} (${f.reason})` : nameOf(f.platform))).join(', ')
        showToast(
          publishedPlatforms.length > 0
            ? t('oneClickPublish.someFailed', { platforms: list })
            : t('oneClickPublish.allFailed', { platforms: list }),
          'error'
        )
      }
    } catch (error) {
      showToast(t('oneClickPublish.engineFailure'), 'error')
    } finally {
      setIsPublishing(false)
    }
  }


  const panelRef = useDialogBehavior(isOpen, () => setIsOpen(false))

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white rounded-2xl hover:scale-105 transition-all shadow-lg shadow-indigo-600/20 font-black uppercase tracking-widest text-[10px]"
      >
        <Send className="w-4 h-4" />
        <span>{t('oneClickPublish.deployContent')}</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" role="dialog" aria-modal="true">
      <m.div ref={panelRef}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`${glassStyle} rounded-[3rem] max-w-2xl w-full p-10 overflow-hidden relative`}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
             <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-400" />
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400">{t('oneClickPublish.phase10Engine')}</span>
             </div>
             <h3 className="text-3xl font-black italic text-[var(--text-main)] uppercase tracking-tighter">
               {t('oneClickPublish.neuralDistribution')}
             </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            title={t('oneClickPublish.closeDistributionWindow')}
            aria-label={t('oneClickPublish.closeDistributionWindow')}
            className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
           {/* Platform Grid */}
           <div className="space-y-4">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                 <Globe className="w-3 h-3" /> {t('oneClickPublish.targetEcosystems')}
              </div>
              <div className="space-y-2">
                {defaultPlatforms.map((platform) => {
                  const isSelected = selectedPlatforms.includes(platform.id)
                  const isPublished = published.includes(platform.id)

                  return (
                    <button
                      type="button"
                      key={platform.id}
                      onClick={() => !isPublished && handlePlatformToggle(platform.id)}
                      disabled={isPublishing || isPublished || !platform.connected}
                      title={isPublished ? t('oneClickPublish.togglePlatformPublished', { name: platform.name }) : t('oneClickPublish.togglePlatform', { name: platform.name })}
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
                    <Sparkles className="w-3 h-3 text-purple-400" /> {t('oneClickPublish.strategicProtocols')}
                 </div>


                 {/* Tone Modulator */}
                 <div className="p-5 rounded-3xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                       <div className="text-[11px] font-black text-white uppercase italic">{t('oneClickPublish.toneModulation')}</div>
                       <div className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">{t(`oneClickPublish.tone_${toneModulation}`)}</div>
                    </div>
                    <div className="flex gap-2">
                       {['casual', 'professional'].map(tone => (
                         <button
                           type="button"
                           key={tone}
                           onClick={() => setToneModulation(tone as any)}
                           className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                             toneModulation === tone ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-white'
                           }`}
                         >
                           {t(`oneClickPublish.tone_${tone}`)}
                         </button>
                       ))}
                    </div>
                 </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
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
                  {isPublishing ? t('oneClickPublish.synchronizingNodes') : t('oneClickPublish.executeDistribution')}
                </span>
              </button>
           </div>
        </div>

      </m.div>
    </div>
  )
}






