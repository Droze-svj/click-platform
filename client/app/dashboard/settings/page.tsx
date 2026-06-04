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
import { CardSkeleton } from '../../../components/LoadingSkeleton'
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
  videoEditing?: {
    preferredVoiceTone?: string;
    preferredHookStyle?: string;
    pacingIntensity?: string;
    captionStyle?: string;
    captionFontScale?: number;
    captionVerticalOffset?: number;
    aestheticColorGrade?: string;
    aestheticTransition?: string;
    subtitlePosition?: string;
    contentTone?: string;
    brollFrequency?: string;
    musicGenre?: string;
    defaultPlatform?: string;
    enableSpeedRamping?: boolean;
    enableBRoll?: boolean;
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
  const [settings, setSettings] = useState<UserSettings & { videoEditing?: any }>({
    notifications: {
      email: true, push: true, contentReady: true, weeklyDigest: false,
      achievements: true, mentions: true, comments: false,
      priorityTiers: 'all', digestMode: 'immediate', digestTime: '09:00',
    },
    privacy: { dataConsent: true, marketingConsent: false, analyticsConsent: true },
    preferences: { theme: 'auto', language: 'en', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    agentic: { autonomousSwarm: true, slaAutoFulfill: true, predictiveThreshold: 85, digitalTwinProvider: 'both' },
    videoEditing: {
      preferredVoiceTone: 'Hype',
      preferredHookStyle: 'curiosity-gap',
      pacingIntensity: 'medium',
      captionStyle: 'modern',
      captionFontScale: 1.0,
      captionVerticalOffset: 0,
      aestheticColorGrade: 'vibrant',
      aestheticTransition: 'fade',
      subtitlePosition: 'auto',
      contentTone: 'auto',
      brollFrequency: 'balanced',
      musicGenre: 'auto',
      defaultPlatform: 'auto',
      enableSpeedRamping: true,
      enableBRoll: true,
    }
  })
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'privacy' | 'security' | 'brand' | 'agentic' | 'videoEditing' | 'trust'>(tabFromUrl === 'brand' ? 'brand' : 'general')
  const [brandKit, setBrandKit] = useState<BrandKit>(DEFAULT_BRAND_KIT)
  const [brandKitLoading, setBrandKitLoading] = useState(false)
  const [brandKitSaving, setBrandKitSaving] = useState(false)
  const [trustData, setTrustData] = useState<{ score: number; level: string; levelColor: string; breakdown: any[]; nextSteps: any[] } | null>(null)
  const [trustLoading, setTrustLoading] = useState(false)
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
  useEffect(() => {
    if (activeTab !== 'trust' || !user?.id) return
    setTrustLoading(true)
    const token = localStorage.getItem('token')
    axios.get(`${API_URL}/trust/credibility/${user.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { const d = r.data?.data; if (d) setTrustData(d) })
      .catch(() => {})
      .finally(() => setTrustLoading(false))
  }, [activeTab, user?.id])

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
      t('settingsPage.deleteAccountConfirm'),
    )
    if (!ok) return
    const password = window.prompt(t('settingsPage.enterPasswordConfirm'))
    if (!password) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('settingsPage.cancelled'), type: 'info' } }))
      return
    }
    try {
      await apiPost('/auth/deactivate', { password, reason: 'user_request' })
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('settingsPage.accountDeleted'), type: 'success' } }))
      try { localStorage.removeItem('token') } catch (_) { /* best-effort */ }
      setTimeout(() => router.push('/login'), 800)
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: handleApiError(err) || t('settingsPage.deleteAccountFailed'), type: 'error' } }))
    }
  }

  const saveSettings = async (options?: { skipToast?: boolean }) => {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      await axios.put(`${API_URL}/user/settings`, settings, { headers: { Authorization: `Bearer ${token}` } })
      if (!options?.skipToast) {
         window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('settingsPage.settingsSaved'), type: 'success' } }))
      }
    } catch (error: any) {
      if (!options?.skipToast) {
         window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('settingsPage.settingsSaveFailed'), type: 'error' } }))
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
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('settingsPage.brandKitUpdated'), type: 'success' } }))
    } catch (e) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('settingsPage.brandKitUpdateFailed'), type: 'error' } }))
    } finally { setBrandKitSaving(false) }
  }

  if (loading) return (
     <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-12 bg-surface-page transition-colors duration-500" aria-busy="true" aria-label={t('settingsPage.loading')}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
     </div>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-12 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter">
        <ToastContainer />
        
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-12 pb-10 border-b border-surface-200 dark:border-surface-800 relative z-50">
           <div className="flex items-center gap-6 w-full md:w-auto min-w-0">
               <button type="button" onClick={() => router.push('/dashboard')} title={t('settingsPage.backToDashboard')} aria-label={t('settingsPage.backToDashboard')} className="w-14 h-14 rounded-2xl bg-surface-card border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all shadow-sm active:scale-90">
                 <ArrowLeft size={24} />
               </button>
              <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg flex-shrink-0 group hover:rotate-12 transition-transform duration-500">
                <Settings size={40} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-4 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-[0.2em] border border-primary-200 dark:border-primary-800 italic leading-none">
                      {t('settingsPage.title')}
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-card text-surface-500 border border-surface-200 dark:bg-surface-800/50 dark:text-surface-400 dark:border-surface-700/50 text-[10px] font-black italic shadow-inner">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        {t('settingsPage.synced')}
                    </div>
                 </div>
                 <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none mt-3 truncate uppercase italic">{t('settingsPage.title')}</h1>
              </div>
           </div>

           <Link href="/dashboard/settings/profile" className="flex items-center gap-6 p-3 pr-10 rounded-3xl bg-surface-card border-2 border-surface-100 dark:border-surface-800 hover:border-primary-500/40 transition-all shadow-xl group/profile">
              <div className="w-16 h-16 rounded-2xl bg-primary-500 flex items-center justify-center font-black text-2xl text-white shadow-lg group-hover/profile:rotate-12 transition-transform italic">
                {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="text-left">
                <p className="text-lg font-black text-surface-900 dark:text-white leading-none mb-2 italic uppercase">{user?.name || t('settingsPage.userFallback')}</p>
                <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.3em] leading-none italic">{t('settingsPage.editProfile')}</p>
              </div>
           </Link>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
           {/* Sidebar Navigation */}
           <aside className="lg:col-span-3 space-y-10">
              <nav className="p-4 rounded-[3rem] bg-surface-card border border-surface-200 dark:border-surface-800 shadow-xl space-y-3">
                {[
                  { id: 'general', label: t('settingsPage.tabGeneral'), icon: <CpuIcon size={24} />, desc: t('settingsPage.tabGeneralDesc') },
                  { id: 'agentic', label: t('settingsPage.tabAgentic'), icon: <Zap size={24} />, desc: t('settingsPage.tabAgenticDesc') },
                  { id: 'trust', label: t('settingsPage.tabTrust'), icon: <ShieldCheck size={24} />, desc: t('settingsPage.tabTrustDesc') },
                  { id: 'brand', label: t('settingsPage.tabBrand'), icon: <Palette size={24} />, desc: t('settingsPage.tabBrandDesc') },
                  { id: 'videoEditing', label: t('settingsPage.tabVideo'), icon: <Sliders size={24} />, desc: t('settingsPage.tabVideoDesc') },
                  { id: 'notifications', label: t('settingsPage.tabNotifications'), icon: <Bell size={24} />, desc: t('settingsPage.tabNotificationsDesc') },
                  { id: 'privacy', label: t('settingsPage.tabPrivacy'), icon: <EyeOff size={24} />, desc: t('settingsPage.tabPrivacyDesc') },
                  { id: 'security', label: t('settingsPage.tabSecurity'), icon: <Shield size={24} />, desc: t('settingsPage.tabSecurityDesc') },
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
                 <h4 className="text-2xl font-black uppercase italic mb-4 relative z-10 leading-none tracking-tighter group-hover:text-primary-500 transition-colors">{t('settingsPage.needMore')}</h4>
                 <p className="text-sm font-bold text-surface-400 dark:text-slate-600 mb-10 relative z-10 leading-relaxed italic uppercase tracking-tight">
                   {t('settingsPage.upgradeProBlurb')}
                 </p>
                 <button className="w-full py-5 rounded-[1.8rem] bg-surface-900 dark:bg-white text-white dark:text-black font-black uppercase text-[11px] tracking-[0.4em] italic transition-all hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white relative z-10 shadow-2xl border-none active:scale-95">
                    {t('settingsPage.upgradePro')}
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
                                <h2 className="text-4xl font-black tracking-tighter text-surface-900 dark:text-white uppercase italic leading-none">{t('settingsPage.tabGeneral')}</h2>
                                <p className="text-base font-bold text-surface-500 dark:text-slate-400 italic uppercase tracking-tight">{t('settingsPage.generalSubtitle')}</p>
                              </div>
                          </header>
                          
                          <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                             <DropdownControl label={t('settingsPage.theme')} description={t('settingsPage.themeDesc')}
                                value={settings.preferences.theme}
                                options={[{id: 'light', label:t('settingsPage.themeLight')}, {id:'dark', label:t('settingsPage.themeDark')}, {id:'auto', label:t('settingsPage.themeAuto')}]}
                                onChange={(v) => handleSettingChange('preferences.theme', v)}
                              />
                             <DropdownControl label={t('settingsPage.language')} description={t('settingsPage.languageDesc')}
                                value={settings.preferences.language}
                                options={supportedLanguages.map(l => ({id: l, label: languageNames[l]}))}
                                onChange={(v) => { if (isValidLang(v)) { setLanguage(v); handleSettingChange('preferences.language', v); } }}
                              />
                             <DropdownControl label={t('settingsPage.timezone')} description={t('settingsPage.timezoneDesc')}
                                value={settings.preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                                options={[
                                  { id: 'auto', label: t('settingsPage.tzAutoDetect') },
                                  { id: 'America/New_York', label: 'Eastern (US)' },
                                  { id: 'America/Chicago', label: 'Central (US)' },
                                  { id: 'America/Denver', label: 'Mountain (US)' },
                                  { id: 'America/Los_Angeles', label: 'Pacific (US)' },
                                  { id: 'America/Sao_Paulo', label: 'Brazil (BRT)' },
                                  { id: 'Europe/London', label: 'London (GMT/BST)' },
                                  { id: 'Europe/Paris', label: 'Paris (CET)' },
                                  { id: 'Europe/Berlin', label: 'Berlin (CET)' },
                                  { id: 'Asia/Dubai', label: 'Dubai (GST)' },
                                  { id: 'Asia/Kolkata', label: 'India (IST)' },
                                  { id: 'Asia/Singapore', label: 'Singapore (SGT)' },
                                  { id: 'Asia/Tokyo', label: 'Tokyo (JST)' },
                                  { id: 'Australia/Sydney', label: 'Sydney (AEST)' },
                                ]}
                                onChange={(v) => handleSettingChange('preferences.timezone', v === 'auto' ? Intl.DateTimeFormat().resolvedOptions().timeZone : v)}
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
                                <h2 className="text-4xl font-black tracking-tighter text-surface-900 dark:text-white uppercase italic leading-none">{t('settingsPage.tabAgentic')}</h2>
                                <p className="text-base font-bold text-surface-500 dark:text-slate-400 italic uppercase tracking-tight">{t('settingsPage.agenticSubtitle')}</p>
                             </div>
                          </header>
                          
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                             <div className="space-y-8">
                                <ToggleControl label={t('settingsPage.autonomousMode')} description={t('settingsPage.autonomousModeDesc')}
                                  value={settings.agentic.autonomousSwarm} onChange={(v) => handleSettingChange('agentic.autonomousSwarm', v)} />
                                <ToggleControl label={t('settingsPage.autoPublish')} description={t('settingsPage.autoPublishDesc')}
                                  value={settings.agentic.slaAutoFulfill} onChange={(v) => handleSettingChange('agentic.slaAutoFulfill', v)} />
                             </div>

                             <div className="p-10 rounded-[3.5rem] bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 space-y-12 shadow-inner backdrop-blur-xl group/range">
                                <div className="flex justify-between items-center">
                                   <div className="space-y-3">
                                      <p className="text-2xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic leading-none">{t('settingsPage.confidenceThreshold')}</p>
                                      <p className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest italic leading-none">{t('settingsPage.confidenceThresholdDesc')}</p>
                                   </div>
                                   <span className="text-6xl font-black text-primary-500 tabular-nums italic group-hover/range:scale-110 transition-transform">{settings.agentic.predictiveThreshold}%</span>
                                </div>
                                <div className="relative pt-4">
                                   <input type="range" min="0" max="100" value={settings.agentic.predictiveThreshold}
                                     title={t('settingsPage.confidenceThreshold')}
                                     aria-label={t('settingsPage.confidenceThreshold')}
                                     onChange={(e) => handleSettingChange('agentic.predictiveThreshold', parseInt(e.target.value))}
                                     className="w-full h-3 bg-surface-card dark:bg-surface-800 rounded-full appearance-none cursor-pointer accent-primary-500 shadow-inner"
                                   />
                                   <div className="flex justify-between mt-6">
                                      <span className="text-[10px] font-black text-surface-300 dark:text-slate-800 italic uppercase tracking-widest">{t('settingsPage.experimental')}</span>
                                      <span className="text-[10px] font-black text-primary-500 italic uppercase tracking-widest">{t('settingsPage.stable')}</span>
                                   </div>
                                </div>
                             </div>
                          </div>

                          <div className="space-y-8">
                            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-surface-900 dark:text-white border-b border-surface-100 dark:border-surface-800 pb-6">{t('settingsPage.digitalTwinIntegration')}</h3>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                              <DropdownControl label={t('settingsPage.digitalTwinProvider')} description={t('settingsPage.digitalTwinProviderDesc')}
                                value={settings.agentic.digitalTwinProvider || 'both'}
                                options={[
                                  { id: 'heygen', label: t('settingsPage.providerHeygen') },
                                  { id: 'sora', label: t('settingsPage.providerSora') },
                                  { id: 'both', label: t('settingsPage.providerBoth') },
                                ]}
                                onChange={(v) => handleSettingChange('agentic.digitalTwinProvider', v)}
                              />
                              <div className="flex flex-col gap-8 p-10 rounded-[3.5rem] bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 shadow-inner">
                                <div className="space-y-3">
                                  <span className="text-xl font-black text-surface-900 dark:text-white uppercase italic tracking-tighter leading-none">{t('settingsPage.apiKeys')}</span>
                                  <span className="text-[12px] font-bold text-surface-400 dark:text-slate-600 italic uppercase tracking-tight">{t('settingsPage.apiKeysDesc')}</span>
                                </div>
                                <input type="password" placeholder={t('settingsPage.heygenApiKey')} aria-label={t('settingsPage.heygenApiKey')}
                                  value={settings.agentic.heygenApiKey || ''}
                                  onChange={(e) => handleSettingChange('agentic.heygenApiKey', e.target.value)}
                                  className="w-full bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 px-6 py-4 rounded-[1.5rem] text-sm font-black text-surface-900 dark:text-white focus:border-primary-500 outline-none transition-all"
                                />
                                <input type="password" placeholder={t('settingsPage.soraApiKey')} aria-label={t('settingsPage.soraApiKey')}
                                  value={settings.agentic.soraApiKey || ''}
                                  onChange={(e) => handleSettingChange('agentic.soraApiKey', e.target.value)}
                                  className="w-full bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 px-6 py-4 rounded-[1.5rem] text-sm font-black text-surface-900 dark:text-white focus:border-primary-500 outline-none transition-all"
                                />
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
                                <h2 className="text-4xl font-black tracking-tighter text-surface-900 dark:text-white uppercase italic leading-none">{t('settingsPage.brandKit')}</h2>
                                <p className="text-base font-bold text-surface-500 dark:text-slate-400 italic uppercase tracking-tight">{t('settingsPage.brandKitSubtitle')}</p>
                             </div>
                          </header>

                          {brandKitLoading ? (
                            <div className="flex flex-col items-center justify-center py-40 bg-surface-page dark:bg-surface-950/30 rounded-[4rem] border-4 border-dashed border-surface-100 dark:border-surface-800 shadow-inner">
                              <RefreshCw className="w-20 h-20 text-primary-500 animate-spin mb-10" />
                              <p className="text-[12px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[1em] animate-pulse italic">{t('settingsPage.loadingBrandKit')}</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                               <div className="space-y-12">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                     <div className="space-y-6">
                                        <label className="text-[11px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.5em] italic pl-4">{t('settingsPage.primaryColor')}</label>
                                        <div className="flex items-center gap-6 p-6 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-[2.2rem] shadow-inner backdrop-blur-xl group/color hover:border-primary-500/30 transition-all">
                                           <div className="relative w-14 h-14 flex-shrink-0 overflow-hidden rounded-[1.2rem] border-2 border-surface-200 dark:border-surface-800 shadow-lg">
                                              <input type="color"
                                                title={t('settingsPage.primaryColor')}
                                                aria-label={t('settingsPage.primaryColor')}
                                                value={brandKit.primaryColor || '#6366f1'} 
                                                onChange={(e) => updateBrandKitField('primaryColor', e.target.value)} 
                                                className="absolute inset-[-15px] w-[180%] h-[180%] cursor-pointer p-0" 
                                              />
                                           </div>
                                           <input type="text" value={brandKit.primaryColor || ''} onChange={(e) => updateBrandKitField('primaryColor', e.target.value)} className="bg-transparent border-none text-lg font-black text-surface-900 dark:text-white focus:outline-none w-full uppercase italic tracking-tighter" placeholder="#FFFFFF" />
                                        </div>
                                     </div>
                                     <div className="space-y-6">
                                        <label className="text-[11px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.5em] italic pl-4">{t('settingsPage.accentColor')}</label>
                                        <div className="flex items-center gap-6 p-6 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-[2.2rem] shadow-inner backdrop-blur-xl group/color hover:border-primary-500/30 transition-all">
                                           <div className="relative w-14 h-14 flex-shrink-0 overflow-hidden rounded-[1.2rem] border-2 border-surface-200 dark:border-surface-800 shadow-lg">
                                              <input type="color" value={brandKit.accentColor || '#8b5cf6'} onChange={(e) => updateBrandKitField('accentColor', e.target.value)} aria-label={t('settingsPage.accentColor')} title={t('settingsPage.accentColor')} className="absolute inset-[-15px] w-[180%] h-[180%] cursor-pointer p-0" />
                                           </div>
                                           <input type="text" value={brandKit.accentColor || ''} onChange={(e) => updateBrandKitField('accentColor', e.target.value)} className="bg-transparent border-none text-lg font-black text-surface-900 dark:text-white focus:outline-none w-full uppercase italic tracking-tighter" placeholder="#000000" />
                                        </div>
                                     </div>
                                  </div>
                                  <DropdownControl label={t('settingsPage.headlineFont')} description={t('settingsPage.headlineFontDesc')}
                                    value={brandKit.titleFont || ''} options={FONT_OPTIONS.map(o => ({id: o.value, label: o.value === '' ? t('settingsPage.fontDefault') : o.label}))}
                                    onChange={(v) => updateBrandKitField('titleFont', v)} />
                                  <DropdownControl label={t('settingsPage.bodyFont')} description={t('settingsPage.bodyFontDesc')}
                                    value={brandKit.bodyFont || ''} options={FONT_OPTIONS.map(o => ({id: o.value, label: o.value === '' ? t('settingsPage.fontDefault') : o.label}))}
                                    onChange={(v) => updateBrandKitField('bodyFont', v)} />
                               </div>

                               <div className="space-y-12">
                                  <DropdownControl label={t('settingsPage.lowerThirdStyle')} description={t('settingsPage.lowerThirdStyleDesc')}
                                    value={brandKit.lowerThirdStyle || ''} options={[{id:'', label:t('settingsPage.none')}, {id:'bar', label:t('settingsPage.lowerThirdBar')}, {id:'pill', label:t('settingsPage.lowerThirdPill')}, {id:'minimal', label:t('settingsPage.lowerThirdMinimal')}]}
                                    onChange={(v) => updateBrandKitField('lowerThirdStyle', v)} />
                                  <DropdownControl label={t('settingsPage.logoPlacement')} description={t('settingsPage.logoPlacementDesc')}
                                    value={brandKit.logoPlacement || ''} options={[{id:'', label:t('settingsPage.logoHidden')}, {id:'top-left', label:t('settingsPage.logoTopLeft')}, {id:'top-right', label:t('settingsPage.logoTopRight')}, {id:'bottom-right', label:t('settingsPage.logoBottomRight')}]}
                                    onChange={(v) => updateBrandKitField('logoPlacement', v)} />
                                  
                                  <div className="col-span-full flex justify-end pt-8">
                                     <button type="button" onClick={saveBrandKit} disabled={brandKitSaving}
                                       className="w-full px-12 py-7 bg-primary-600 text-white font-black uppercase text-[12px] tracking-[0.8em] italic rounded-[2.5rem] hover:bg-primary-500 transition-all shadow-[0_25px_60px_rgba(99,102,241,0.4)] flex items-center justify-center gap-8 active:scale-95 border-none group/save"
                                     >
                                       {brandKitSaving ? <RefreshCw className="animate-spin" size={28} /> : <CheckCircle2 size={28} className="group-hover:scale-125 transition-transform" />}
                                       {brandKitSaving ? t('settingsPage.saving') : t('settingsPage.saveBrandKit')}
                                     </button>
                                  </div>
                               </div>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'videoEditing' && (
                        <div className="space-y-16">
                          <header className="flex items-center gap-10">
                             <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg hover:rotate-12 transition-transform duration-500">
                                <Sliders className="text-primary-600 dark:text-primary-400" size={40} />
                             </div>
                             <div className="space-y-3">
                                <h2 className="text-4xl font-black tracking-tighter text-surface-900 dark:text-white uppercase italic leading-none">{t('settingsPage.videoDefaults')}</h2>
                                <p className="text-base font-bold text-surface-500 dark:text-slate-400 italic uppercase tracking-tight">{t('settingsPage.videoDefaultsSubtitle')}</p>
                             </div>
                          </header>

                          {/* Section 1: AI Edit Style */}
                          <div className="space-y-8">
                            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-surface-900 dark:text-white border-b border-surface-100 dark:border-surface-800 pb-6">{t('settingsPage.aiEditStyle')}</h3>
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                               <DropdownControl
                                  label={t('settingsPage.voiceTone')}
                                  description={t('settingsPage.voiceToneDesc')}
                                  value={settings.videoEditing?.preferredVoiceTone || 'Hype'}
                                  options={[
                                    { id: 'Hype', label: t('settingsPage.voiceHype') },
                                    { id: 'Storyteller', label: t('settingsPage.voiceStoryteller') },
                                    { id: 'Educational', label: t('settingsPage.voiceEducational') },
                                    { id: 'Professional', label: t('settingsPage.voiceProfessional') },
                                    { id: 'Casual', label: t('settingsPage.voiceCasual') },
                                    { id: 'Aggressive', label: t('settingsPage.voiceAggressive') },
                                    { id: 'Calm', label: t('settingsPage.voiceCalm') },
                                    { id: 'Motivational', label: t('settingsPage.voiceMotivational') },
                                    { id: 'Conversational', label: t('settingsPage.voiceConversational') },
                                    { id: 'Authoritative', label: t('settingsPage.voiceAuthoritative') },
                                  ]}
                                  onChange={(v) => handleSettingChange('videoEditing.preferredVoiceTone', v)}
                                />

                               <DropdownControl
                                  label={t('settingsPage.hookArchetype')}
                                  description={t('settingsPage.hookArchetypeDesc')}
                                  value={settings.videoEditing?.preferredHookStyle || 'curiosity-gap'}
                                  options={[
                                    { id: 'curiosity-gap', label: t('settingsPage.hookCuriosityGap') },
                                    { id: 'list-tease', label: t('settingsPage.hookListTease') },
                                    { id: 'visual-first', label: t('settingsPage.hookVisualFirst') },
                                    { id: 'question-based', label: t('settingsPage.hookQuestionBased') },
                                    { id: 'bold-statement', label: t('settingsPage.hookBoldStatement') },
                                    { id: 'before-after', label: t('settingsPage.hookBeforeAfter') },
                                    { id: 'enemy-frame', label: t('settingsPage.hookEnemyFrame') },
                                    { id: 'authority-proof', label: t('settingsPage.hookAuthorityProof') },
                                    { id: 'shock-reveal', label: t('settingsPage.hookShockReveal') },
                                  ]}
                                  onChange={(v) => handleSettingChange('videoEditing.preferredHookStyle', v)}
                                />

                               <DropdownControl
                                  label={t('settingsPage.pacingSpeed')}
                                  description={t('settingsPage.pacingSpeedDesc')}
                                  value={settings.videoEditing?.pacingIntensity || 'medium'}
                                  options={[
                                    { id: 'gentle', label: t('settingsPage.pacingGentle') },
                                    { id: 'medium', label: t('settingsPage.pacingMedium') },
                                    { id: 'aggressive', label: t('settingsPage.pacingAggressive') }
                                  ]}
                                  onChange={(v) => handleSettingChange('videoEditing.pacingIntensity', v)}
                                />
                            </div>
                          </div>

                          {/* Section 2: Platform & Tone Defaults */}
                          <div className="space-y-8">
                            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-surface-900 dark:text-white border-b border-surface-100 dark:border-surface-800 pb-6">{t('settingsPage.platformToneDefaults')}</h3>
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                              <DropdownControl
                                label={t('settingsPage.defaultPlatform')}
                                description={t('settingsPage.defaultPlatformDesc')}
                                value={settings.videoEditing?.defaultPlatform || 'auto'}
                                options={[
                                  { id: 'auto', label: t('settingsPage.platformAutoDetect') },
                                  { id: 'tiktok', label: t('settingsPage.platformTiktok') },
                                  { id: 'instagram', label: t('settingsPage.platformInstagram') },
                                  { id: 'youtube', label: t('settingsPage.platformYoutube') },
                                  { id: 'linkedin', label: t('settingsPage.platformLinkedin') },
                                ]}
                                onChange={(v) => handleSettingChange('videoEditing.defaultPlatform', v)}
                              />
                              <DropdownControl
                                label={t('settingsPage.contentTone')}
                                description={t('settingsPage.contentToneDesc')}
                                value={settings.videoEditing?.contentTone || 'auto'}
                                options={[
                                  { id: 'auto', label: t('settingsPage.contentToneAuto') },
                                  { id: 'educational', label: t('settingsPage.contentToneEducational') },
                                  { id: 'entertaining', label: t('settingsPage.contentToneEntertaining') },
                                  { id: 'motivational', label: t('settingsPage.contentToneMotivational') },
                                  { id: 'promotional', label: t('settingsPage.contentTonePromotional') },
                                ]}
                                onChange={(v) => handleSettingChange('videoEditing.contentTone', v)}
                              />
                              <DropdownControl
                                label={t('settingsPage.musicGenre')}
                                description={t('settingsPage.musicGenreDesc')}
                                value={settings.videoEditing?.musicGenre || 'auto'}
                                options={[
                                  { id: 'auto', label: t('settingsPage.musicAuto') },
                                  { id: 'phonk', label: t('settingsPage.musicPhonk') },
                                  { id: 'lofi', label: t('settingsPage.musicLofi') },
                                  { id: 'dark_ambient', label: t('settingsPage.musicDarkAmbient') },
                                  { id: 'synthwave', label: t('settingsPage.musicSynthwave') },
                                  { id: 'upbeat_pop', label: t('settingsPage.musicUpbeatPop') },
                                  { id: 'cinematic', label: t('settingsPage.musicCinematic') },
                                  { id: 'breakcore', label: t('settingsPage.musicBreakcore') },
                                ]}
                                onChange={(v) => handleSettingChange('videoEditing.musicGenre', v)}
                              />
                            </div>
                          </div>

                          {/* Section 3: Captions & Aesthetics */}
                          <div className="space-y-8">
                            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-surface-900 dark:text-white border-b border-surface-100 dark:border-surface-800 pb-6">{t('settingsPage.captionsAesthetics')}</h3>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                              <div className="space-y-10">
                                <DropdownControl
                                  label={t('settingsPage.captionAnimationStyle')}
                                  description={t('settingsPage.captionAnimationStyleDesc')}
                                  value={settings.videoEditing?.captionStyle || 'modern'}
                                  options={[
                                    { id: 'modern', label: t('settingsPage.captionModern') },
                                    { id: 'pop', label: t('settingsPage.captionPop') },
                                    { id: 'karaoke', label: t('settingsPage.captionKaraoke') },
                                    { id: 'classic', label: t('settingsPage.captionClassic') },
                                    { id: 'bold', label: t('settingsPage.captionBold') },
                                    { id: 'outline', label: t('settingsPage.captionOutline') },
                                  ]}
                                  onChange={(v) => handleSettingChange('videoEditing.captionStyle', v)}
                                />
                                <DropdownControl
                                  label={t('settingsPage.subtitlePosition')}
                                  description={t('settingsPage.subtitlePositionDesc')}
                                  value={settings.videoEditing?.subtitlePosition || 'auto'}
                                  options={[
                                    { id: 'auto', label: t('settingsPage.subtitleAuto') },
                                    { id: 'top', label: t('settingsPage.subtitleTop') },
                                    { id: 'middle', label: t('settingsPage.subtitleMiddle') },
                                    { id: 'bottom', label: t('settingsPage.subtitleBottom') },
                                    { id: 'lower-third', label: t('settingsPage.subtitleLowerThird') },
                                  ]}
                                  onChange={(v) => handleSettingChange('videoEditing.subtitlePosition', v)}
                                />
                              </div>
                              <div className="space-y-10">
                                <div className="p-10 rounded-[3.5rem] bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 space-y-8 shadow-inner backdrop-blur-xl group/size">
                                   <div className="flex justify-between items-center">
                                      <div className="space-y-2">
                                         <p className="text-xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic leading-none">{t('settingsPage.captionFontScale')}</p>
                                         <p className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest italic leading-none">{t('settingsPage.captionFontScaleDesc')}</p>
                                      </div>
                                      <span className="text-4xl font-black text-primary-500 tabular-nums italic group-hover/size:scale-110 transition-transform">{(settings.videoEditing?.captionFontScale || 1.0).toFixed(1)}x</span>
                                   </div>
                                   <input type="range" min="0.5" max="2.0" step="0.1"
                                     value={settings.videoEditing?.captionFontScale || 1.0}
                                     title={t('settingsPage.captionFontScale')} aria-label={t('settingsPage.captionFontScale')}
                                     onChange={(e) => handleSettingChange('videoEditing.captionFontScale', parseFloat(e.target.value))}
                                     className="w-full h-3 bg-surface-card dark:bg-surface-800 rounded-full appearance-none cursor-pointer accent-primary-500 shadow-inner"
                                   />
                                   <div className="flex justify-between">
                                     <span className="text-[9px] font-black text-surface-300 dark:text-slate-800 italic uppercase tracking-widest">{t('settingsPage.scaleCompact')}</span>
                                     <span className="text-[9px] font-black text-primary-500 italic uppercase tracking-widest">{t('settingsPage.scaleNormal')}</span>
                                     <span className="text-[9px] font-black text-surface-300 dark:text-slate-800 italic uppercase tracking-widest">{t('settingsPage.scaleHeavy')}</span>
                                   </div>
                                </div>
                                <div className="p-10 rounded-[3.5rem] bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 space-y-8 shadow-inner backdrop-blur-xl group/offset">
                                   <div className="flex justify-between items-center">
                                      <div className="space-y-2">
                                         <p className="text-xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic leading-none">{t('settingsPage.captionVerticalOffset')}</p>
                                         <p className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest italic leading-none">{t('settingsPage.captionVerticalOffsetDesc')}</p>
                                      </div>
                                      <span className="text-4xl font-black text-primary-500 tabular-nums italic group-hover/offset:scale-110 transition-transform">{settings.videoEditing?.captionVerticalOffset || 0}px</span>
                                   </div>
                                   <input type="range" min="-200" max="200" step="10"
                                     value={settings.videoEditing?.captionVerticalOffset || 0}
                                     title={t('settingsPage.captionVerticalOffset')} aria-label={t('settingsPage.captionVerticalOffset')}
                                     onChange={(e) => handleSettingChange('videoEditing.captionVerticalOffset', parseInt(e.target.value))}
                                     className="w-full h-3 bg-surface-card dark:bg-surface-800 rounded-full appearance-none cursor-pointer accent-primary-500 shadow-inner"
                                   />
                                   <div className="flex justify-between">
                                     <span className="text-[9px] font-black text-surface-300 dark:text-slate-800 italic uppercase tracking-widest">{t('settingsPage.offsetLower')}</span>
                                     <span className="text-[9px] font-black text-primary-500 italic uppercase tracking-widest">{t('settingsPage.offsetDefault')}</span>
                                     <span className="text-[9px] font-black text-surface-300 dark:text-slate-800 italic uppercase tracking-widest">{t('settingsPage.offsetHigher')}</span>
                                   </div>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                              <DropdownControl
                                label={t('settingsPage.colorGradePreset')}
                                description={t('settingsPage.colorGradePresetDesc')}
                                value={settings.videoEditing?.aestheticColorGrade || 'vibrant'}
                                options={[
                                  { id: 'vibrant', label: t('settingsPage.gradeVibrant') },
                                  { id: 'cyberpunk_neon', label: t('settingsPage.gradeCyberpunkNeon') },
                                  { id: 'vintage_film', label: t('settingsPage.gradeVintageFilm') },
                                  { id: 'hyper_pop', label: t('settingsPage.gradeHyperPop') },
                                  { id: 'cinematic', label: t('settingsPage.gradeCinematic') },
                                  { id: 'monochrome', label: t('settingsPage.gradeMonochrome') },
                                  { id: 'dreamy_pastel', label: t('settingsPage.gradeDreamyPastel') },
                                  { id: 'none', label: t('settingsPage.gradeNone') }
                                ]}
                                onChange={(v) => handleSettingChange('videoEditing.aestheticColorGrade', v)}
                              />
                              <DropdownControl
                                label={t('settingsPage.transitionsArchetype')}
                                description={t('settingsPage.transitionsArchetypeDesc')}
                                value={settings.videoEditing?.aestheticTransition || 'fade'}
                                options={[
                                  { id: 'fade', label: t('settingsPage.transitionFade') },
                                  { id: 'slide', label: t('settingsPage.transitionSlide') },
                                  { id: 'zoom', label: t('settingsPage.transitionZoom') },
                                  { id: 'glitch', label: t('settingsPage.transitionGlitch') },
                                  { id: 'whip', label: t('settingsPage.transitionWhip') },
                                  { id: 'dissolve', label: t('settingsPage.transitionDissolve') },
                                  { id: 'none', label: t('settingsPage.transitionNone') }
                                ]}
                                onChange={(v) => handleSettingChange('videoEditing.aestheticTransition', v)}
                              />
                            </div>
                          </div>

                          {/* Section 4: Feature Flags */}
                          <div className="space-y-8">
                            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-surface-900 dark:text-white border-b border-surface-100 dark:border-surface-800 pb-6">{t('settingsPage.featureFlags')}</h3>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                              <ToggleControl
                                label={t('settingsPage.neuralSpeedRamping')}
                                description={t('settingsPage.neuralSpeedRampingDesc')}
                                value={settings.videoEditing?.enableSpeedRamping ?? true}
                                onChange={(v) => handleSettingChange('videoEditing.enableSpeedRamping', v)}
                              />
                              <ToggleControl
                                label={t('settingsPage.brollOverlay')}
                                description={t('settingsPage.brollOverlayDesc')}
                                value={settings.videoEditing?.enableBRoll ?? true}
                                onChange={(v) => handleSettingChange('videoEditing.enableBRoll', v)}
                              />
                            </div>
                            {(settings.videoEditing?.enableBRoll ?? true) && (
                              <DropdownControl
                                label={t('settingsPage.brollFrequency')}
                                description={t('settingsPage.brollFrequencyDesc')}
                                value={settings.videoEditing?.brollFrequency || 'balanced'}
                                options={[
                                  { id: 'minimal', label: t('settingsPage.brollMinimal') },
                                  { id: 'balanced', label: t('settingsPage.brollBalanced') },
                                  { id: 'heavy', label: t('settingsPage.brollHeavy') },
                                ]}
                                onChange={(v) => handleSettingChange('videoEditing.brollFrequency', v)}
                              />
                            )}
                          </div>
                        </div>
                      )}

                      {activeTab === 'notifications' && (
                        <div className="space-y-16">
                          <header className="flex items-center gap-10">
                             <div className="w-20 h-20 rounded-[2.5rem] bg-rose-500/10 border-2 border-rose-500/20 flex items-center justify-center shadow-lg">
                                <Bell className="text-rose-500" size={40} />
                             </div>
                             <div className="space-y-3">
                                <h2 className="text-4xl font-black tracking-tighter text-surface-900 dark:text-white uppercase italic leading-none">{t('settingsPage.tabNotifications')}</h2>
                                <p className="text-base font-bold text-surface-500 dark:text-slate-400 italic uppercase tracking-tight">{t('settingsPage.notificationsSubtitle')}</p>
                             </div>
                          </header>

                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                             <div className="space-y-10">
                                <ToggleControl label={t('settingsPage.notifEmail')} description={t('settingsPage.notifEmailDesc')}
                                  value={settings.notifications.email} onChange={(v) => handleSettingChange('notifications.email', v)} />
                                <ToggleControl label={t('settingsPage.notifPush')} description={t('settingsPage.notifPushDesc')}
                                  value={settings.notifications.push} onChange={(v) => handleSettingChange('notifications.push', v)} />
                             </div>
                             <div className="space-y-10">
                                <ToggleControl label={t('settingsPage.notifContentReady')} description={t('settingsPage.notifContentReadyDesc')}
                                  value={settings.notifications.contentReady} onChange={(v) => handleSettingChange('notifications.contentReady', v)} />
                                <ToggleControl label={t('settingsPage.notifMentions')} description={t('settingsPage.notifMentionsDesc')}
                                  value={settings.notifications.mentions ?? true} onChange={(v) => handleSettingChange('notifications.mentions', v)} />
                             </div>
                          </div>

                          <div className="space-y-8">
                            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-surface-900 dark:text-white border-b border-surface-100 dark:border-surface-800 pb-6">{t('settingsPage.activityAlerts')}</h3>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                              <ToggleControl label={t('settingsPage.weeklyDigest')} description={t('settingsPage.weeklyDigestDesc')}
                                value={settings.notifications.weeklyDigest} onChange={(v) => handleSettingChange('notifications.weeklyDigest', v)} />
                              <ToggleControl label={t('settingsPage.achievements')} description={t('settingsPage.achievementsDesc')}
                                value={settings.notifications.achievements ?? true} onChange={(v) => handleSettingChange('notifications.achievements', v)} />
                              <ToggleControl label={t('settingsPage.comments')} description={t('settingsPage.commentsDesc')}
                                value={settings.notifications.comments ?? false} onChange={(v) => handleSettingChange('notifications.comments', v)} />
                            </div>
                          </div>

                          <div className="space-y-8">
                            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-surface-900 dark:text-white border-b border-surface-100 dark:border-surface-800 pb-6">{t('settingsPage.deliverySettings')}</h3>
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                              <DropdownControl label={t('settingsPage.alertPriority')} description={t('settingsPage.alertPriorityDesc')}
                                value={settings.notifications.priorityTiers || 'all'}
                                options={[
                                  { id: 'all', label: t('settingsPage.priorityAll') },
                                  { id: 'high_medium', label: t('settingsPage.priorityHighMedium') },
                                  { id: 'high_only', label: t('settingsPage.priorityHighOnly') },
                                ]}
                                onChange={(v) => handleSettingChange('notifications.priorityTiers', v)}
                              />
                              <DropdownControl label={t('settingsPage.digestMode')} description={t('settingsPage.digestModeDesc')}
                                value={settings.notifications.digestMode || 'immediate'}
                                options={[
                                  { id: 'immediate', label: t('settingsPage.digestImmediate') },
                                  { id: 'daily', label: t('settingsPage.digestDaily') },
                                  { id: 'weekly', label: t('settingsPage.digestWeekly') },
                                ]}
                                onChange={(v) => handleSettingChange('notifications.digestMode', v)}
                              />
                              <div className="flex flex-col gap-6 p-10 rounded-[3.5rem] bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 shadow-inner">
                                <div className="space-y-2">
                                  <span className="text-xl font-black text-surface-900 dark:text-white uppercase italic tracking-tighter leading-none">{t('settingsPage.digestTime')}</span>
                                  <span className="text-[12px] font-bold text-surface-400 dark:text-slate-600 italic uppercase tracking-tight">{t('settingsPage.digestTimeDesc')}</span>
                                </div>
                                <input type="time" aria-label={t('settingsPage.digestDeliveryTime')}
                                  value={settings.notifications.digestTime || '09:00'}
                                  onChange={(e) => handleSettingChange('notifications.digestTime', e.target.value)}
                                  className="w-full bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 px-6 py-4 rounded-[1.5rem] text-sm font-black text-surface-900 dark:text-white focus:border-primary-500 outline-none transition-all"
                                />
                              </div>
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
                                <h2 className="text-4xl font-black tracking-tighter text-surface-900 dark:text-white uppercase italic leading-none">{t('settingsPage.tabPrivacy')}</h2>
                                <p className="text-base font-bold text-surface-500 dark:text-slate-400 italic uppercase tracking-tight">{t('settingsPage.privacySubtitle')}</p>
                             </div>
                          </header>

                          <div className="max-w-4xl space-y-10">
                             <ToggleControl label={t('settingsPage.anonymousAnalytics')} description={t('settingsPage.anonymousAnalyticsDesc')}
                               value={settings.privacy.analyticsConsent} onChange={(v) => handleSettingChange('privacy.analyticsConsent', v)} />
                             <ToggleControl label={t('settingsPage.useContentImproveAi')} description={t('settingsPage.useContentImproveAiDesc')}
                               value={settings.privacy.dataConsent} onChange={(v) => handleSettingChange('privacy.dataConsent', v)} />
                          </div>
                        </div>
                      )}

                      {activeTab === 'trust' && (
                        <div className="space-y-16">
                          <header className="flex items-center gap-10">
                            <div className="w-20 h-20 rounded-[2.5rem] bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center shadow-lg">
                              <ShieldCheck size={40} className="text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="space-y-3">
                              <h2 className="text-4xl font-black tracking-tighter text-surface-900 dark:text-white uppercase italic leading-none">{t('settingsPage.tabTrust')}</h2>
                              <p className="text-base font-bold text-surface-500 dark:text-slate-400 italic uppercase tracking-tight">{t('settingsPage.trustSubtitle')}</p>
                            </div>
                          </header>

                          {trustLoading && (
                            <div className="flex items-center justify-center py-32">
                              <Fingerprint size={56} className="text-primary-500 animate-spin" />
                            </div>
                          )}

                          {!trustLoading && trustData && (
                            <div className="max-w-4xl space-y-12">
                              {/* Score Gauge */}
                              <div className="p-12 rounded-[4rem] bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 shadow-inner flex flex-col sm:flex-row items-center gap-12">
                                <div className="relative flex-shrink-0">
                                  <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
                                    <circle cx="70" cy="70" r="58" fill="none" stroke="currentColor" strokeWidth="12" className="text-surface-100 dark:text-surface-800" />
                                    <circle cx="70" cy="70" r="58" fill="none" strokeWidth="12"
                                      strokeDasharray={`${2 * Math.PI * 58}`}
                                      strokeDashoffset={`${2 * Math.PI * 58 * (1 - (trustData.score || 0) / 100)}`}
                                      strokeLinecap="round"
                                      className={trustData.levelColor === 'violet' ? 'stroke-violet-500' : trustData.levelColor === 'emerald' ? 'stroke-emerald-500' : trustData.levelColor === 'sky' ? 'stroke-sky-500' : 'stroke-amber-500'}
                                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
                                    <span className="text-4xl font-black text-surface-900 dark:text-white leading-none">{trustData.score}</span>
                                    <span className="text-[10px] font-black text-surface-400 uppercase tracking-widest">/ 100</span>
                                  </div>
                                </div>
                                <div className="flex-1 space-y-4">
                                  <div className={`inline-flex items-center gap-3 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border ${
                                    trustData.levelColor === 'violet' ? 'bg-violet-500/10 text-violet-500 border-violet-500/20' :
                                    trustData.levelColor === 'emerald' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                    trustData.levelColor === 'sky' ? 'bg-sky-500/10 text-sky-500 border-sky-500/20' :
                                    'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                  }`}>
                                    <ShieldCheck size={14} />
                                    {t('settingsPage.levelCreator', { level: trustData.level })}
                                  </div>
                                  <p className="text-sm font-bold text-surface-500 dark:text-slate-400 italic uppercase tracking-tight leading-relaxed">
                                    {trustData.level === 'Elite' ? t('settingsPage.trustBlurbElite') :
                                     trustData.level === 'Trusted' ? t('settingsPage.trustBlurbTrusted') :
                                     trustData.level === 'Established' ? t('settingsPage.trustBlurbEstablished') :
                                     t('settingsPage.trustBlurbDefault')}
                                  </p>
                                </div>
                              </div>

                              {/* Signal Breakdown */}
                              <div className="space-y-4">
                                <h3 className="text-xl font-black uppercase italic tracking-tighter text-surface-900 dark:text-white">{t('settingsPage.scoreBreakdown')}</h3>
                                {trustData.breakdown.map((item: any) => (
                                  <div key={item.signal} className="flex items-center gap-6 p-6 rounded-[2rem] bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${item.achieved ? 'bg-emerald-500/10 text-emerald-500' : 'bg-surface-200 dark:bg-surface-800 text-surface-400'}`}>
                                      {item.achieved ? <Check size={16} /> : <AlertCircle size={16} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-[12px] font-black uppercase italic tracking-tight text-surface-900 dark:text-white">{item.label}</span>
                                        <span className="text-[11px] font-black text-surface-400 tabular-nums">{t('settingsPage.pointsOf', { points: item.points, max: item.maxPoints })}</span>
                                      </div>
                                      <div className="h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-700 ${item.achieved ? 'bg-emerald-500' : 'bg-primary-500/50'}`}
                                          style={{ width: `${Math.round((item.points / item.maxPoints) * 100)}%` }} />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Next Steps */}
                              {trustData.nextSteps.length > 0 && (
                                <div className="space-y-4">
                                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-surface-900 dark:text-white">{t('settingsPage.howToImprove')}</h3>
                                  {trustData.nextSteps.map((step: any) => (
                                    <div key={step.signal} className="flex items-start gap-6 p-8 rounded-[2rem] bg-primary-500/5 border-2 border-primary-500/15 hover:border-primary-500/30 transition-all">
                                      <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Sparkles size={18} className="text-primary-500" />
                                      </div>
                                      <div className="flex-1">
                                        <p className="text-[12px] font-black uppercase italic tracking-tight text-surface-900 dark:text-white mb-1">{step.label}</p>
                                        <p className="text-[11px] font-bold text-surface-500 dark:text-slate-400 italic leading-relaxed">{step.hint}</p>
                                      </div>
                                      <span className="text-[10px] font-black text-primary-500 bg-primary-500/10 px-3 py-1 rounded-lg flex-shrink-0">{t('settingsPage.gainPoints', { gain: step.potentialGain })}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {!trustLoading && !trustData && (
                            <div className="flex flex-col items-center justify-center py-24 text-center">
                              <ShieldQuestion size={64} className="text-surface-300 dark:text-surface-700 mb-8" />
                              <p className="text-base font-black uppercase italic tracking-tight text-surface-400">{t('settingsPage.trustUnavailable')}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'security' && (
                        <div className="space-y-16">
                          <header className="flex items-center gap-10">
                             <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center shadow-lg">
                                <Shield size={40} className="text-indigo-600 dark:text-indigo-400" />
                             </div>
                             <div className="space-y-3">
                                <h2 className="text-4xl font-black tracking-tighter text-surface-900 dark:text-white uppercase italic leading-none">{t('settingsPage.tabSecurity')}</h2>
                                <p className="text-base font-bold text-surface-500 dark:text-slate-400 italic uppercase tracking-tight">{t('settingsPage.securitySubtitle')}</p>
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
                                       <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400 uppercase tracking-tighter italic leading-none mb-1">{t('settingsPage.dangerZone')}</h3>
                                       <p className="text-[10px] font-black text-rose-500/40 uppercase tracking-[0.5em] italic">{t('settingsPage.irreversibleActions')}</p>
                                    </div>
                                 </div>
                                 <p className="text-base font-bold text-surface-500 dark:text-slate-400 leading-relaxed border-l-4 border-rose-500/40 pl-10 relative z-10 italic uppercase tracking-tight max-w-3xl">
                                   {t('settingsPage.deleteAccountWarning')}
                                 </p>
                                 <button
                                   type="button"
                                   onClick={deactivateAccount}
                                   className="px-12 py-6 bg-rose-600 text-white font-black uppercase text-[12px] tracking-[0.8em] italic rounded-[2rem] hover:bg-rose-700 transition-all shadow-[0_25px_60px_rgba(225,29,72,0.4)] active:scale-95 border-none relative z-10 group-hover/danger:-translate-y-2"
                                 >
                                   {t('settingsPage.deleteAccount')}
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
                          {autoSaveStatus === 'saved' ? t('settingsPage.saved') : autoSaveStatus === 'saving' ? t('settingsPage.saving') : t('settingsPage.idle')}
                       </span>
                    </div>
                    <button type="button" onClick={() => saveSettings()} disabled={saving}
                      className="w-full sm:w-auto px-20 py-7 bg-surface-900 dark:bg-white text-white dark:text-black font-black uppercase text-[14px] tracking-[1em] italic rounded-[3rem] hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all shadow-[0_35px_100px_rgba(0,0,0,0.5)] disabled:opacity-50 active:scale-95 flex items-center justify-center gap-8 border-none group/commit"
                    >
                      {saving ? <RefreshCw className="animate-spin" size={32} /> : <Lock size={32} className="group-hover/commit:rotate-12 transition-transform" />}
                      {saving ? t('settingsPage.saving') : t('settingsPage.saveAllSettings')}
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
