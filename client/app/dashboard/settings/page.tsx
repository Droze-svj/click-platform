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
  ArrowLeft, Sliders, ChevronDown, ChevronRight, Fingerprint, Gauge, Sparkles, Brain,
  Network, Database, Target, Activity, X, Plus, Scan, Binary, Anchor,
  Orbit, Wind, Ghost, Signal, ShieldAlert, CpuIcon, ActivityIcon,
  HardDrive, Workflow, ShieldQuestion, UserCheck, Key, Trash2, Search,
  CheckCircle2
} from 'lucide-react'
import { extractApiData } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '../../../hooks/useTranslation'
import { supportedLanguages, languageNames, type SupportedLanguage } from '../../../i18n/config'
import ChangePasswordForm from '../../../components/ChangePasswordForm'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useTheme } from '../../../components/ThemeProvider'
import { API_URL, apiPost, handleApiError } from '../../../lib/api'

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
  { value: '', label: 'Default' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Oswald', label: 'Oswald' },
  { value: 'Bebas Neue', label: 'Bebas Neue' },
]

function isValidLang(l: string): l is SupportedLanguage {
  return supportedLanguages.includes(l as SupportedLanguage)
}

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { language, setLanguage, t } = useTranslation()
  const { resolvedTheme } = useTheme()
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

  const loadSettings = useCallback(async () => {
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

  const loadBrandKit = useCallback(async () => {
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

  useEffect(() => { loadSettings().then(() => { initialLoadDoneRef.current = true }) }, [loadSettings])
  useEffect(() => { if (tabFromUrl === 'brand') setActiveTab('brand') }, [tabFromUrl])
  useEffect(() => { if (activeTab === 'brand') loadBrandKit() }, [activeTab, loadBrandKit])

  // Deactivate the user's account. Gated behind two confirmations because
  // the previous "Delete account" button had no onClick at all — users
  // who clicked it during the live demo would see nothing happen, which
  // is worse than the dialog because they'd assume the button was broken.
  // Deactivate the user's account. Gated behind a confirm + password
  // prompt because the server endpoint requires password verification —
  // and because the previous button had no onClick at all, which silently
  // failed during the live demo.
  const deactivateAccount = async () => {
    const ok = window.confirm(
      'Delete your account? This will revoke all sessions, disconnect every social platform, and remove your published-content history. You can reactivate by contacting support.',
    )
    if (!ok) return
    const password = window.prompt('Enter your password to confirm:')
    if (!password) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Cancelled.', type: 'info' } }))
      return
    }
    try {
      await apiPost('/auth/deactivate', { password, reason: 'user_request' })
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Account deleted. Signing you out.', type: 'success' } }))
      try { localStorage.removeItem('token') } catch (_) { /* best-effort */ }
      setTimeout(() => router.push('/login'), 800)
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: handleApiError(err) || "Couldn't delete account.", type: 'error' } }))
    }
  }

  const saveSettings = async (options?: { skipToast?: boolean }) => {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      await axios.put(`${API_URL}/user/settings`, settings, { headers: { Authorization: `Bearer ${token}` } })
      if (!options?.skipToast) {
         window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Settings saved successfully', type: 'success' } }))
      }
    } catch (error: any) {
      if (!options?.skipToast) {
         window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Failed to save settings', type: 'error' } }))
      }
      throw error
    } finally { setSaving(false) }
  }

  const handleSettingChange = (path: string, value: any) => {
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
        saveSettings({ skipToast: true })
          .then(() => {
            setAutoSaveStatus('saved')
            setTimeout(() => setAutoSaveStatus('idle'), 2000)
          })
          .catch(() => { setAutoSaveStatus('error'); setTimeout(() => setAutoSaveStatus('idle'), 3000) })
      }, 600)
    }
  }

  const updateBrandKitField = (field: keyof BrandKit, value: any) => {
    setBrandKit(prev => ({ ...prev, [field]: value }))
  }

  const saveBrandKit = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    setBrandKitSaving(true)
    try {
      await axios.put(`${API_URL}/pro-mode/brand-kit`, brandKit, { headers: { Authorization: `Bearer ${token}` } })
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Brand kit updated successfully', type: 'success' } }))
    } catch (e) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Failed to update brand kit', type: 'error' } }))
    } finally { setBrandKitSaving(false) }
  }

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-surface-page min-h-screen transition-colors duration-500">
        <Fingerprint size={80} className="text-primary-500 animate-spin mb-12" />
        <p className="text-sm font-black text-surface-500 uppercase tracking-widest animate-pulse italic leading-none">Syncing Preferences Hub...</p>
     </div>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-12 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter">
        <ToastContainer />
        
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-12 pb-10 border-b border-surface-200 dark:border-surface-800 relative z-50">
           <div className="flex items-center gap-6 w-full md:w-auto min-w-0">
               <button type="button" onClick={() => router.push('/dashboard')} title="Back to Dashboard" aria-label="Back to Dashboard" className="w-14 h-14 rounded-2xl bg-surface-card border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all shadow-sm active:scale-90">
                 <ArrowLeft size={24} />
               </button>
              <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg flex-shrink-0 group hover:rotate-12 transition-transform duration-500">
                <Settings size={40} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-4 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-[0.2em] border border-primary-200 dark:border-primary-800 italic leading-none">
                      Settings
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-card text-surface-500 border border-surface-200 dark:bg-surface-800/50 dark:text-surface-400 dark:border-surface-700/50 text-[10px] font-black italic shadow-inner">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        Synced
                    </div>
                 </div>
                 <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none mt-3 truncate uppercase italic">Settings</h1>
              </div>
           </div>

           <Link href="/dashboard/settings/profile" className="flex items-center gap-6 p-3 pr-10 rounded-3xl bg-surface-card border-2 border-surface-100 dark:border-surface-800 hover:border-primary-500/40 transition-all shadow-xl group/profile">
              <div className="w-16 h-16 rounded-2xl bg-primary-500 flex items-center justify-center font-black text-2xl text-white shadow-lg group-hover/profile:rotate-12 transition-transform italic">
                {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="text-left">
                <p className="text-lg font-black text-surface-900 dark:text-white leading-none mb-2 italic uppercase">{user?.name || 'User'}</p>
                <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.3em] leading-none italic">Edit profile</p>
              </div>
           </Link>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
           {/* Sidebar Navigation */}
           <aside className="lg:col-span-3 space-y-10">
              <nav className="p-4 rounded-[3rem] bg-surface-card border border-surface-200 dark:border-surface-800 shadow-xl space-y-3">
                {[
                  { id: 'general', label: 'System', icon: <CpuIcon size={24} />, desc: 'Core settings' },
                  { id: 'agentic', label: 'AI agent', icon: <Zap size={24} />, desc: 'Autonomy & confidence' },
                  { id: 'brand', label: 'Brand', icon: <Palette size={24} />, desc: 'Visual identity' },
                  { id: 'notifications', label: 'Notifications', icon: <Bell size={24} />, desc: 'Alerts' },
                  { id: 'privacy', label: 'Privacy', icon: <EyeOff size={24} />, desc: 'Data & consent' },
                  { id: 'security', label: 'Access', icon: <Shield size={24} />, desc: 'Password & account' },
                ].map((tab) => (
                  <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center justify-between p-5 rounded-[2.2rem] transition-all duration-500 group/tab relative overflow-hidden ${
                      activeTab === tab.id 
                        ? 'bg-primary-500 text-white shadow-2xl scale-105 z-10' 
                        : 'text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-page border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-6 text-left relative z-10">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-md ${
                        activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-surface-page text-surface-400 border border-surface-100 dark:border-surface-800'
                      }`}>
                        {tab.icon}
                      </div>
                      <div className="space-y-1">
                        <span className="text-base font-black italic uppercase tracking-tighter block leading-none">{tab.label}</span>
                        <p className={`text-[9px] font-black uppercase tracking-widest italic ${activeTab === tab.id ? 'text-white/60' : 'text-surface-400'}`}>{tab.desc}</p>
                      </div>
                    </div>
                    {activeTab === tab.id && <ChevronRight size={22} className="text-white relative z-10" />}
                  </button>
                ))}
              </nav>

              <div className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[3.5rem] p-10 shadow-2xl relative overflow-hidden group transition-all duration-500 hover:shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
                 <div className="absolute -bottom-20 -right-20 opacity-[0.03] group-hover:rotate-12 transition-transform duration-1000 pointer-events-none">
                    <Workflow size={300} />
                 </div>
                 <h4 className="text-2xl font-black uppercase italic mb-4 relative z-10 leading-none tracking-tighter group-hover:text-primary-500 transition-colors">Need more?</h4>
                 <p className="text-sm font-bold text-surface-400 dark:text-slate-600 mb-10 relative z-10 leading-relaxed italic uppercase tracking-tight">
                   Upgrade to Pro for advanced AI, unlimited generations, and team workspaces.
                 </p>
                 <button className="w-full py-5 rounded-[1.8rem] bg-surface-900 dark:bg-white text-white dark:text-black font-black uppercase text-[11px] tracking-[0.4em] italic transition-all hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white relative z-10 shadow-2xl border-none active:scale-95">
                    Upgrade to Pro
                 </button>
              </div>
           </aside>

           {/* Main Content Area */}
           <section className="lg:col-span-9">
              <div className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[4rem] p-10 sm:p-14 shadow-2xl min-h-[850px] flex flex-col justify-between transition-all duration-500">
                 <AnimatePresence mode="wait">
                    <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5, type: 'spring' }}
                      className="space-y-16 relative z-10"
                    >
                      {activeTab === 'general' && (
                        <div className="space-y-16">
                          <header className="flex items-center gap-10">
                             <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform duration-500">
                                <CpuIcon className="text-primary-600 dark:text-primary-400" size={40} />
                             </div>
                             <div className="space-y-3">
                                <h2 className="text-4xl font-black tracking-tighter text-surface-900 dark:text-white uppercase italic leading-none">System</h2>
                                <p className="text-base font-bold text-surface-500 dark:text-slate-400 italic uppercase tracking-tight">Theme and language.</p>
                              </div>
                          </header>
                          
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                             <DropdownControl label="Theme" description="Pick your interface theme."
                                value={settings.preferences.theme}
                                options={[{id: 'light', label:'Light'}, {id:'dark', label:'Dark'}, {id:'auto', label:'Match system'}]}
                                onChange={(v) => handleSettingChange('preferences.theme', v)}
                              />
                             <DropdownControl label="Language" description="Interface language."
                                value={settings.preferences.language}
                                options={supportedLanguages.map(l => ({id: l, label: languageNames[l]}))}
                                onChange={(v) => { if (isValidLang(v)) { setLanguage(v); handleSettingChange('preferences.language', v); } }}
                              />
                          </div>
                        </div>
                      )}

                      {activeTab === 'agentic' && (
                        <div className="space-y-16">
                          <header className="flex items-center gap-10">
                             <div className="w-20 h-20 rounded-[2.5rem] bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center shadow-lg">
                                <Zap className="text-amber-500" size={40} />
                             </div>
                             <div className="space-y-3">
                                <h2 className="text-4xl font-black tracking-tighter text-surface-900 dark:text-white uppercase italic leading-none">AI agent</h2>
                                <p className="text-base font-bold text-surface-500 dark:text-slate-400 italic uppercase tracking-tight">Choose how Click's AI behaves on your behalf.</p>
                             </div>
                          </header>
                          
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                             <div className="space-y-8">
                                <ToggleControl label="Autonomous mode" description="Let multiple AI agents collaborate to produce higher-quality output." 
                                  value={settings.agentic.autonomousSwarm} onChange={(v) => handleSettingChange('agentic.autonomousSwarm', v)} />
                                <ToggleControl label="Auto-publish scheduled posts" description="Publish queued posts automatically at their scheduled time — no extra approval needed." 
                                  value={settings.agentic.slaAutoFulfill} onChange={(v) => handleSettingChange('agentic.slaAutoFulfill', v)} />
                             </div>

                             <div className="p-10 rounded-[3.5rem] bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 space-y-12 shadow-inner backdrop-blur-xl group/range">
                                <div className="flex justify-between items-center">
                                   <div className="space-y-3">
                                      <p className="text-2xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic leading-none">Confidence Threshold</p>
                                      <p className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest italic leading-none">Minimum quality score before Click publishes.</p>
                                   </div>
                                   <span className="text-6xl font-black text-primary-500 tabular-nums italic group-hover/range:scale-110 transition-transform">{settings.agentic.predictiveThreshold}%</span>
                                </div>
                                <div className="relative pt-4">
                                   <input type="range" min="0" max="100" value={settings.agentic.predictiveThreshold}
                                     title="Confidence Threshold"
                                     aria-label="Confidence Threshold"
                                     onChange={(e) => handleSettingChange('agentic.predictiveThreshold', parseInt(e.target.value))}
                                     className="w-full h-3 bg-surface-card dark:bg-surface-800 rounded-full appearance-none cursor-pointer accent-primary-500 shadow-inner"
                                   />
                                   <div className="flex justify-between mt-6">
                                      <span className="text-[10px] font-black text-surface-300 dark:text-slate-800 italic uppercase tracking-widest">Experimental</span>
                                      <span className="text-[10px] font-black text-primary-500 italic uppercase tracking-widest">Stable</span>
                                   </div>
                                </div>
                             </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'brand' && (
                        <div className="space-y-16">
                          <header className="flex items-center gap-10">
                             <div className="w-20 h-20 rounded-[2.5rem] bg-fuchsia-500/10 border-2 border-fuchsia-500/20 flex items-center justify-center shadow-lg">
                                <Palette className="text-fuchsia-500" size={40} />
                             </div>
                             <div className="space-y-3">
                                <h2 className="text-4xl font-black tracking-tighter text-surface-900 dark:text-white uppercase italic leading-none">Brand Kit</h2>
                                <p className="text-base font-bold text-surface-500 dark:text-slate-400 italic uppercase tracking-tight">Set your colors and fonts. Every generated asset matches.</p>
                             </div>
                          </header>

                          {brandKitLoading ? (
                            <div className="flex flex-col items-center justify-center py-40 bg-surface-page dark:bg-surface-950/30 rounded-[4rem] border-4 border-dashed border-surface-100 dark:border-surface-800 shadow-inner">
                              <RefreshCw className="w-20 h-20 text-primary-500 animate-spin mb-10" />
                              <p className="text-[12px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[1em] animate-pulse italic">Loading brand kit…</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                               <div className="space-y-12">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                     <div className="space-y-6">
                                        <label className="text-[11px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.5em] italic pl-4">Primary color</label>
                                        <div className="flex items-center gap-6 p-6 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-[2.2rem] shadow-inner backdrop-blur-xl group/color hover:border-primary-500/30 transition-all">
                                           <div className="relative w-14 h-14 flex-shrink-0 overflow-hidden rounded-[1.2rem] border-2 border-surface-200 dark:border-surface-800 shadow-lg">
                                              <input type="color"
                                                title="Primary color"
                                                aria-label="Primary color"
                                                value={brandKit.primaryColor || '#6366f1'} 
                                                onChange={(e) => updateBrandKitField('primaryColor', e.target.value)} 
                                                className="absolute inset-[-15px] w-[180%] h-[180%] cursor-pointer p-0" 
                                              />
                                           </div>
                                           <input type="text" value={brandKit.primaryColor || ''} onChange={(e) => updateBrandKitField('primaryColor', e.target.value)} className="bg-transparent border-none text-lg font-black text-surface-900 dark:text-white focus:outline-none w-full uppercase italic tracking-tighter" placeholder="#FFFFFF" />
                                        </div>
                                     </div>
                                     <div className="space-y-6">
                                        <label className="text-[11px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.5em] italic pl-4">Accent color</label>
                                        <div className="flex items-center gap-6 p-6 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-[2.2rem] shadow-inner backdrop-blur-xl group/color hover:border-primary-500/30 transition-all">
                                           <div className="relative w-14 h-14 flex-shrink-0 overflow-hidden rounded-[1.2rem] border-2 border-surface-200 dark:border-surface-800 shadow-lg">
                                              <input type="color" value={brandKit.accentColor || '#8b5cf6'} onChange={(e) => updateBrandKitField('accentColor', e.target.value)} aria-label="Accent color" title="Accent color" className="absolute inset-[-15px] w-[180%] h-[180%] cursor-pointer p-0" />
                                           </div>
                                           <input type="text" value={brandKit.accentColor || ''} onChange={(e) => updateBrandKitField('accentColor', e.target.value)} className="bg-transparent border-none text-lg font-black text-surface-900 dark:text-white focus:outline-none w-full uppercase italic tracking-tighter" placeholder="#000000" />
                                        </div>
                                     </div>
                                  </div>
                                  <DropdownControl label="Headline font" description="Used for titles and big hooks."
                                    value={brandKit.titleFont || ''} options={FONT_OPTIONS.map(o => ({id: o.value, label: o.label}))}
                                    onChange={(v) => updateBrandKitField('titleFont', v)} />
                                  <DropdownControl label="Body font" description="Used for captions and supporting text."
                                    value={brandKit.bodyFont || ''} options={FONT_OPTIONS.map(o => ({id: o.value, label: o.label}))}
                                    onChange={(v) => updateBrandKitField('bodyFont', v)} />
                               </div>

                               <div className="space-y-12">
                                  <DropdownControl label="Lower-third style" description="How name banners and captions appear on screen."
                                    value={brandKit.lowerThirdStyle || ''} options={[{id:'', label:'None'}, {id:'bar', label:'Classic bar'}, {id:'pill', label:'Modern pill'}, {id:'minimal', label:'Minimal'}]}
                                    onChange={(v) => updateBrandKitField('lowerThirdStyle', v)} />
                                  <DropdownControl label="Logo placement" description="Where your logo or watermark sits."
                                    value={brandKit.logoPlacement || ''} options={[{id:'', label:'Hidden'}, {id:'top-left', label:'Top left'}, {id:'top-right', label:'Top right'}, {id:'bottom-right', label:'Bottom right'}]}
                                    onChange={(v) => updateBrandKitField('logoPlacement', v)} />
                                  
                                  <div className="col-span-full flex justify-end pt-8">
                                     <button type="button" onClick={saveBrandKit} disabled={brandKitSaving}
                                       className="w-full px-12 py-7 bg-primary-600 text-white font-black uppercase text-[12px] tracking-[0.8em] italic rounded-[2.5rem] hover:bg-primary-500 transition-all shadow-[0_25px_60px_rgba(99,102,241,0.4)] flex items-center justify-center gap-8 active:scale-95 border-none group/save"
                                     >
                                       {brandKitSaving ? <RefreshCw className="animate-spin" size={28} /> : <CheckCircle2 size={28} className="group-hover:scale-125 transition-transform" />}
                                       {brandKitSaving ? 'Saving…' : 'Save brand kit'}
                                     </button>
                                  </div>
                               </div>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'notifications' && (
                        <div className="space-y-16">
                          <header className="flex items-center gap-10">
                             <div className="w-20 h-20 rounded-[2.5rem] bg-rose-500/10 border-2 border-rose-500/20 flex items-center justify-center shadow-lg">
                                <Bell className="text-rose-500" size={40} />
                             </div>
                             <div className="space-y-3">
                                <h2 className="text-4xl font-black tracking-tighter text-surface-900 dark:text-white uppercase italic leading-none">Notifications</h2>
                                <p className="text-base font-bold text-surface-500 dark:text-slate-400 italic uppercase tracking-tight">Choose what Click pings you about.</p>
                             </div>
                          </header>

                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                             <div className="space-y-10">
                                <ToggleControl label="Email" description="Weekly summary plus action items."
                                  value={settings.notifications.email} onChange={(v) => handleSettingChange('notifications.email', v)} />
                                <ToggleControl label="Push" description="Real-time alerts when a post is ready or scheduled."
                                  value={settings.notifications.push} onChange={(v) => handleSettingChange('notifications.push', v)} />
                             </div>
                             <div className="space-y-10">
                                <ToggleControl label="Content ready" description="Ping me when a generated clip finishes processing."
                                  value={settings.notifications.contentReady} onChange={(v) => handleSettingChange('notifications.contentReady', v)} />
                                <ToggleControl label="Mentions" description="Tell me when my brand or handle is mentioned."
                                  value={settings.notifications.mentions ?? true} onChange={(v) => handleSettingChange('notifications.mentions', v)} />
                             </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'privacy' && (
                        <div className="space-y-16">
                          <header className="flex items-center gap-10">
                             <div className="w-20 h-20 rounded-[2.5rem] bg-surface-100 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 flex items-center justify-center shadow-lg">
                                <EyeOff className="text-surface-600 dark:text-surface-300" size={40} />
                             </div>
                             <div className="space-y-3">
                                <h2 className="text-4xl font-black tracking-tighter text-surface-900 dark:text-white uppercase italic leading-none">Privacy</h2>
                                <p className="text-base font-bold text-surface-500 dark:text-slate-400 italic uppercase tracking-tight">Decide what Click can use to improve your results.</p>
                             </div>
                          </header>
                          
                          <div className="max-w-4xl space-y-10">
                             <ToggleControl label="Anonymous analytics" description="Help Click improve by sharing anonymous usage data."
                               value={settings.privacy.analyticsConsent} onChange={(v) => handleSettingChange('privacy.analyticsConsent', v)} />
                             <ToggleControl label="Use my content to improve my AI" description="Let Click learn from your past posts to make better suggestions for you."
                               value={settings.privacy.dataConsent} onChange={(v) => handleSettingChange('privacy.dataConsent', v)} />
                          </div>
                        </div>
                      )}

                      {activeTab === 'security' && (
                        <div className="space-y-16">
                          <header className="flex items-center gap-10">
                             <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center shadow-lg">
                                <Shield size={40} className="text-indigo-600 dark:text-indigo-400" />
                             </div>
                             <div className="space-y-3">
                                <h2 className="text-4xl font-black tracking-tighter text-surface-900 dark:text-white uppercase italic leading-none">Access</h2>
                                <p className="text-base font-bold text-surface-500 dark:text-slate-400 italic uppercase tracking-tight">Password, sessions, and account deletion.</p>
                             </div>
                          </header>
                          
                          <div className="max-w-4xl space-y-20">
                              <div className="bg-surface-page dark:bg-surface-950/40 p-10 sm:p-14 rounded-[4rem] border-2 border-surface-100 dark:border-surface-800 shadow-inner backdrop-blur-xl">
                                <ChangePasswordForm />
                              </div>
                              
                              <div className="p-10 sm:p-14 rounded-[4rem] bg-rose-500/5 dark:bg-rose-500/[0.02] border-2 border-rose-500/20 space-y-12 relative overflow-hidden group/danger transition-all duration-500 hover:border-rose-500/40">
                                 <div className="absolute top-0 right-0 p-16 opacity-[0.03] group-hover/danger:opacity-[0.1] transition-opacity duration-1000 pointer-events-none">
                                    <ShieldAlert size={350} />
                                 </div>
                                 <div className="flex items-center gap-8 relative z-10">
                                    <div className="w-16 h-16 rounded-[1.5rem] bg-rose-500/20 border-2 border-rose-500/30 flex items-center justify-center shadow-lg group-hover/danger:rotate-12 transition-transform duration-500">
                                       <ShieldAlert size={36} className="text-rose-600 dark:text-rose-400" />
                                    </div>
                                    <div>
                                       <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400 uppercase tracking-tighter italic leading-none mb-1">Danger zone</h3>
                                       <p className="text-[10px] font-black text-rose-500/40 uppercase tracking-[0.5em] italic">Irreversible actions</p>
                                    </div>
                                 </div>
                                 <p className="text-base font-bold text-surface-500 dark:text-slate-400 leading-relaxed border-l-4 border-rose-500/40 pl-10 relative z-10 italic uppercase tracking-tight max-w-3xl">
                                   Delete your account: permanently remove all of your videos, posts, connected accounts, and subscription. This cannot be undone.
                                 </p>
                                 <button
                                   type="button"
                                   onClick={deactivateAccount}
                                   className="px-12 py-6 bg-rose-600 text-white font-black uppercase text-[12px] tracking-[0.8em] italic rounded-[2rem] hover:bg-rose-700 transition-all shadow-[0_25px_60px_rgba(225,29,72,0.4)] active:scale-95 border-none relative z-10 group-hover/danger:-translate-y-2"
                                 >
                                   Delete account
                                 </button>
                              </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                 </AnimatePresence>

                 <footer className="flex flex-col sm:flex-row justify-between items-center pt-14 border-t-2 border-surface-100 dark:border-surface-800 mt-20 gap-10">
                    <div className="flex items-center gap-6">
                       <div className={`w-4 h-4 rounded-full transition-all duration-500 ${autoSaveStatus === 'saved' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : autoSaveStatus === 'saving' ? 'bg-primary-500 animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.8)]' : 'bg-surface-200 dark:bg-surface-900 shadow-inner'}`} />
                       <span className="text-[11px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.6em] italic">
                          {autoSaveStatus === 'saved' ? 'Saved' : autoSaveStatus === 'saving' ? 'Saving…' : 'Idle'}
                       </span>
                    </div>
                    <button type="button" onClick={() => saveSettings()} disabled={saving}
                      className="w-full sm:w-auto px-20 py-7 bg-surface-900 dark:bg-white text-white dark:text-black font-black uppercase text-[14px] tracking-[1em] italic rounded-[3rem] hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all shadow-[0_35px_100px_rgba(0,0,0,0.5)] disabled:opacity-50 active:scale-95 flex items-center justify-center gap-8 border-none group/commit"
                    >
                      {saving ? <RefreshCw className="animate-spin" size={32} /> : <Lock size={32} className="group-hover/commit:rotate-12 transition-transform" />}
                      {saving ? 'Saving…' : 'Save all settings'}
                    </button>
                 </footer>
              </div>
           </section>
        </main>
      </div>
    </ErrorBoundary>
  )
}

function ToggleControl({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-8 sm:p-10 rounded-[3rem] bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 hover:border-primary-500/30 transition-all duration-500 shadow-inner group/toggle backdrop-blur-xl">
      <div className="flex flex-col gap-3 text-left min-w-0 pr-10">
        <span className="text-xl font-black text-surface-900 dark:text-white group-hover/toggle:text-primary-500 transition-colors uppercase italic tracking-tighter leading-none">{label}</span>
        <span className="text-[12px] font-bold text-surface-400 dark:text-slate-600 italic uppercase tracking-tight leading-relaxed">{description}</span>
      </div>
      <button type="button" onClick={() => onChange(!value)}
        title={label} aria-label={`${label}: ${value ? 'Enabled' : 'Disabled'}`}
        className={`h-11 w-[84px] rounded-full relative transition-all duration-500 flex-shrink-0 shadow-2xl ${value ? 'bg-primary-500' : 'bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800'}`}
      >
        <motion.div animate={{ x: value ? 44 : 4 }} transition={{ type: "spring", stiffness: 600, damping: 30 }} 
          className="absolute top-1 left-1 w-9 h-9 rounded-full bg-white shadow-xl flex items-center justify-center"
        >
          {value && <Check size={22} className="text-primary-600" aria-hidden="true" />}
        </motion.div>
      </button>
    </div>
  )
}

function DropdownControl({ label, description, value, options, onChange }: { label: string; description: string; value: string; options: {id: string; label: string}[], onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-8 p-10 rounded-[3.5rem] bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 hover:border-primary-500/30 transition-all duration-500 shadow-inner group/drop backdrop-blur-xl">
      <div className="flex flex-col gap-3 text-left">
        <span className="text-xl font-black text-surface-900 dark:text-white group-hover/drop:text-primary-500 transition-colors uppercase italic tracking-tighter leading-none">{label}</span>
        <span className="text-[12px] font-bold text-surface-400 dark:text-slate-600 italic uppercase tracking-tight leading-relaxed">{description}</span>
      </div>
      <div className="relative group/select">
         <select value={value} onChange={(e) => onChange(e.target.value)}
           aria-label={label}
           title={label}
           className="w-full bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 px-10 py-6 rounded-[2rem] text-sm font-black text-surface-900 dark:text-white uppercase italic tracking-[0.2em] focus:border-primary-500 outline-none appearance-none cursor-pointer transition-all shadow-xl backdrop-blur-xl group-hover/select:bg-surface-page dark:group-hover/select:bg-surface-950/60"
         >
           {options.map(o => <option key={o.id} value={o.id} className="bg-surface-card dark:bg-surface-900">{o.label}</option>)}
         </select>
         <ChevronDown size={28} className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-surface-300 dark:text-slate-800 group-hover/select:text-primary-500 transition-all" />
      </div>
    </div>
  )
}
