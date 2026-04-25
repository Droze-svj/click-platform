'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import axios from 'axios'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Settings, Cpu, Zap, Palette, Bell, EyeOff, Shield, RefreshCw, Layers, 
  ArrowRight, Check, AlertCircle, Terminal, Hexagon, ActivitySquare, 
  Lock, Unlock, Wifi, Globe, Monitor, User, ShieldCheck, ZapOff, 
  ArrowLeft, Sliders, ChevronRight, Fingerprint, Gauge, Sparkles, Brain,
  Network, Database, Target, Activity, X, Plus, Scan, Binary, Anchor,
  Orbit, Wind, Ghost, Signal, ShieldAlert, CpuIcon, ActivityIcon,
  HardDrive, Workflow, ShieldQuestion, UserCheck, Key, Trash2
} from 'lucide-react'
import { extractApiData } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '../../../hooks/useTranslation'
import { supportedLanguages, languageNames, type SupportedLanguage } from '../../../i18n/config'
import ChangePasswordForm from '../../../components/ChangePasswordForm'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'
const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-700'

interface UserSettings {
  notifications: {
    email: boolean; push: boolean; contentReady: boolean; weeklyDigest: boolean;
    achievements?: boolean; mentions?: boolean; comments?: boolean;
    priorityTiers?: 'high_only' | 'high_medium' | 'all';
    digestMode?: 'immediate' | 'daily' | 'weekly';
    digestTime?: string;
  }
  privacy: { dataConsent: boolean; marketingConsent: boolean; analyticsConsent: boolean; }
  preferences: { theme: 'light' | 'dark' | 'auto'; language: string; timezone: string; }
  agentic: {
    autonomousSwarm: boolean; slaAutoFulfill: boolean; predictiveThreshold: number;
    digitalTwinProvider: 'heygen' | 'sora' | 'both';
    heygenApiKey?: string; soraApiKey?: string;
  }
}

export interface BrandKit {
  primaryColor?: string; accentColor?: string; titleFont?: string; bodyFont?: string;
  lowerThirdStyle?: string; lowerThirdPosition?: string; logoPlacement?: string;
  logoOpacity?: number | null; captionStyle?: string; captionPosition?: string;
}

const DEFAULT_BRAND_KIT: BrandKit = {
  primaryColor: '', accentColor: '', titleFont: '', bodyFont: '',
  lowerThirdStyle: '', lowerThirdPosition: '', logoPlacement: '',
  logoOpacity: null, captionStyle: '', captionPosition: '',
}

const FONT_OPTIONS = [
  { value: '', label: 'DEFAULT_LATTICE' },
  { value: 'Inter', label: 'INTER_NEURAL' },
  { value: 'Roboto', label: 'ROBOTO_LOGIC' },
  { value: 'Open Sans', label: 'OPEN_SANS' },
  { value: 'Lato', label: 'LATO_LINEAR' },
  { value: 'Montserrat', label: 'MONTSERRAT_LUXE' },
  { value: 'Poppins', label: 'POPPINS_GEOMETRIC' },
  { value: 'Georgia', label: 'GEORGIA_CLASSIC' },
  { value: 'Playfair Display', label: 'PLAYFAIR_DISPLAY' },
  { value: 'Oswald', label: 'OSWALD_KINETIC' },
  { value: 'Bebas Neue', label: 'BEBAS_NEUE' },
]

function isValidLang(l: string): l is SupportedLanguage {
  return supportedLanguages.includes(l as SupportedLanguage)
}

