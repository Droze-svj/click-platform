'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu, GitBranch, Layers, FileJson, Fingerprint,
  MousePointer2, Zap, ShieldCheck, Activity, TrendingUp,
  BarChart2, RefreshCw, ArrowRight, Globe, Eye,
  Users, MessageSquare, Star, ChevronDown, ChevronUp,
  Orbit, Brain, AlertTriangle, CheckCircle2, Sparkles, Box
} from 'lucide-react'
import { apiGet, apiPost } from '../lib/api'
import { useToast } from '../contexts/ToastContext'

const glass = 'backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-[2.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.5)]'
const pill = 'px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.3em] border'

// ─── Section Components ────────────────────────────────────────────────────

const SectionHeader = ({ icon: Icon, title, subtitle, color = 'indigo', badge }: any) => {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/10',
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
    amber: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
    rose: 'text-rose-400 border-rose-500/20 bg-rose-500/10',
    purple: 'text-purple-400 border-purple-500/20 bg-purple-500/10'
  }

  return (
    <div className="flex items-start justify-between mb-10">
      <div className="flex items-center gap-5">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">{title}</h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{subtitle}</p>
        </div>
      </div>
      {badge && (
        <span className={`${pill} ${colors[color]}`}>{badge}</span>
      )}
    </div>
  )
}

// ─── A: Omni-Model Router Panel ────────────────────────────────────────────

const OmniModelPanel = () => {
  const [models, setModels] = useState<any[]>([])
  const [routingDemo, setRoutingDemo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    apiGet('/phase8/omni-router/models').then(r => setModels(r?.models || []))
  }, [])

  const runDemoRoute = async () => {
    setLoading(true)
    try {
      const demoScenes = [
        { description: 'Wide establishing shot of the city skyline at golden hour', type: 'broll' },
        { description: 'Talking head interview, creator speaking to camera', type: 'character' },
        { description: 'Voiceover narration explaining the product features', type: 'voice' },
        { description: 'Character using the app, close-up of face and expression', type: 'character' }
      ]
      const result = await apiPost('/phase8/omni-router/route', { scenes: demoScenes })
      setRoutingDemo(result.manifest)
      showToast('Omni-Model routing complete', 'success')
    } catch {
      showToast('Demo routing failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const modelColorMap: Record<string, string> = {
    'runway-gen4': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    'kling-v2': 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    'elevenlabs-v3': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    'sora-v2': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    'sovereign-native': 'text-slate-400 bg-slate-500/10 border-slate-500/20'
  }

  return (
    <div className={`${glass} p-10 space-y-8`}>
      <SectionHeader icon={Cpu} title="Omni-Model Router" subtitle="Solve Model Lock-in // Best Model Per Scene" color="indigo" badge="NEW" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {models.map(model => (
          <div key={model.id} className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border mb-3 text-[9px] font-black uppercase tracking-widest ${modelColorMap[model.id] || 'text-slate-400 bg-slate-500/10 border-slate-500/20'}`}>
              <Cpu className="w-3 h-3" />{model.label}
            </div>
            <p className="text-[10px] text-slate-400 font-bold capitalize mb-3">{model.specialty?.replace(/_/g, ' ')}</p>
            <div className="flex flex-wrap gap-1.5">
              {model.strengths?.slice(0, 3).map((s: string) => (
                <span key={s} className="px-2 py-1 rounded-lg bg-white/5 text-[8px] text-slate-500 font-bold uppercase">{s}</span>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.05]">
              <span className="text-[9px] text-slate-600 font-mono">${model.costPerSegment}/seg</span>
              <span className="text-[9px] text-slate-600 font-mono">{(model.avgLatencyMs / 1000).toFixed(1)}s latency</span>
            </div>
          </div>
        ))}
      </div>

      <button onClick={runDemoRoute} disabled={loading}
        className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-600/20">
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
        Run Demo Routing
      </button>

      <AnimatePresence>
        {routingDemo && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Routing Result</p>
            <div className="grid gap-3">
              {routingDemo.scenes?.map((scene: any, i: number) => (
                <div key={i} className="flex items-center gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-bold truncate">{scene.originalScene?.description?.substring(0, 60)}...</p>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">Scene type: {scene.sceneType}</p>
                  </div>
                  <div className={`${pill} ${modelColorMap[scene.assignedModel] || 'text-slate-400 border-slate-500/20'}`}>
                    {scene.modelLabel}
                  </div>
                  <span className="text-[9px] text-slate-600 font-mono">{(scene.confidence * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <div className="flex gap-6 pt-4 border-t border-white/5">
              <div><p className="text-[8px] text-slate-600 uppercase font-bold">Total Cost</p><p className="text-lg font-black text-white">${routingDemo.totalEstimatedCost?.toFixed(3)}</p></div>
              <div><p className="text-[8px] text-slate-600 uppercase font-bold">Est. Latency</p><p className="text-lg font-black text-white">{(routingDemo.totalEstimatedLatencyMs / 1000).toFixed(0)}s</p></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── B: Spatial Memory Panel ───────────────────────────────────────────────

const SpatialMemoryPanel = () => {
  const [ledger, setLedger] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const buildDemoLedger = async () => {
    setLoading(true)
    try {
      const demoScript = {
        scenes: [
          { id: 'scene_1', description: 'Character sits at desk with coffee cup and laptop. Bright sunlight from window.' },
          { id: 'scene_2', description: 'Wide shot of the room. Same desk visible in background.' },
          { id: 'scene_3', description: 'Close up of character speaking. Laptop screen visible on the right.' },
          { id: 'scene_4', description: 'Different camera angle from the left. Character in same shirt.' }
        ]
      }
      const result = await apiPost('/phase8/spatial/build', { script: demoScript, projectId: `demo_${Date.now()}` })
      setLedger(result.ledger)
      showToast('Spatial Ledger built', 'success')
    } catch {
      showToast('Ledger build failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const riskColor = (score: number) => score < 20 ? 'text-emerald-400' : score < 50 ? 'text-amber-400' : 'text-rose-400'

  return (
    <div className={`${glass} p-10 space-y-8`}>
      <SectionHeader icon={Layers} title="Spatial Memory" subtitle="Narrative Continuity Ledger // Zero Scene Drift" color="purple" badge="2026 FIRST" />

      <div className="p-6 rounded-2xl bg-purple-500/5 border border-purple-500/15">
        <p className="text-xs text-slate-400 leading-relaxed italic">
          <span className="text-purple-400 font-black not-italic">How it works:</span> Every prop, character trait, and lighting condition from Scene 1 is tracked in an invisible Spatial Ledger. Each subsequent scene generation prompt receives a continuity enforcement block &mdash; so the coffee cup doesn&apos;t vanish and the laptop stays consistent across all 4 camera angles.
        </p>
      </div>

      <button onClick={buildDemoLedger} disabled={loading}
        className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-purple-600/20">
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
        Build Demo Ledger
      </button>

      <AnimatePresence>
        {ledger && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                <p className="text-2xl font-black text-white">{ledger.scenes?.length || 0}</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Scenes Tracked</p>
              </div>
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                <p className="text-2xl font-black text-white">{Object.keys(ledger.globalEntities || {}).length}</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Global Entities</p>
              </div>
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                <p className={`text-2xl font-black ${riskColor(ledger.riskScore || 0)}`}>{ledger.riskScore || 0}</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Risk Score</p>
              </div>
            </div>

            {ledger.continuityLog?.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Continuity Enforcements</p>
                {ledger.continuityLog.map((log: any, i: number) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-[10px] text-slate-300 font-bold">{log.message}</p>
                    <span className={`ml-auto ${pill} text-amber-400 border-amber-500/20`}>{log.riskLevel}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── C: AEO Metadata Panel ──────────────────────────────────────────────────

const AEOMetadataPanel = () => {
  const [aeoData, setAeoData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [productName, setProductName] = useState('My SaaS Tool')
  const [productPrice, setProductPrice] = useState('97')
  const [ctaUrl, setCtaUrl] = useState('https://myproduct.com')
  const { showToast } = useToast()

  const buildAEO = async () => {
    setLoading(true)
    try {
      const result = await apiPost('/phase8/aeo/build', {
        videoData: { title: 'Why This Tool Saves 10 Hours Per Week', niche: 'saas', targetPlatform: 'linkedin', language: 'en' },
        productData: { name: productName, pricing: { price: productPrice, currency: 'USD' }, ctaUrl },
        creatorData: { name: 'Sovereign Creator', brandName: 'CLICK Agency' }
      })
      setAeoData(result.preview)
      showToast('AEO Metadata built', 'success')
    } catch {
      showToast('AEO build failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${glass} p-10 space-y-8`}>
      <SectionHeader icon={FileJson} title="AEO Metadata" subtitle="Answer Engine Optimization // AI-Agent Readable" color="emerald" badge="Zero-Click Commerce" />

      <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
        <p className="text-xs text-slate-400 leading-relaxed italic">
          <span className="text-emerald-400 font-black not-italic">The advantage:</span> Every published video embeds Schema.org structured data, entity relationships, and pricing into its C2PA block. When someone asks ChatGPT &quot;what&apos;s the best SaaS tool for this?&quot;, your video is surfaced as a direct answer.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Product Name</label>
          <input id="aeo-product-name" title="Product Name" placeholder="My SaaS Tool" value={productName} onChange={e => setProductName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs font-bold focus:outline-none focus:border-emerald-500/40" />
        </div>
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Price (USD)</label>
          <input id="aeo-product-price" title="Price USD" placeholder="97" value={productPrice} onChange={e => setProductPrice(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs font-bold focus:outline-none focus:border-emerald-500/40" />
        </div>
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">CTA URL</label>
          <input id="aeo-cta-url" title="CTA URL" placeholder="https://myproduct.com" value={ctaUrl} onChange={e => setCtaUrl(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs font-bold focus:outline-none focus:border-emerald-500/40" />
        </div>
      </div>

      <button onClick={buildAEO} disabled={loading}
        className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-600/20">
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
        Build AEO Metadata
      </button>

      <AnimatePresence>
        {aeoData && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2">AI Agent Summary</p>
              <p className="text-sm text-white font-bold italic">&quot;{aeoData.summary}&quot;</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Key Facts (ChatGPT reads these)</p>
                <div className="space-y-2">
                  {aeoData.keyFacts?.map((fact: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-slate-300 font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />{fact}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Targeted Query Hooks</p>
                <div className="space-y-2">
                  {aeoData.queryTargets?.map((q: string, i: number) => (
                    <p key={i} className="text-[10px] text-indigo-300 font-mono italic">&quot;{q}&quot;</p>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── D: UGC Raw Panel ──────────────────────────────────────────────────────

const UGCRawPanel = () => {
  const [profiles, setProfiles] = useState<any[]>([])
  const [selectedProfile, setSelectedProfile] = useState('raw-testimonial')
  const [selectedIntensity, setSelectedIntensity] = useState<'subtle' | 'medium' | 'heavy'>('medium')
  const [demoResult, setDemoResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    apiGet('/phase8/ugc/profiles').then(r => setProfiles(r?.profiles || []))
  }, [])

  const runDemo = async () => {
    setLoading(true)
    try {
      const [humanized, manifest] = await Promise.all([
        apiPost('/phase8/ugc/humanize-audio', {
          script: `I just discovered this product and honestly, it's changed everything. I was spending 3 hours a day on tasks that now take 20 minutes. The interface is clean and it just works.`,
          intensity: selectedIntensity
        }),
        apiPost('/phase8/ugc/degradation-manifest', { profile: selectedProfile, intensity: selectedIntensity })
      ])
      setDemoResult({ humanized: humanized.humanizedScript, manifest: manifest.manifest })
      showToast(`UGC synthesis complete — Authenticity: ${manifest.manifest.authenticityScore}%`, 'success')
    } catch {
      showToast('UGC synthesis failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${glass} p-10 space-y-8`}>
      <SectionHeader icon={Eye} title="UGC Raw Synthesizer" subtitle="Bypass the AI Filter // Authentic at Machine Scale" color="amber" badge="AI FATIGUE FIX" />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">UGC Profile</p>
          <div className="space-y-2">
            {profiles.map(p => (
              <button key={p.id} onClick={() => setSelectedProfile(p.id)}
                className={`w-full text-left p-4 rounded-xl transition-all ${selectedProfile === p.id ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-white/[0.02] border border-white/5 text-slate-400'}`}>
                <p className="text-[11px] font-black uppercase">{p.label}</p>
                <p className="text-[9px] mt-0.5 opacity-70">{p.description}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Humanization Intensity</p>
          <div className="space-y-3">
            {(['subtle', 'medium', 'heavy'] as const).map(level => (
              <button key={level} onClick={() => setSelectedIntensity(level)}
                className={`w-full p-4 rounded-xl text-left transition-all capitalize text-sm font-black ${selectedIntensity === level ? 'bg-amber-600 text-white' : 'bg-white/[0.02] border border-white/5 text-slate-500'}`}>
                {level}
                <span className="text-[9px] block font-normal opacity-70 mt-0.5">
                  {level === 'subtle' ? 'Micro-imperfections only' : level === 'medium' ? 'Balanced natural feel' : 'Maximum authenticity (heavy filler)'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={runDemo} disabled={loading}
        className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-amber-600/20">
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        Synthesize UGC Demo
      </button>

      <AnimatePresence>
        {demoResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/15">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Humanized Voiceover (SSML)</p>
                <span className={`${pill} text-emerald-400 border-emerald-500/20`}>
                  Auth Score: {demoResult.manifest?.authenticityScore}%
                </span>
              </div>
              <p className="text-[10px] text-slate-300 font-mono leading-relaxed break-all">
                {demoResult.humanized?.substring(0, 300)}...
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <p className="text-[8px] text-slate-600 uppercase font-bold">Camera Shake</p>
                <p className="text-lg font-black text-white mt-1">{demoResult.manifest?.video?.shakeAmplitudePx}px</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <p className="text-[8px] text-slate-600 uppercase font-bold">JPEG Quality</p>
                <p className="text-lg font-black text-white mt-1">{demoResult.manifest?.video?.compressionQuality}%</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <p className="text-[8px] text-slate-600 uppercase font-bold">Cut Variance</p>
                <p className="text-lg font-black text-white mt-1">±{demoResult.manifest?.pacing?.variancePercent}%</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── E: Zero-Party Data Panel ──────────────────────────────────────────────

const ZeroPartyDataPanel = () => {
  const [overlayTypes, setOverlayTypes] = useState<any[]>([])
  const [manifest, setManifest] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [platform, setPlatform] = useState('tiktok')
  const { showToast } = useToast()

  useEffect(() => {
    apiGet('/phase8/zpd/overlay-types').then(r => setOverlayTypes(r?.overlayTypes || []))
  }, [])

  const generateManifest = async () => {
    setLoading(true)
    try {
      const result = await apiPost('/phase8/zpd/generate', {
        videoData: { targetPlatform: platform, niche: 'saas', durationSeconds: 60 },
        options: { overlayCount: 2, productData: { name: 'CLICK Platform', ctaUrl: 'https://click.ai', pricing: { price: '97', currency: 'USD' } } }
      })
      setManifest(result.manifest)
      showToast(`Generated ${result.manifest?.overlays?.length} overlays — proj. ${result.manifest?.projectedCaptureRate} capture rate`, 'success')
    } catch {
      showToast('Overlay generation failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const typeColorMap: Record<string, string> = {
    POLL: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5',
    SWIPE_CHOICE: 'text-pink-400 border-pink-500/20 bg-pink-500/5',
    HOTSPOT: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
    RATING: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5',
    QUIZ: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
  }

  return (
    <div className={`${glass} p-10 space-y-8`}>
      <SectionHeader icon={MousePointer2} title="Zero-Party Data Overlays" subtitle="First-Party Signal Engine // Self-Improving Loop" color="rose" badge="Cookies Dead 2026" />

      <div className="flex flex-wrap gap-3">
        {overlayTypes.map(t => (
          <div key={t.id} className={`p-4 rounded-2xl border ${typeColorMap[t.id] || 'text-slate-400 border-white/5'}`}>
            <p className="text-[10px] font-black uppercase">{t.label}</p>
            <p className="text-[9px] opacity-60 mt-0.5 max-w-[160px]">{t.description}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Target Platform</p>
        <div className="flex gap-3 flex-wrap">
          {['tiktok', 'instagram_reels', 'youtube_shorts', 'linkedin'].map(p => (
            <button key={p} onClick={() => setPlatform(p)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${platform === p ? 'bg-rose-600 text-white' : 'bg-white/[0.02] border border-white/5 text-slate-500'}`}>
              {p.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <button onClick={generateManifest} disabled={loading}
        className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-rose-600/20">
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MousePointer2 className="w-4 h-4" />}
        Generate Overlay Manifest
      </button>

      <AnimatePresence>
        {manifest && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">{manifest.overlays?.length} Overlays Generated</p>
              <span className={`${pill} text-emerald-400 border-emerald-500/20`}>Proj. Capture: {manifest.projectedCaptureRate}</span>
            </div>
            {manifest.overlays?.map((overlay: any, i: number) => (
              <div key={i} className={`p-6 rounded-2xl border ${typeColorMap[overlay.type] || 'border-white/5'}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black uppercase">{overlay.type} · {overlay.label}</p>
                  <span className="text-[9px] font-mono text-slate-500">@{overlay.startTimeSeconds?.toFixed(1)}s for {overlay.durationSeconds}s</span>
                </div>
                {overlay.content?.question && (
                  <p className="text-sm text-white font-bold mb-3">&quot;{overlay.content.question}&quot;</p>
                )}
                {overlay.content?.options && (
                  <div className="flex flex-wrap gap-2">
                    {overlay.content.options.map((opt: any) => (
                      <span key={opt.id} className="px-3 py-1 rounded-lg bg-white/5 text-[9px] text-slate-300 font-bold">{opt.text}</span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {overlay.captureConfig?.feedToRevenueOracle && (
                    <span className="text-[8px] text-emerald-400 font-bold uppercase">→ Revenue Oracle Sync</span>
                  )}
                  {overlay.captureConfig?.updateSwarmConsensus && (
                    <span className="text-[8px] text-indigo-400 font-bold uppercase">→ Swarm Consensus Update</span>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Phase 8 Dashboard ────────────────────────────────────────────────

export default function Phase8Dashboard() {
  const SECTIONS = [
    { id: 'omni', label: 'Omni-Model', icon: Cpu },
    { id: 'spatial', label: 'Spatial Memory', icon: Layers },
    { id: 'aeo', label: 'AEO Metadata', icon: Globe },
    { id: 'ugc', label: 'UGC Raw', icon: Eye },
    { id: 'zpd', label: 'Zero-Party Data', icon: MousePointer2 }
  ]

  const [activeSection, setActiveSection] = useState('omni')

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-12 px-8">
      {/* Header */}
      <div className="border-b border-white/[0.05] pb-12">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-emerald-500/10 border border-white/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`${pill} text-indigo-400 border-indigo-500/20`}>Phase 8 — Market Domination</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">Sovereign 2026</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">5 Systems That Make CLICK Undisputable</p>
          </div>
        </div>

        {/* Section Nav */}
        <div className="flex flex-wrap gap-3 pt-6">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all ${activeSection === s.id ? 'bg-white text-black' : 'bg-white/[0.02] border border-white/10 text-slate-400 hover:text-white'}`}>
              <s.icon className="w-3.5 h-3.5" />{s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Section */}
      <AnimatePresence mode="wait">
        <motion.div key={activeSection} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
          {activeSection === 'omni' && <OmniModelPanel />}
          {activeSection === 'spatial' && <SpatialMemoryPanel />}
          {activeSection === 'aeo' && <AEOMetadataPanel />}
          {activeSection === 'ugc' && <UGCRawPanel />}
          {activeSection === 'zpd' && <ZeroPartyDataPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