export default function SovereignCalibrationNodePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { language, setLanguage, t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const tabFromUrl = searchParams.get('tab')
  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      email: true, push: true, contentReady: true, weeklyDigest: false,
      achievements: true, mentions: true, comments: false,
      priorityTiers: 'all', digestMode: 'immediate', digestTime: '09:00',
    },
    privacy: { dataConsent: true, marketingConsent: false, analyticsConsent: true },
    preferences: { theme: 'auto', language: 'en', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    agentic: { autonomousSwarm: true, slaAutoFulfill: true, predictiveThreshold: 85, digitalTwinProvider: 'both' }
  })
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'privacy' | 'security' | 'brand' | 'agentic'>(tabFromUrl === 'brand' ? 'brand' : 'general')
  const [brandKit, setBrandKit] = useState<BrandKit>(DEFAULT_BRAND_KIT)
  const [brandKitLoading, setBrandKitLoading] = useState(false)
  const [brandKitSaving, setBrandKitSaving] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const notificationsSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoadDoneRef = useRef(false)

  const loadMatrixSettings = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) { router.push('/login'); return }
      const response = await axios.get(`${API_URL}/user/settings`, { headers: { Authorization: `Bearer ${token}` } })
      const settingsData = extractApiData<UserSettings>(response)
      if (settingsData) {
        setSettings(settingsData)
        if (settingsData.preferences?.language && isValidLang(settingsData.preferences.language)) {
          setLanguage(settingsData.preferences.language)
        }
      }
    } catch (error: any) {
      if (error.response?.status === 401) router.push('/login')
    } finally { setLoading(false) }
  }, [router, setLanguage])

  const loadIdentityDNA = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    setBrandKitLoading(true)
    try {
      const response = await axios.get(`${API_URL}/pro-mode/brand-kit`, { headers: { Authorization: `Bearer ${token}` } })
      const data = extractApiData<BrandKit>(response)
      if (data && typeof data === 'object') setBrandKit({ ...DEFAULT_BRAND_KIT, ...data })
    } catch (e) {
      if ((e as any)?.response?.status === 401) router.push('/login')
    } finally { setBrandKitLoading(false) }
  }, [router])

  useEffect(() => { loadMatrixSettings().then(() => { initialLoadDoneRef.current = true }) }, [loadMatrixSettings])
  useEffect(() => { if (tabFromUrl === 'brand') setActiveTab('brand') }, [tabFromUrl])
  useEffect(() => { if (activeTab === 'brand') loadIdentityDNA() }, [activeTab, loadIdentityDNA])

  const commitMatrixChange = async (options?: { skipToast?: boolean }) => {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      await axios.put(`${API_URL}/user/settings`, settings, { headers: { Authorization: `Bearer ${token}` } })
      if (!options?.skipToast) {
         window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'CALIBRATION_LOCKED: SYSTEM_SYNC_COMPLETE', type: 'success' } }))
      }
    } catch (error: any) {
      if (!options?.skipToast) {
         window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'CALIBRATION_ERR: UPLINK_DIFFRACTION', type: 'error' } }))
      }
      throw error
    } finally { setSaving(false) }
  }

  const tuneParameter = (path: string, value: any) => {
    const keys = path.split('.')
    setSettings(prev => {
      const newSettings = { ...prev }
      let current: any = newSettings
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {}
        current = current[keys[i]]
      }
      current[keys[keys.length - 1]] = value
      return newSettings
    })
    
    if (path.startsWith('notifications.') && initialLoadDoneRef.current && activeTab === 'notifications') {
      if (notificationsSaveTimeoutRef.current) clearTimeout(notificationsSaveTimeoutRef.current)
      notificationsSaveTimeoutRef.current = setTimeout(() => {
        notificationsSaveTimeoutRef.current = null
        setAutoSaveStatus('saving')
        commitMatrixChange({ skipToast: true })
          .then(() => {
            setAutoSaveStatus('saved')
            window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'SIGNAL_PROTOCOL_UPDATED', type: 'success' } }))
            setTimeout(() => setAutoSaveStatus('idle'), 2000)
          })
          .catch(() => { setAutoSaveStatus('error'); setTimeout(() => setAutoSaveStatus('idle'), 3000) })
      }, 600)
    }
  }

  const updateBrandKitField = (field: keyof BrandKit, value: any) => {
    setBrandKit(prev => ({ ...prev, [field]: value }))
  }

  const manifestIdentityDNA = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    setBrandKitSaving(true)
    try {
      await axios.put(`${API_URL}/pro-mode/brand-kit`, brandKit, { headers: { Authorization: `Bearer ${token}` } })
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'NEURAL_IDENTITY_MANIFESTED', type: 'success' } }))
    } catch (e) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'IDENTITY_TRANSITION_FAILED', type: 'error' } }))
    } finally { setBrandKitSaving(false) }
  }

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
        <Fingerprint size={80} className="text-indigo-500 animate-pulse mb-12 drop-shadow-[0_0_40px_rgba(99,102,241,0.5)]" />
        <span className="text-[16px] font-black text-slate-800 uppercase tracking-[1em] animate-pulse italic">Deciphering Matrix Topology...</span>
     </div>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1850px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Settings size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Calibration Header */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
           <div className="flex items-center gap-10">
              <button onClick={() => router.push('/dashboard')} title="Abort"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <ArrowLeft size={36} />
              </button>
              <div className="w-24 h-24 bg-indigo-500/5 border border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Settings size={48} className="text-indigo-400 relative z-10 group-hover:rotate-180 transition-transform duration-1000 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Fingerprint size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Calibration Node v16.4.2</span>
                   </div>
                   <div className="flex items-center gap-4 px-6 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                       <Activity size={12} className="text-emerald-400 animate-pulse" />
                       <span className="text-[10px] font-black text-emerald-400 tracking-widest uppercase italic leading-none">SOVEREIGN_LATTICE_SYNC:ACTIVE</span>
                   </div>
                 </div>
                 <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Calibration</h1>
                 <p className="text-slate-800 text-[16px] uppercase font-black tracking-[0.5em] italic leading-none">Calibrating autonomous OS parameters, neural identity DNA, and resonance signal routing.</p>
              </div>
           </div>

           <Link href="/dashboard/settings/profile" className="group flex items-center gap-10 p-6 pr-16 rounded-[4.5rem] bg-indigo-500/5 border-2 border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-1000 shadow-[0_60px_150px_rgba(0,0,0,0.8)] bg-black/40">
              <div className="w-24 h-24 rounded-[3.5rem] bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-700 flex items-center justify-center font-black text-5xl border-8 border-black/40 group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000 shadow-2xl text-white italic">
                {user?.name?.[0] || 'U'}
              </div>
              <div className="text-left">
                <p className="text-[24px] font-black uppercase tracking-[0.2em] text-white italic leading-none mb-4 group-hover:text-indigo-400 transition-colors">{user?.name || 'Sovereign_Node'}</p>
                <div className="flex items-center gap-4 px-6 py-2 rounded-full bg-black/60 border-2 border-white/5">
                   <ShieldCheck size={16} className="text-indigo-400" />
                   <span className="text-[11px] font-black text-slate-800 uppercase tracking-[0.4em] italic leading-none">CORE_IDENTITY_DNA_LOCKED</span>
                </div>
              </div>
           </Link>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-4 gap-20 relative z-10">
           {/* Navigation Matrix */}
           <aside className="lg:col-span-1 space-y-16">
              <nav className={`${glassStyle} p-12 rounded-[6rem] space-y-8 border-white/5 shadow-[inset_0_0_100px_rgba(0,0,0,0.6)] bg-black/40`}>
                {[
                  { id: 'general', label: 'Neural_Core', icon: <CpuIcon size={32} />, desc: 'System fundamentals' },
                  { id: 'agentic', label: 'Heuristic_Matrix', icon: <Zap size={32} />, desc: 'Swarm & consensus' },
                  { id: 'brand', label: 'Identity_DNA', icon: <Palette size={32} />, desc: 'Synthetic style' },
                  { id: 'notifications', label: 'Resonance_Routing', icon: <Bell size={32} />, desc: 'Signal protocols' },
                  { id: 'privacy', label: 'Logic_Sovereignty', icon: <EyeOff size={32} />, desc: 'Privacy & consent' },
                  { id: 'security', label: 'Shielding_Protocols', icon: <Shield size={32} />, desc: 'Access & integrity' },
                ].map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full group flex items-center justify-between p-10 rounded-[3.5rem] transition-all duration-1000 italic font-black relative overflow-hidden ${
                      activeTab === tab.id ? 'bg-white text-black scale-105 shadow-[0_40px_100px_rgba(255,255,255,0.1)]' : 'hover:bg-white/[0.04] text-slate-800 hover:text-white border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-8 relative z-10 text-left">
                      <div className={`w-20 h-20 rounded-[2rem] border-2 flex items-center justify-center transition-all duration-1000 ${
                        activeTab === tab.id ? 'bg-black text-white border-black rotate-12 scale-110' : 'bg-black/60 border-white/10 text-slate-900 group-hover:text-indigo-400 group-hover:rotate-12 group-hover:bg-white/5 shadow-inner'
                      }`}>
                        {tab.icon}
                      </div>
                      <div className="space-y-1">
                        <span className="text-[18px] font-black uppercase tracking-[0.2em] leading-none block">{tab.label}</span>
                        <p className={`text-[11px] font-black uppercase tracking-[0.2em] italic leading-none ${activeTab === tab.id ? 'text-black/40' : 'text-slate-950 group-hover:text-slate-500'}`}>{tab.desc}</p>
                      </div>
                    </div>
                    {activeTab === tab.id && <ChevronRight size={36} className="text-black relative z-10" />}
                  </button>
                ))}
              </nav>

              <div className="p-20 rounded-[6rem] bg-gradient-to-br from-indigo-900 via-indigo-950 to-black shadow-[0_100px_300px_rgba(0,0,0,1)] relative overflow-hidden group border-2 border-white/10">
                 <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
                 <Workflow size={300} className="absolute -bottom-20 -right-20 text-white/[0.03] group-hover:rotate-45 group-hover:scale-150 transition-all duration-1000" />
                 <h4 className="text-4xl font-black text-white uppercase italic mb-8 relative z-10 leading-none tracking-tighter">Sovereign_OS</h4>
                 <p className="text-[14px] text-white/50 font-black uppercase tracking-[0.5em] italic mb-20 relative z-10 leading-relaxed">
                   Scale your agency to infinite horizons with our autonomous hive suite and neural manifest engines.
                 </p>
                 <button className="w-full py-10 rounded-[3rem] bg-white text-black font-black uppercase text-[15px] tracking-[0.6em] transition-all duration-1000 hover:bg-indigo-500 hover:text-white relative z-10 shadow-[0_40px_100px_rgba(0,0,0,0.6)] italic active:scale-90 group/btn border-none">
                    <div className="flex items-center justify-center gap-6">
                       UPGRADE_CAPACITY <ArrowRight size={24} className="group-hover/btn:translate-x-6 transition-transform" />
                    </div>
                 </button>
              </div>
           </aside>

           {/* Calibration Terminal Main */}
           <section className="lg:col-span-3 space-y-16">
              <div className={`${glassStyle} rounded-[7rem] p-32 border-white/5 relative overflow-hidden min-h-[1100px] flex flex-col justify-between shadow-[inset_0_0_200px_rgba(0,0,0,1)] bg-black/40`}>
                 <div className="absolute top-0 right-0 p-48 opacity-[0.015] pointer-events-none group-hover:rotate-12 transition-transform duration-1000"><Database size={800} className="text-white" /></div>
                 
                 <AnimatePresence mode="wait">
                    <motion.div key={activeTab} initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      className="space-y-32 relative z-10"
                    >
                      {activeTab === 'general' && (
                        <div className="space-y-32">
                          <header className="space-y-10">
                            <div className="flex items-center gap-12">
                               <div className="w-24 h-24 rounded-[3.5rem] bg-indigo-500/5 border-2 border-indigo-500/20 flex items-center justify-center shadow-[0_40px_100px_rgba(99,102,241,0.2)] animate-pulse"><CpuIcon className="text-indigo-400" size={56} /></div>
                               <div>
                                  <h2 className="text-8xl font-black uppercase tracking-tighter italic text-white leading-none mb-4">Neural Core</h2>
                                  <p className="text-slate-800 font-black uppercase tracking-[1em] text-[15px] italic leading-none underline decoration-indigo-500/30">Global OS fundamentals and spectral localization</p>
                                </div>
                            </div>
                          </header>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-32 pt-20">
                            <ConfigGroup title="Lattice Spectrum">
                              <DropdownControl label="Visual Chroma" description="Deep visual style of the Sovereign Command terminal" 
                                value={settings.preferences.theme}
                                options={[{id: 'light', label:'PRISTINE_LIGHT_V1'}, {id:'dark', label:'SOVEREIGN_DEPTH_V4'}, {id:'auto', label:'OS_LATTICE_SYNC'}]}
                                onChange={(v) => tuneParameter('preferences.theme', v)}
                              />
                            </ConfigGroup>
                            <ConfigGroup title="Neural Localization">
                               <DropdownControl label="Linguistic Resonance" description="Primary communication protocol for neural interfaces" 
                                value={settings.preferences.language}
                                options={supportedLanguages.map(l => ({id: l, label: languageNames[l].toUpperCase()}))}
                                onChange={(v) => { if (isValidLang(v)) { setLanguage(v); tuneParameter('preferences.language', v); } }}
                              />
                            </ConfigGroup>
                          </div>
                        </div>
                      )}

                      {activeTab === 'agentic' && (
                        <div className="space-y-32">
                          <header className="space-y-10">
                            <div className="flex items-center gap-12">
                               <div className="w-24 h-24 rounded-[3.5rem] bg-amber-500/5 border-2 border-amber-500/20 flex items-center justify-center shadow-[0_40px_100px_rgba(245,158,11,0.2)] animate-pulse"><Zap className="text-amber-400" size={56} /></div>
                               <div>
                                  <h2 className="text-8xl font-black uppercase tracking-tighter italic text-white leading-none mb-4">Heuristic Matrix</h2>
                                  <p className="text-slate-800 font-black uppercase tracking-[1em] text-[15px] italic leading-none">Autonomous swarm and synthetic avatar orchestration</p>
                               </div>
                            </div>
                          </header>
                          
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-32 pt-16">
                            <div className="space-y-32">
                              <ConfigGroup title="Hive Collective Control">
                                <ToggleControl label="Consensus Logic Swarm" description="Multi-agent recursive logic for zero-hallucination mission-critical QA" 
                                  value={settings.agentic.autonomousSwarm} onChange={(v) => tuneParameter('agentic.autonomousSwarm', v)} />
                                <ToggleControl label="Mission Auto-Manifest" description="Autonomous content manifest targets for lattice saturation protocols" 
                                  value={settings.agentic.slaAutoFulfill} onChange={(v) => tuneParameter('agentic.slaAutoFulfill', v)} />
                              </ConfigGroup>

                              <ConfigGroup title="Logic Consensus Threshold">
                                <div className="p-20 rounded-[6rem] bg-indigo-500/[0.04] border-2 border-indigo-500/20 space-y-20 shadow-[inset_0_0_100px_rgba(0,0,0,0.6)]">
                                  <div className="flex justify-between items-center px-6">
                                     <div className="space-y-4 text-left">
                                        <p className="text-[20px] font-black uppercase tracking-[0.5em] text-white italic leading-none">Heuristic Consensus Seed</p>
                                        <p className="text-[14px] font-black text-slate-800 uppercase tracking-[0.4em] italic leading-tight max-w-sm">Minimum confidence threshold for autonomous deployment protocols_v14</p>
                                     </div>
                                     <span className="text-8xl font-black text-indigo-400 italic tabular-nums tracking-tighter leading-none drop-shadow-[0_0_30px_rgba(99,102,241,0.5)]">{settings.agentic.predictiveThreshold}%</span>
                                  </div>
                                  <div className="px-6 pb-4">
                                     <input type="range" min="0" max="100" value={settings.agentic.predictiveThreshold} title="Heuristic Seed" aria-label="Heuristic Seed" 
                                       onChange={(e) => tuneParameter('agentic.predictiveThreshold', parseInt(e.target.value))}
                                       className="w-full h-6 bg-black/60 rounded-full appearance-none cursor-pointer accent-white focus:outline-none border-2 border-white/5 shadow-inner"
                                     />
                                  </div>
                                  <div className="flex justify-between text-[13px] font-black text-slate-900 uppercase tracking-[1em] italic leading-none px-10">
                                     <span>FAST_EVOLUTION</span>
                                     <span>PEAK_INTEGRITY</span>
                                  </div>
                                </div>
                              </ConfigGroup>
                            </div>

                            <div className="space-y-32">
                              <ConfigGroup title="Synthetic Avatars // Pulse Engines">
                                <div className={`${glassStyle} p-20 rounded-[6rem] space-y-20 border-violet-500/30 shadow-[inset_0_0_100px_rgba(139,92,246,0.1)] bg-violet-600/5`}>
                                  <DropdownControl label="Neural Render Seed" description="Preferred engine for high-fidelity avatar generation" 
                                    value={settings.agentic.digitalTwinProvider}
                                    options={[{id: 'heygen', label:'HEYGEN_RENDER_ULTRA'}, {id:'sora', label:'SORA_CORE_KINETIC_V2'}, {id:'both', label:'HYBRID_SWARM_RENDER'}]}
                                    onChange={(v) => tuneParameter('agentic.digitalTwinProvider', v)}
                                  />
                                  <div className="space-y-16">
                                     <InputControl label="HeyGen Uplink Cipher" type="password" placeholder="X-API-KEY-CIPHER-XXXX" value={settings.agentic.heygenApiKey || ''}
                                      onChange={(v) => tuneParameter('agentic.heygenApiKey', v)} />
                                     <InputControl label="Sora Core Signature" type="password" placeholder="SORA-AUTH-SIGNATURE-XXXX" value={settings.agentic.soraApiKey || ''}
                                      onChange={(v) => tuneParameter('agentic.soraApiKey', v)} />
                                  </div>
                                </div>
                              </ConfigGroup>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'brand' && (
                        <div className="space-y-32">
                          <header className="space-y-10">
                             <div className="flex items-center gap-12">
                                <div className="w-24 h-24 rounded-[3.5rem] bg-fuchsia-500/5 border-2 border-fuchsia-500/20 flex items-center justify-center shadow-[0_40px_100px_rgba(217,70,239,0.2)] animate-pulse"><Palette className="text-fuchsia-400" size={56} /></div>
                                <div>
                                   <h2 className="text-8xl font-black uppercase tracking-tighter italic text-white leading-none mb-4">Identity DNA</h2>
                                   <p className="text-slate-800 font-black uppercase tracking-[1em] text-[15px] italic leading-none">Synthetic DNA constraints for autonomous AI payloads</p>
                                </div>
                             </div>
                          </header>

                          {brandKitLoading ? (
                            <div className="flex flex-col items-center justify-center py-96 bg-black/60 rounded-[8rem] border-2 border-white/5 shadow-inner">
                              <RefreshCw className="w-32 h-32 text-indigo-500 animate-spin mb-12 shadow-[0_0_60px_rgba(99,102,241,0.5)]" />
                              <p className="text-[18px] font-black text-slate-800 uppercase tracking-[1em] animate-pulse italic">Deciphering DNA Matrix Spectrum...</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-32 pt-20">
                               <ConfigGroup title="Chroma DNA Topology">
                                  <div className="flex gap-20">
                                     <div className="flex flex-col gap-10 flex-1">
                                        <label className="text-[16px] font-black uppercase text-slate-800 tracking-[0.8em] italic pl-10 text-left mb-2">Primary_Hex</label>
                                        <div className="flex items-center gap-12 p-10 bg-black/60 border-2 border-white/5 rounded-[4.5rem] shadow-inner font-black group/color transition-all duration-1000 hover:border-white/20">
                                           <input type="color" value={brandKit.primaryColor || '#6366f1'} title="Primary Color" aria-label="Primary Color" onChange={(e) => updateBrandKitField('primaryColor', e.target.value)} className="w-24 h-24 rounded-[2rem] border-none bg-transparent cursor-pointer shadow-3xl group-hover/color:rotate-12 group-hover:scale-110 transition-transform duration-1000 p-0" />
                                           <input type="text" value={brandKit.primaryColor || ''} title="Primary Hex" aria-label="Primary Hex" onChange={(e) => updateBrandKitField('primaryColor', e.target.value)} className="bg-transparent border-none text-4xl font-black font-mono text-white focus:outline-none w-full italic tracking-tighter" placeholder="#FF00FF" />
                                        </div>
                                     </div>
                                     <div className="flex flex-col gap-10 flex-1">
                                        <label className="text-[16px] font-black uppercase text-slate-800 tracking-[0.8em] italic pl-10 text-left mb-2">Accent_Hex</label>
                                        <div className="flex items-center gap-12 p-10 bg-black/60 border-2 border-white/5 rounded-[4.5rem] shadow-inner font-black group/color transition-all duration-1000 hover:border-white/20">
                                           <input type="color" value={brandKit.accentColor || '#8b5cf6'} title="Accent Color" aria-label="Accent Color" onChange={(e) => updateBrandKitField('accentColor', e.target.value)} className="w-24 h-24 rounded-[2rem] border-none bg-transparent cursor-pointer shadow-3xl group-hover/color:rotate-12 group-hover:scale-110 transition-transform duration-1000 p-0" />
                                           <input type="text" value={brandKit.accentColor || ''} title="Accent Hex" aria-label="Accent Hex" onChange={(e) => updateBrandKitField('accentColor', e.target.value)} className="bg-transparent border-none text-4xl font-black font-mono text-white focus:outline-none w-full italic tracking-tighter" placeholder="#AA00FF" />
                                        </div>
                                     </div>
                                  </div>
                               </ConfigGroup>

                               <ConfigGroup title="Lattice Glyph Architecture">
                                  <div className="space-y-16">
                                     <DropdownControl label="Headline Lattice" description="Typography for core titles and logic anchors" 
                                      value={brandKit.titleFont || ''} options={FONT_OPTIONS.map(o => ({id: o.value, label: o.label}))}
                                      onChange={(v) => updateBrandKitField('titleFont', v)} />
                                     <DropdownControl label="Meta Logic Font" description="Primary interface and linguistic rendering substrate" 
                                      value={brandKit.bodyFont || ''} options={FONT_OPTIONS.map(o => ({id: o.value, label: o.label}))}
                                      onChange={(v) => updateBrandKitField('bodyFont', v)} />
                                  </div>
                                </ConfigGroup>

                               <ConfigGroup title="Manifest Payload Overlays" fullWidth>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-24 p-24 rounded-[7rem] bg-black/60 border-2 border-white/5 shadow-inner">
                                     <DropdownControl label="Logic Manifest Style" description="Visual style of rendered text payloads" 
                                       value={brandKit.lowerThirdStyle || ''} options={[{id:'', label:'NULL_SECTOR'}, {id:'bar', label:'CORE_STREAM_BAR'}, {id:'pill', label:'DYNAMIC_FLEX_PILL'}, {id:'minimal', label:'CLEAN_LATTICE'}]}
                                       onChange={(v) => updateBrandKitField('lowerThirdStyle', v)} />
                                     <DropdownControl label="Identifier Quadrant" description="Lattice coordinate for core IDENTITY anchor" 
                                       value={brandKit.logoPlacement || ''} options={[{id:'', label:'IDENTIFIER_HIDDEN'}, {id:'top-left', label:'ALPHA_QUADRANT'}, {id:'top-right', label:'BETA_QUADRANT'}, {id:'bottom-right', label:'OMEGA_QUADRANT'}]}
                                       onChange={(v) => updateBrandKitField('logoPlacement', v)} />
                                     <div className="flex flex-col gap-12 justify-center px-6">
                                        <label className="text-[20px] font-black uppercase tracking-[0.5em] text-white italic leading-none pl-6 text-left">Identifier Saturation</label>
                                        <div className="flex items-center gap-10">
                                           <input type="range" min="0" max="100" value={brandKit.logoOpacity || 100} title="Saturation" aria-label="Saturation" onChange={(e) => updateBrandKitField('logoOpacity', parseInt(e.target.value))} className="flex-1 h-6 bg-black/80 rounded-full appearance-none cursor-pointer accent-white border-2 border-white/5 shadow-inner" />
                                           <span className="text-5xl font-black font-mono text-indigo-400 italic w-32 text-right tabular-nums">{brandKit.logoOpacity || 100}%</span>
                                        </div>
                                     </div>
                                  </div>
                               </ConfigGroup>

                               <div className="col-span-full flex justify-end pt-20">
                                  <button onClick={manifestIdentityDNA} disabled={brandKitSaving}
                                    className="px-32 py-12 rounded-[5rem] bg-indigo-600 text-white font-black uppercase text-[20px] tracking-[1em] hover:bg-white hover:text-indigo-600 transition-all duration-1000 shadow-[0_60px_150px_rgba(99,102,241,0.2)] disabled:opacity-50 italic flex items-center gap-12 active:scale-90 group relative overflow-hidden border-none"
                                  >
                                    <div className="absolute inset-x-0 bottom-0 h-2 bg-white/20 animate-shimmer" />
                                    <div className="relative z-10 flex items-center gap-12">
                                      {brandKitSaving ? <RefreshCw className="animate-spin" size={40} /> : <Scan size={40} className="group-hover:rotate-180 transition-transform duration-1000" />}
                                      {brandKitSaving ? 'SYNTHESIZING...' : 'MANIFEST_IDENTITY_DNA'}
                                    </div>
                                  </button>
                               </div>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'notifications' && (
                        <div className="space-y-32">
                          <header className="space-y-10">
                             <div className="flex items-center gap-12">
                                <div className="w-24 h-24 rounded-[3.5rem] bg-rose-500/5 border-2 border-rose-500/20 flex items-center justify-center shadow-[0_40px_100px_rgba(244,63,94,0.2)] animate-pulse"><Bell className="text-rose-400" size={56} /></div>
                                <div>
                                   <h2 className="text-8xl font-black uppercase tracking-tighter italic text-white leading-none mb-4">Resonance Routing</h2>
                                   <p className="text-slate-800 font-black uppercase tracking-[1em] text-[15px] italic leading-none underline decoration-rose-500/30">Signal protocols and urgency thresholds</p>
                                </div>
                             </div>
                          </header>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-32 pt-20">
                             <ConfigGroup title="Neural Frequency Channels">
                                <ToggleControl label="Neural Uplink (E-Mail)" description="Weekly logic sequence reports and autonomous mission summaries" 
                                  value={settings.notifications.email} onChange={(v) => tuneParameter('notifications.email', v)} />
                                <ToggleControl label="HUD Visual Sync (Push)" description="Real-time mission status alerts and nodal breakthrough pings" 
                                  value={settings.notifications.push} onChange={(v) => tuneParameter('notifications.push', v)} />
                             </ConfigGroup>
                             <ConfigGroup title="Heuristic Signal Triggers">
                                <ToggleControl label="Payload Deciphered" description="Signal when new autonomous content nodes are manifested" 
                                  value={settings.notifications.contentReady} onChange={(v) => tuneParameter('notifications.contentReady', v)} />
                                <ToggleControl label="Market Pulse Resonance" description="Heuristic market shifts detected from the Sovereign Matrix" 
                                  value={settings.notifications.mentions ?? true} onChange={(v) => tuneParameter('notifications.mentions', v)} />
                             </ConfigGroup>
                          </div>
                        </div>
                      )}

                      {activeTab === 'privacy' && (
                        <div className="space-y-32">
                          <header className="space-y-10">
                            <div className="flex items-center gap-12">
                               <div className="w-24 h-24 rounded-[3.5rem] bg-slate-500/5 border-2 border-slate-500/20 flex items-center justify-center shadow-inner"><EyeOff className="text-slate-400" size={56} /></div>
                               <div>
                                  <h2 className="text-8xl font-black uppercase tracking-tighter italic text-white leading-none mb-4">Logic Sovereignty</h2>
                                  <p className="text-slate-800 font-black uppercase tracking-[1em] text-[15px] italic leading-none underline decoration-white/10">Manifestation consent and neural telemetry analytics</p>
                               </div>
                            </div>
                          </header>
                          <div className="max-w-6xl space-y-28 pt-20">
                             <ConfigGroup title="Sovereign Consent Matrix Topology">
                                <ToggleControl label="Heuristic Analytics Mining" description="Allow Sovereign Matrix to optimize global trends via anonymized logic data" 
                                  value={settings.privacy.analyticsConsent} onChange={(v) => tuneParameter('privacy.analyticsConsent', v)} />
                                <ToggleControl label="Mission History Archival" description="Allow system to store operational history for recursive hive training & audit" 
                                  value={settings.privacy.dataConsent} onChange={(v) => tuneParameter('privacy.dataConsent', v)} />
                             </ConfigGroup>
                          </div>
                        </div>
                      )}

                      {activeTab === 'security' && (
                        <div className="space-y-32">
                          <header className="space-y-10">
                             <div className="flex items-center gap-12">
                                <div className="w-24 h-24 rounded-[3.5rem] bg-indigo-500/5 border-2 border-indigo-500/20 flex items-center justify-center shadow-[0_40px_100px_rgba(99,102,241,0.2)] animate-pulse"><Shield size={56} className="text-indigo-400" /></div>
                                <div>
                                   <h2 className="text-8xl font-black uppercase tracking-tighter italic text-white leading-none mb-4">Shielding Protocols</h2>
                                   <p className="text-slate-800 font-black uppercase tracking-[1em] text-[15px] italic leading-none underline decoration-indigo-500/30">Authentication matrices and cross-node encryption</p>
                                </div>
                             </div>
                          </header>
                          <div className="max-w-5xl space-y-40 pt-20">
                              <ConfigGroup title="Cipher Matrix Interface Control">
                                 <ChangePasswordForm />
                              </ConfigGroup>
                              <ConfigGroup title="Terminal Dissolution Horizon">
                                 <div className="p-24 rounded-[7rem] bg-rose-600/[0.04] border-4 border-rose-500/20 flex flex-col gap-16 shadow-[inset_0_0_150px_rgba(244,63,94,0.15)] relative overflow-hidden group/dang">
                                    <div className="absolute top-0 right-0 p-16 opacity-[0.05] group-hover:opacity-[0.2] transition-opacity duration-1000 rotate-12 scale-150 pointer-events-none"><ZapOff size={600} /></div>
                                    <div className="space-y-12 relative z-10">
                                       <div className="flex items-center gap-10">
                                          <div className="w-16 h-16 rounded-[2rem] bg-rose-500/20 border-2 border-rose-500/40 flex items-center justify-center animate-bounce shadow-2xl"><ShieldAlert size={36} className="text-rose-500" /></div>
                                          <p className="text-[28px] text-rose-500 font-black uppercase tracking-[0.4em] italic leading-none underline decoration-rose-500/40">LATTICE_DISSOLUTION_PROTOCOL</p>
                                       </div>
                                       <div className="p-12 bg-black/60 border-2 border-white/5 rounded-[4.5rem] shadow-inner">
                                          <p className="text-[16px] text-slate-500 font-black uppercase tracking-[0.3em] italic leading-relaxed max-w-5xl text-left border-l-8 border-rose-600/30 pl-16">
                                            Initializing lattice dissolution will immediately disconnect all active resonance bridges, purge the Sovereign Ledger permanently, and terminate your identity DNA across the entire global substrate. This action is absolute, non-invertible, and chemically permanent. No logic recovery possible.
                                          </p>
                                       </div>
                                    </div>
                                    <button title="Dissolve" className="w-fit px-32 py-12 bg-rose-600 text-white font-black uppercase text-[18px] tracking-[1em] rounded-[4.5rem] hover:bg-white hover:text-rose-600 transition-all duration-1000 shadow-[0_60px_150px_rgba(244,63,94,0.3)] relative z-10 italic active:scale-75 group/btn border-none">
                                      <div className="flex items-center gap-10">
                                        EXECUTE_DISSOLUTION_PURGE <Trash2 size={36} className="group-hover/btn:rotate-12 transition-transform duration-700" />
                                      </div>
                                    </button>
                                 </div>
                              </ConfigGroup>
                          </div>
                        </div>
                      )}
                    </motion.div>
                 </AnimatePresence>

                 {/* Persistent Commit Center */}
                 <footer className="flex justify-end pt-24 border-t-4 border-white/5 relative z-[100] mt-24">
                    <button onClick={() => commitMatrixChange()} disabled={saving}
                      className="px-48 py-14 bg-white text-black font-black uppercase text-[24px] tracking-[1.5em] italic rounded-[6rem] hover:bg-emerald-600 hover:text-white transition-all duration-1000 shadow-[0_80px_200px_rgba(255,255,255,0.2)] hover:shadow-emerald-500/40 disabled:opacity-50 active:scale-95 flex items-center gap-12 group relative overflow-hidden border-none"
                    >
                      <div className="absolute inset-x-0 bottom-0 h-4 bg-emerald-400 group-hover:h-full transition-all duration-1000 opacity-20" />
                      <div className="relative z-10 flex items-center gap-12">
                        {saving ? <RefreshCw className="animate-spin text-emerald-600 group-hover:text-white" size={48} /> : <Lock size={48} className="group-hover:scale-125 group-hover:rotate-12 transition-transform duration-1000" />}
                        {saving ? 'SYNCHRONIZING...' : 'COMMIT_CORE_CONFIG'}
                      </div>
                    </button>
                 </footer>
              </div>
           </section>
        </main>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          select { background-color: transparent !important; border: none !important; outline: none !important; appearance: none !important; }
          input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 48px; width: 48px; border-radius: 50%; background: white; box-shadow: 0 0 60px rgba(255,255,255,0.8); cursor: pointer; border: 8px solid #020205; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.3) rotate(15deg); }
          @keyframes shimmer-line { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
          .animate-shimmer { animation: shimmer-line 3s infinite linear; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

function ConfigGroup({ title, children, fullWidth = false }: { title: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className={`flex flex-col gap-20 ${fullWidth ? 'col-span-full' : ''} group/group`}>
      <div className="flex items-center gap-12 border-b-2 border-white/10 pb-12 transition-all group-hover/group:border-indigo-500/30">
        <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center"><Sliders size={20} className="text-slate-900 group-hover/group:text-indigo-400 transition-colors" /></div>
        <h3 className="text-[18px] font-black uppercase tracking-[1em] text-slate-950 italic leading-none group-hover/group:text-slate-700 transition-colors">{title}</h3>
      </div>
      <div className="flex flex-col gap-12">{children}</div>
    </div>
  )
}

function ToggleControl({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-14 rounded-[5.5rem] bg-black/60 border-2 border-white/5 hover:border-indigo-500/50 transition-all duration-1000 group shadow-[inset_0_0_100px_rgba(0,0,0,0.6)]">
      <div className="flex flex-col gap-6 text-left pl-8">
        <span className="text-[24px] font-black uppercase tracking-[0.4em] text-white italic group-hover:text-indigo-400 transition-colors leading-none mb-2">{label}</span>
        <span className="text-[15px] font-bold text-slate-800 uppercase tracking-widest italic leading-tight max-w-xl opacity-40 group-hover:opacity-100 transition-opacity">{description}</span>
      </div>
      <button onClick={() => onChange(!value)} title={value ? 'OFF' : 'ON'} aria-label={value ? 'OFF' : 'ON'}
        className={`w-36 h-20 rounded-full relative transition-all duration-1000 border-8 border-black shadow-[0_0_80px_rgba(0,0,0,1)] flex-shrink-0 ${value ? 'bg-indigo-600 shadow-[0_0_80px_rgba(99,102,241,0.5)]' : 'bg-slate-950'}`}
      >
        <motion.div animate={{ x: value ? 64 : 4 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} 
          className={`absolute top-1 left-1 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center ${value ? 'bg-white' : 'bg-slate-900 border-2 border-white/5'}`}
        >
          {value ? <Check size={28} className="text-indigo-600" /> : <X size={28} className="text-slate-950" />}
        </motion.div>
      </button>
    </div>
  )
}

function DropdownControl({ label, description, value, options, onChange }: { label: string; description: string; value: string; options: {id: string; label: string}[], onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-16 p-14 rounded-[5.5rem] bg-black/60 border-2 border-white/5 hover:border-indigo-500/50 transition-all duration-1000 group shadow-[inset_0_0_100px_rgba(0,0,0,0.6)]">
      <div className="flex flex-col gap-6 text-left pl-8">
        <span className="text-[24px] font-black uppercase tracking-[0.4em] text-white italic group-hover:text-indigo-400 transition-colors leading-none mb-2">{label}</span>
        <span className="text-[15px] font-bold text-slate-800 uppercase tracking-widest italic leading-tight opacity-40 group-hover:opacity-100 transition-opacity">{description}</span>
      </div>
      <div className="relative group/sel">
         <select value={value} onChange={(e) => onChange(e.target.value)} title={label} aria-label={label}
           className="w-full bg-black/80 border-2 border-white/10 px-16 py-10 rounded-[3.5rem] text-[20px] font-black uppercase tracking-[0.8em] text-white focus:outline-none focus:border-indigo-500 transition-all duration-1000 appearance-none cursor-pointer italic shadow-inner"
         >
           {options.map(o => <option key={o.id} value={o.id} className="bg-[#020205] text-white py-10">{o.label}</option>)}
         </select>
         <div className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-900 pointer-events-none group-hover/sel:text-indigo-400 transition-colors duration-1000 group-hover/sel:rotate-180">
            <ChevronRight size={44} className="rotate-90" />
         </div>
      </div>
    </div>
  )
}

function InputControl({ label, type = 'text', placeholder, value, onChange }: { label: string; type?: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-12 p-14 rounded-[6rem] bg-black/60 border-2 border-white/5 hover:border-indigo-500/50 transition-all duration-1000 group shadow-[inset_0_0_100px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-6 pl-8">
         <Key size={24} className="text-slate-950 group-hover:text-indigo-400 transition-colors" />
         <span className="text-[22px] font-black uppercase tracking-[0.5em] text-white italic group-hover:text-indigo-400 transition-colors leading-none text-left">{label}</span>
      </div>
      <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black/95 border-2 border-white/10 px-16 py-10 rounded-[4rem] text-[24px] font-mono font-black text-indigo-400 focus:outline-none focus:border-indigo-500 transition-all duration-1000 placeholder:text-slate-950 italic shadow-[0_0_40px_rgba(0,0,0,0.8)]"
        title={label}
      />
    </div>
  )
}
