'use client'

import { loginPathForCurrentPage } from '../../../lib/authRedirect'
import { useEffect, useState, useRef, useCallback, useMemo, createContext, useContext } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import axios from 'axios'
import Link from 'next/link'
import {
  Settings, User, Lock, Bell, EyeOff, Palette, Sliders, Sparkles, Plug,
  CreditCard, Search, Plus, Trash2, Check, ChevronRight,
  Monitor, Sun, Moon, ArrowLeft, KeyRound, Gauge, ShieldAlert, LayoutGrid,
  RefreshCw, Bot, X,
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
import { API_URL, apiPost, apiDelete, handleApiError } from '../../../lib/api'
import { cn } from '../../../lib/utils'
import { useContainerWidth } from '../../../hooks/useContainerWidth'
import { useWorkspacePrefs } from '../../../hooks/useWorkspacePrefs'
import { FormField, Input } from '../../../components/ui/form-field'
import { Switch } from '../../../components/ui/switch'
import { Slider } from '../../../components/ui/slider'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { PageShell } from '../../../components/ui'
import MorningBriefSettings from '../../../components/settings/MorningBriefSettings'
import AccountSecurityPanel from '../../../components/settings/AccountSecurityPanel'

/* ── Types ─────────────────────────────────────────────────────────────── */

interface AppearanceSettings {
  theme: 'light' | 'dark' | 'auto'
  density: 'comfortable' | 'compact'
  reducedMotion: boolean
  accent?: string
}
interface AiSettings {
  provider: 'auto' | 'claude' | 'gemini'
  creativity: number
  autoApply: boolean
}
interface IntegrationEntry {
  provider: string
  label?: string
  last4: string
  createdAt?: string | null
}

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
  appearance: AppearanceSettings
  ai: AiSettings
  integrations: IntegrationEntry[]
  agentic: {
    autonomousSwarm: boolean; slaAutoFulfill: boolean; predictiveThreshold: number;
    digitalTwinProvider: 'heygen' | 'sora' | 'both';
    // The saved keys never come back from the server: only whether one is
    // set and its last 4 characters. A typed key is sent once, then cleared.
    heygenApiKey?: string; soraApiKey?: string;
    heygenApiKeySet?: boolean; heygenApiKeyLast4?: string;
    soraApiKeySet?: boolean; soraApiKeyLast4?: string;
  }
  videoEditing?: Record<string, any>
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

const FONT_OPTIONS: { value: string; label: string; labelKey?: string }[] = [
  { value: '', label: 'Default', labelKey: 'settingsPage.fontDefault' },
  { value: 'Inter', label: 'Inter' }, { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' }, { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' }, { value: 'Poppins', label: 'Poppins' },
  { value: 'Georgia', label: 'Georgia' }, { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Oswald', label: 'Oswald' }, { value: 'Bebas Neue', label: 'Bebas Neue' },
]

const INTEGRATION_PROVIDERS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic (Claude)' },
  { id: 'gemini', label: 'Google Gemini' },
  { id: 'elevenlabs', label: 'ElevenLabs' },
  { id: 'heygen', label: 'HeyGen' },
  { id: 'runway', label: 'Runway' },
  { id: 'stability', label: 'Stability AI' },
  { id: 'replicate', label: 'Replicate' },
]
const PROVIDER_LABEL: Record<string, string> = Object.fromEntries(INTEGRATION_PROVIDERS.map(p => [p.id, p.label]))

function isValidLang(l: string): l is SupportedLanguage {
  return supportedLanguages.includes(l as SupportedLanguage)
}

function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  window.dispatchEvent(new CustomEvent('toast', { detail: { message, type } }))
}

/* ── Section registry (drives nav + search index) ──────────────────────── */

type SectionId =
  | 'profile' | 'security' | 'notifications' | 'privacy' | 'appearance'
  | 'editing' | 'automation' | 'ai' | 'brand' | 'integrations' | 'billing'

interface SectionDef {
  id: SectionId
  /** i18n key for the section's name */
  labelKey: string
  icon: React.ReactNode
  /** keywords used by the settings search */
  keywords: string[]
}

const SECTIONS: SectionDef[] = [
  { id: 'profile', labelKey: 'settingsPage.nav.profile', icon: <User size={18} />, keywords: ['profile', 'name', 'avatar', 'account info'] },
  { id: 'security', labelKey: 'settingsPage.nav.security', icon: <Lock size={18} />, keywords: ['password', 'security', 'change password', 'two-factor', '2fa', 'two-step', 'authenticator', 'sessions', 'devices', 'sign out', 'delete account', 'danger'] },
  { id: 'notifications', labelKey: 'settingsPage.tabNotifications', icon: <Bell size={18} />, keywords: ['notifications', 'email', 'push', 'digest', 'alerts', 'mentions'] },
  { id: 'privacy', labelKey: 'settingsPage.tabPrivacy', icon: <EyeOff size={18} />, keywords: ['privacy', 'analytics', 'consent', 'data', 'marketing'] },
  { id: 'appearance', labelKey: 'settingsPage.nav.appearance', icon: <Palette size={18} />, keywords: ['theme', 'dark', 'light', 'density', 'compact', 'motion', 'accent', 'appearance', 'display', 'language', 'timezone', 'workspace', 'pinned', 'sidebar', 'landing', 'start page'] },
  { id: 'editing', labelKey: 'settingsPage.nav.editing', icon: <Sliders size={18} />, keywords: ['video', 'editing', 'captions', 'pacing', 'hook', 'voice', 'music', 'broll', 'platform'] },
  { id: 'automation', labelKey: 'settingsPage.nav.automation', icon: <Bot size={18} />, keywords: ['automation', 'agentic', 'agent', 'autonomous', 'swarm', 'sla', 'auto-fulfill', 'predictive', 'threshold', 'digital twin', 'heygen', 'sora', 'avatar'] },
  { id: 'ai', labelKey: 'settingsPage.nav.ai', icon: <Sparkles size={18} />, keywords: ['ai', 'provider', 'claude', 'gemini', 'creativity', 'auto apply', 'model'] },
  { id: 'brand', labelKey: 'settingsPage.nav.brand', icon: <LayoutGrid size={18} />, keywords: ['brand', 'colors', 'fonts', 'logo', 'lower third'] },
  { id: 'integrations', labelKey: 'settingsPage.nav.integrations', icon: <Plug size={18} />, keywords: ['integrations', 'api key', 'keys', 'openai', 'anthropic', 'connect'] },
  { id: 'billing', labelKey: 'settingsPage.nav.billing', icon: <CreditCard size={18} />, keywords: ['billing', 'subscription', 'plan', 'payment', 'invoice'] },
]

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { setLanguage, t } = useTranslation()
  const { setTheme } = useTheme()
  const { ref: shellRef, width } = useContainerWidth<HTMLDivElement>()
  const isNarrow = width > 0 && width < 860

  const [loading, setLoading] = useState(true)
  // True when the saved settings could not be loaded. The form then shows
  // defaults, so saving is blocked: a save would overwrite the real values.
  const [loadError, setLoadError] = useState(false)
  const [savingSection, setSavingSection] = useState<SectionId | null>(null)
  const initialLoadDoneRef = useRef(false)

  const tabFromUrl = (searchParams.get('tab') || '') as string
  const initialSection: SectionId =
    SECTIONS.some(s => s.id === tabFromUrl) ? (tabFromUrl as SectionId) : 'profile'
  const [activeSection, setActiveSection] = useState<SectionId>(initialSection)
  const [query, setQuery] = useState('')

  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      email: true, push: true, contentReady: true, weeklyDigest: false,
      achievements: true, mentions: true, comments: false,
      priorityTiers: 'all', digestMode: 'immediate', digestTime: '09:00',
    },
    privacy: { dataConsent: true, marketingConsent: false, analyticsConsent: true },
    preferences: { theme: 'auto', language: 'en', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    appearance: { theme: 'auto', density: 'comfortable', reducedMotion: false, accent: '' },
    ai: { provider: 'auto', creativity: 0.5, autoApply: false },
    integrations: [],
    agentic: { autonomousSwarm: true, slaAutoFulfill: true, predictiveThreshold: 85, digitalTwinProvider: 'both' },
    videoEditing: {
      preferredVoiceTone: 'Hype', preferredHookStyle: 'curiosity-gap', pacingIntensity: 'medium',
      captionStyle: 'modern', captionFontScale: 1.0, captionVerticalOffset: 0,
      aestheticColorGrade: 'vibrant', aestheticTransition: 'fade', subtitlePosition: 'auto',
      contentTone: 'auto', brollFrequency: 'balanced', musicGenre: 'auto', defaultPlatform: 'auto',
      enableSpeedRamping: true, enableBRoll: true,
    },
  })

  const [brandKit, setBrandKit] = useState<BrandKit>(DEFAULT_BRAND_KIT)
  const [brandKitLoading, setBrandKitLoading] = useState(false)
  const [brandKitSaving, setBrandKitSaving] = useState(false)

  /* ── Load ── */
  const loadSettings = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) { router.push(loginPathForCurrentPage()); return }
      const response = await axios.get(`${API_URL}/user/settings`, { headers: { Authorization: `Bearer ${token}` } })
      const data = extractApiData<UserSettings>(response)
      if (!data || typeof data !== 'object') throw new Error('empty settings response')
      setLoadError(false)
      setSettings(prev => ({ ...prev, ...data }))
      if (data.preferences?.language && isValidLang(data.preferences.language)) setLanguage(data.preferences.language)
      // Apply persisted appearance to the live document.
      applyAppearance(data.appearance)
    } catch (error: any) {
      if (error.response?.status === 401) { router.push(loginPathForCurrentPage()); return }
      setLoadError(true)
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
      if ((e as any)?.response?.status === 401) router.push(loginPathForCurrentPage())
    } finally { setBrandKitLoading(false) }
  }, [router])

  useEffect(() => { loadSettings().then(() => { initialLoadDoneRef.current = true }) }, [loadSettings])
  useEffect(() => { if (activeSection === 'brand') loadBrandKit() }, [activeSection, loadBrandKit])

  /* ── Appearance live-apply (density + reduced motion as data-attrs) ── */
  function applyAppearance(a?: Partial<AppearanceSettings>) {
    if (!a || typeof document === 'undefined') return
    const root = document.documentElement
    if (a.density) root.setAttribute('data-density', a.density)
    if (typeof a.reducedMotion === 'boolean') {
      root.setAttribute('data-reduced-motion', a.reducedMotion ? 'true' : 'false')
    }
    if (a.accent) root.style.setProperty('--user-accent', a.accent)
  }

  /* ── State setters ── */
  const setField = useCallback((path: string, value: any) => {
    setSettings(prev => {
      const next: any = { ...prev }
      const keys = path.split('.')
      let cur = next
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...(cur[keys[i]] || {}) }
        cur = cur[keys[i]]
      }
      cur[keys[keys.length - 1]] = value
      return next
    })
  }, [])

  /* ── Per-section save (only sends that section's payload) ── */
  const saveSection = useCallback(async (section: SectionId, payload: Partial<UserSettings>) => {
    if (loadError) {
      toast(t('settingsPage.saveBlockedNotLoaded'), 'error')
      return
    }
    setSavingSection(section)
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const response = await axios.put(`${API_URL}/user/settings`, payload, { headers: { Authorization: `Bearer ${token}` } })
      // Pick up the server's masked view of the API keys (set / last 4) and
      // drop the typed key from memory.
      const saved = extractApiData<UserSettings>(response)
      if (saved?.agentic) setSettings(prev => ({ ...prev, agentic: { ...prev.agentic, ...saved.agentic, heygenApiKey: '', soraApiKey: '' } }))
      toast(t('settingsPage.toast.settingsSaved'), 'success')
    } catch (err) {
      toast(handleApiError(err) || t('settingsPage.toast.settingsSaveFailed'), 'error')
      throw err
    } finally { setSavingSection(null) }
  }, [loadError, t])

  /* ── Brand kit save ── */
  const saveBrandKit = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    setBrandKitSaving(true)
    try {
      await axios.put(`${API_URL}/pro-mode/brand-kit`, brandKit, { headers: { Authorization: `Bearer ${token}` } })
      toast(t('settingsPage.toast.brandKitUpdated'), 'success')
    } catch (e) {
      toast(handleApiError(e) || t('settingsPage.toast.brandKitUpdateFailed'), 'error')
    } finally { setBrandKitSaving(false) }
  }

  /* ── Account deactivation ── */
  const deactivateAccount = async () => {
    if (!window.confirm(t('settingsPage.security.deactivateConfirm'))) return
    const password = window.prompt(t('settingsPage.security.deactivatePasswordPrompt'))
    if (!password) { toast(t('settingsPage.toast.cancelled'), 'info'); return }
    try {
      await apiPost('/auth/deactivate', { password, reason: 'user_request' })
      toast(t('settingsPage.toast.accountDeactivated'), 'success')
      try { localStorage.removeItem('token') } catch (_) { /* best effort */ }
      setTimeout(() => router.push('/login'), 800)
    } catch (err: any) {
      toast(handleApiError(err) || t('settingsPage.toast.deactivateFailed'), 'error')
    }
  }

  /* ── Integrations ── */
  const addIntegration = async (provider: string, label: string, key: string) => {
    const res = await apiPost<{ data?: { integrations: IntegrationEntry[] } }>(
      '/user/settings/integrations', { provider, label, key }
    )
    const list = (res as any)?.data?.integrations || (res as any)?.integrations
    if (Array.isArray(list)) setField('integrations', list)
    toast(t('settingsPage.toast.apiKeyAdded'), 'success')
  }
  const removeIntegration = async (provider: string) => {
    const res = await apiDelete<{ data?: { integrations: IntegrationEntry[] } }>(
      `/user/settings/integrations/${encodeURIComponent(provider)}`
    )
    const list = (res as any)?.data?.integrations || (res as any)?.integrations
    if (Array.isArray(list)) setField('integrations', list)
    else setField('integrations', settings.integrations.filter(i => i.provider !== provider))
    toast(t('settingsPage.toast.apiKeyRemoved'), 'success')
  }

  /* ── Search → matching sections ── */
  // Section names in the active language (search matches the translated name).
  const sections = useMemo(() => SECTIONS.map(s => ({ ...s, label: t(s.labelKey) })), [t])

  const matchingSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return sections.filter(s =>
      s.label.toLowerCase().includes(q) || s.keywords.some(k => k.includes(q))
    ).map(s => s.id)
  }, [query, sections])

  const visibleSections = useMemo(
    () => (matchingSections ? sections.filter(s => matchingSections.includes(s.id)) : sections),
    [matchingSections, sections]
  )

  // If the active section is filtered out by search, jump to first match.
  useEffect(() => {
    if (matchingSections && matchingSections.length > 0 && !matchingSections.includes(activeSection)) {
      setActiveSection(matchingSections[0])
    }
  }, [matchingSections, activeSection])

  if (loading) return (
    <PageShell width="wide" className="ds-bg-mesh-soft min-h-screen" aria-busy="true">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </PageShell>
  )

  const activeDef = sections.find(s => s.id === activeSection)!

  return (
    <ErrorBoundary>
      <PageShell ref={shellRef} width="wide" className="ds-bg-mesh-soft min-h-screen">
        <ToastContainer />

        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
          <button
            type="button" onClick={() => router.push('/dashboard')}
            aria-label={t('settingsPage.header.backAria')}
            className="ds-surface-card h-11 w-11 inline-flex items-center justify-center rounded-xl text-theme-muted hover:text-theme-primary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 inline-flex items-center justify-center text-primary">
            <Settings size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="ds-text-h1 text-theme-primary leading-none">{t('settingsPage.title')}</h1>
            <p className="ds-text-caption mt-1">{t('settingsPage.header.subtitle')}</p>
          </div>
        </header>

        {/* Search */}
        <div className="relative mb-6 max-w-xl">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('settingsPage.header.searchPlaceholder')}
            aria-label={t('settingsPage.header.searchAria')}
            className="pl-9 ds-surface-card"
          />
        </div>

        <div className={cn('flex gap-8', isNarrow && 'flex-col gap-4')}>
          {/* Section nav */}
          {isNarrow ? (
            <nav className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" aria-label={t('settingsPage.nav.aria')}>
              {visibleSections.map(s => (
                <button
                  key={s.id} type="button" onClick={() => setActiveSection(s.id)}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    activeSection === s.id ? 'bg-primary text-primary-foreground' : 'ds-surface-card text-theme-secondary hover:text-theme-primary'
                  )}
                >
                  {s.icon}{s.label}
                </button>
              ))}
            </nav>
          ) : (
            <aside className="w-64 shrink-0">
              <nav className="ds-surface-card p-2 rounded-2xl sticky top-6 space-y-1" aria-label={t('settingsPage.nav.aria')}>
                {visibleSections.map(s => (
                  <button
                    key={s.id} type="button" onClick={() => setActiveSection(s.id)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-left',
                      activeSection === s.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-theme-secondary hover:bg-accent hover:text-theme-primary'
                    )}
                  >
                    <span className={cn(activeSection === s.id ? 'text-primary-foreground' : 'text-theme-muted')}>{s.icon}</span>
                    <span className="flex-1">{s.label}</span>
                    {activeSection === s.id && <ChevronRight size={16} />}
                  </button>
                ))}
                {visibleSections.length === 0 && (
                  <p className="px-3 py-4 ds-text-caption">{t('settingsPage.nav.noMatch', { query })}</p>
                )}
              </nav>
            </aside>
          )}

          {/* Content pane */}
          <main className="flex-1 min-w-0 ds-anim-fade-in" key={activeSection}>
            <div className="mb-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 inline-flex items-center justify-center text-primary">
                {activeDef.icon}
              </div>
              <h2 className="ds-text-h2 text-theme-primary">{activeDef.label}</h2>
            </div>

            {loadError && (
              <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
                <p className="ds-text-body text-theme-primary">{t('settingsPage.loadFailedSaveBlocked')}</p>
                <Button variant="secondary" size="sm" onClick={() => { setLoading(true); loadSettings() }}>
                  {t('common.retry')}
                </Button>
              </div>
            )}
            <SaveBlockedContext.Provider value={loadError}>
            {activeSection === 'profile' && <ProfileSection user={user} />}
            {activeSection === 'security' && <SecuritySection onDeactivate={deactivateAccount} />}
            {activeSection === 'notifications' && (
              <NotificationsSection
                settings={settings} setField={setField}
                saving={savingSection === 'notifications'}
                onSave={() => saveSection('notifications', { notifications: settings.notifications })}
              />
            )}
            {activeSection === 'privacy' && (
              <PrivacySection
                settings={settings} setField={setField}
                saving={savingSection === 'privacy'}
                onSave={() => saveSection('privacy', { privacy: settings.privacy })}
              />
            )}
            {activeSection === 'appearance' && (
              <AppearanceSection
                settings={settings} setField={setField}
                saving={savingSection === 'appearance'}
                onSave={async () => {
                  // Only the fields this form edits. `settings.preferences` is
                  // the snapshot loaded with the page, so it also carries the
                  // pinnedNav / defaultLanding of that moment — sending it back
                  // reverted every pin made since (WorkspaceSection saves those
                  // itself through useWorkspacePrefs).
                  const { theme, language, timezone } = settings.preferences
                  await saveSection('appearance', {
                    appearance: settings.appearance,
                    preferences: { theme, language, timezone },
                  })
                  applyAppearance(settings.appearance)
                  // Keep ThemeProvider in sync (auto → system).
                  setTheme(settings.appearance.theme === 'auto' ? 'system' : settings.appearance.theme)
                  if (isValidLang(settings.preferences.language)) setLanguage(settings.preferences.language)
                }}
                applyAppearance={applyAppearance}
              />
            )}
            {activeSection === 'editing' && (
              <EditingSection
                settings={settings} setField={setField}
                saving={savingSection === 'editing'}
                onSave={() => saveSection('editing', { videoEditing: settings.videoEditing })}
              />
            )}
            {activeSection === 'automation' && (
              <AutomationSection
                settings={settings} setField={setField}
                saving={savingSection === 'automation'}
                onSave={() => saveSection('automation', { agentic: settings.agentic })}
              />
            )}
            {activeSection === 'ai' && (
              <AiSection
                settings={settings} setField={setField}
                saving={savingSection === 'ai'}
                onSave={() => saveSection('ai', { ai: settings.ai })}
              />
            )}
            {activeSection === 'brand' && (
              <BrandSection
                brandKit={brandKit} setBrandKit={setBrandKit}
                loading={brandKitLoading} saving={brandKitSaving} onSave={saveBrandKit}
              />
            )}
            {activeSection === 'integrations' && (
              <IntegrationsSection
                integrations={settings.integrations}
                onAdd={addIntegration} onRemove={removeIntegration}
              />
            )}
            {activeSection === 'billing' && <BillingSection />}
            </SaveBlockedContext.Provider>
          </main>
        </div>
      </PageShell>
    </ErrorBoundary>
  )
}

/* ── Reusable primitives ───────────────────────────────────────────────── */

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('ds-surface-card p-5 sm:p-6', className)}>{children}</div>
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-theme-primary">{label}</p>
        {description && <p className="ds-text-caption mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}

function SelectRow({ label, description, value, options, onChange }: {
  label: string; description?: string; value: string; options: { id: string; label: string }[]; onChange: (v: string) => void
}) {
  return (
    <FormField label={label} hint={description}>
      <select
        value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
        className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </FormField>
  )
}

// Set while the saved settings failed to load: the sections' Save buttons are
// disabled so stale defaults can't overwrite the real settings.
const SaveBlockedContext = createContext(false)

function SaveBar({ saving, onSave, label, independent = false }: { saving: boolean; onSave: () => void; label?: string; independent?: boolean }) {
  const { t } = useTranslation()
  const blocked = useContext(SaveBlockedContext) && !independent
  return (
    <div className="flex justify-end pt-4 mt-2 border-t border-[var(--border-subtle)]">
      <Button variant="primary" onClick={onSave} loading={saving} disabled={blocked} leftIcon={!saving ? <Check size={16} /> : undefined}>
        {saving ? t('settingsPage.saving') : (label ?? t('settingsPage.saveBar.saveChanges'))}
      </Button>
    </div>
  )
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return <h3 className="ds-text-label text-theme-secondary uppercase tracking-wide mt-2 mb-1">{children}</h3>
}

/* ── Sections ──────────────────────────────────────────────────────────── */

function ProfileSection({ user }: { user: any }) {
  const { t } = useTranslation()
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground inline-flex items-center justify-center text-2xl font-bold">
          {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-theme-primary truncate">{user?.name || t('settingsPage.profile.fallbackName')}</p>
          <p className="ds-text-caption truncate">{user?.email || ''}</p>
        </div>
      </div>
      <p className="ds-text-caption mt-5">
        {t('settingsPage.profile.blurb')}
      </p>
      <div className="mt-4">
        <Link href="/dashboard/settings/profile">
          <Button variant="secondary" rightIcon={<ChevronRight size={16} />}>{t('settingsPage.editProfile')}</Button>
        </Link>
      </div>
    </Card>
  )
}

function SecuritySection({ onDeactivate }: { onDeactivate: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <Card>
        <SubHeader>{t('settingsPage.security.changePassword')}</SubHeader>
        <div className="mt-3">
          <ChangePasswordForm />
        </div>
      </Card>
      <Card>
        <SubHeader>{t('settingsPage.security.signInProtection')}</SubHeader>
        <div className="mt-3">
          <AccountSecurityPanel />
        </div>
      </Card>
      <Card className="border-rose-500/30">
        <div className="flex items-center gap-2 text-rose-500">
          <ShieldAlert size={18} />
          <h3 className="text-sm font-semibold">{t('settingsPage.dangerZone')}</h3>
        </div>
        <p className="ds-text-caption mt-2">
          {t('settingsPage.security.deactivateWarning')}
        </p>
        <div className="mt-4">
          <Button variant="destructive" onClick={onDeactivate} leftIcon={<Trash2 size={16} />}>
            {t('settingsPage.security.deactivateAccount')}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function NotificationsSection({ settings, setField, saving, onSave }: {
  settings: UserSettings; setField: (p: string, v: any) => void; saving: boolean; onSave: () => void
}) {
  const { t } = useTranslation()
  const n = settings.notifications
  return (
    <>
    <Card>
      <SubHeader>{t('settingsPage.notifications.channels')}</SubHeader>
      <div className="divide-y divide-[var(--border-subtle)]">
        <ToggleRow label={t('settingsPage.notifications.emailLabel')} description={t('settingsPage.notifications.emailDesc')} checked={!!n.email} onChange={v => setField('notifications.email', v)} />
        <ToggleRow label={t('settingsPage.notifications.pushLabel')} description={t('settingsPage.notifications.pushDesc')} checked={!!n.push} onChange={v => setField('notifications.push', v)} />
        <ToggleRow label={t('settingsPage.notifContentReady')} description={t('settingsPage.notifications.contentReadyDesc')} checked={!!n.contentReady} onChange={v => setField('notifications.contentReady', v)} />
        <ToggleRow label={t('settingsPage.notifMentions')} description={t('settingsPage.notifications.mentionsDesc')} checked={n.mentions ?? true} onChange={v => setField('notifications.mentions', v)} />
      </div>

      <SubHeader>{t('settingsPage.notifications.activity')}</SubHeader>
      <div className="divide-y divide-[var(--border-subtle)]">
        <ToggleRow label={t('settingsPage.notifications.weeklyDigestLabel')} description={t('settingsPage.notifications.weeklyDigestDesc')} checked={!!n.weeklyDigest} onChange={v => setField('notifications.weeklyDigest', v)} />
        <ToggleRow label={t('settingsPage.achievements')} checked={n.achievements ?? true} onChange={v => setField('notifications.achievements', v)} />
        <ToggleRow label={t('settingsPage.comments')} checked={n.comments ?? false} onChange={v => setField('notifications.comments', v)} />
      </div>

      <SubHeader>{t('settingsPage.notifications.delivery')}</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
        <SelectRow label={t('settingsPage.notifications.alertPriority')} value={n.priorityTiers || 'all'}
          options={[{ id: 'all', label: t('settingsPage.notifications.priorityAll') }, { id: 'high_medium', label: t('settingsPage.notifications.priorityHighMedium') }, { id: 'high_only', label: t('settingsPage.notifications.priorityHighOnly') }]}
          onChange={v => setField('notifications.priorityTiers', v)} />
        <SelectRow label={t('settingsPage.notifications.digestMode')} value={n.digestMode || 'immediate'}
          options={[{ id: 'immediate', label: t('settingsPage.notifications.digestImmediate') }, { id: 'daily', label: t('settingsPage.notifications.digestDaily') }, { id: 'weekly', label: t('settingsPage.notifications.digestWeekly') }]}
          onChange={v => setField('notifications.digestMode', v)} />
        <FormField label={t('settingsPage.notifications.digestTime')} hint={t('settingsPage.notifications.digestTimeHint')}>
          <Input type="time" value={n.digestTime || '09:00'} onChange={e => setField('notifications.digestTime', e.target.value)} aria-label={t('settingsPage.notifications.digestTime')} />
        </FormField>
      </div>

      <SaveBar saving={saving} onSave={onSave} />
    </Card>

    {/* Saves on its own (to the brief subscription), so it is a separate card. */}
    <Card className="mt-4">
      <SubHeader>{t('settingsPage.notifications.morningBrief')}</SubHeader>
      <MorningBriefSettings />
    </Card>
    </>
  )
}

function PrivacySection({ settings, setField, saving, onSave }: {
  settings: UserSettings; setField: (p: string, v: any) => void; saving: boolean; onSave: () => void
}) {
  const { t } = useTranslation()
  const p = settings.privacy
  return (
    <Card>
      <div className="divide-y divide-[var(--border-subtle)]">
        <ToggleRow label={t('settingsPage.privacy.analyticsLabel')} description={t('settingsPage.privacy.analyticsDesc')} checked={!!p.analyticsConsent} onChange={v => setField('privacy.analyticsConsent', v)} />
        <ToggleRow label={t('settingsPage.privacy.dataLabel')} description={t('settingsPage.privacy.dataDesc')} checked={!!p.dataConsent} onChange={v => setField('privacy.dataConsent', v)} />
        <ToggleRow label={t('settingsPage.privacy.marketingLabel')} description={t('settingsPage.privacy.marketingDesc')} checked={!!p.marketingConsent} onChange={v => setField('privacy.marketingConsent', v)} />
      </div>
      <SaveBar saving={saving} onSave={onSave} />
    </Card>
  )
}

function AppearanceSection({ settings, setField, saving, onSave, applyAppearance }: {
  settings: UserSettings; setField: (p: string, v: any) => void; saving: boolean; onSave: () => void
  applyAppearance: (a?: Partial<AppearanceSettings>) => void
}) {
  const { t } = useTranslation()
  const a = settings.appearance
  const themeOpts: { id: AppearanceSettings['theme']; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: t('settingsPage.themeLight'), icon: <Sun size={18} /> },
    { id: 'dark', label: t('settingsPage.themeDark'), icon: <Moon size={18} /> },
    { id: 'auto', label: t('settingsPage.appearance.themeSystem'), icon: <Monitor size={18} /> },
  ]
  return (
    <Card>
      <SubHeader>{t('settingsPage.theme')}</SubHeader>
      <div className="grid grid-cols-3 gap-3 mt-2">
        {themeOpts.map(o => (
          <button
            key={o.id} type="button"
            onClick={() => { setField('appearance.theme', o.id); setField('preferences.theme', o.id) }}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors',
              a.theme === o.id ? 'border-primary bg-primary/10 text-primary' : 'border-input text-theme-secondary hover:bg-accent'
            )}
            aria-pressed={a.theme === o.id ? 'true' : 'false'}
          >
            {o.icon}{o.label}
          </button>
        ))}
      </div>

      <SubHeader>{t('settingsPage.appearance.display')}</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <SelectRow label={t('settingsPage.appearance.density')} description={t('settingsPage.appearance.densityDesc')} value={a.density}
          options={[{ id: 'comfortable', label: t('settingsPage.appearance.densityComfortable') }, { id: 'compact', label: t('settingsPage.appearance.densityCompact') }]}
          onChange={v => { setField('appearance.density', v); applyAppearance({ ...a, density: v as any }) }} />
        <FormField label={t('settingsPage.accentColor')} hint={t('settingsPage.appearance.accentHint')}>
          <div className="flex items-center gap-3">
            <input type="color" aria-label={t('settingsPage.accentColor')}
              value={a.accent || '#6366f1'}
              onChange={e => { setField('appearance.accent', e.target.value); applyAppearance({ ...a, accent: e.target.value }) }}
              className="h-10 w-12 rounded-lg border border-input cursor-pointer bg-transparent" />
            <Input value={a.accent || ''} placeholder="#6366f1"
              onChange={e => setField('appearance.accent', e.target.value)} aria-label={t('settingsPage.appearance.accentHexAria')} />
          </div>
        </FormField>
      </div>

      <div className="mt-2">
        <ToggleRow
          label={t('settingsPage.appearance.reducedMotion')}
          description={t('settingsPage.appearance.reducedMotionDesc')}
          checked={!!a.reducedMotion}
          onChange={v => { setField('appearance.reducedMotion', v); applyAppearance({ ...a, reducedMotion: v }) }}
        />
      </div>

      {/* Workspace arrangement — stored on the account, so it follows the user
          to another browser or device rather than living in localStorage. */}
      <WorkspaceSection />

      <SubHeader>{t('settingsPage.appearance.regional')}</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <SelectRow label={t('settingsPage.language')} value={settings.preferences.language}
          options={supportedLanguages.map(l => ({ id: l, label: languageNames[l] }))}
          onChange={v => setField('preferences.language', v)} />
        <SelectRow label={t('settingsPage.timezone')} value={settings.preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
          options={[
            { id: 'America/New_York', label: t('settingsPage.appearance.tzEasternUs') }, { id: 'America/Chicago', label: t('settingsPage.appearance.tzCentralUs') },
            { id: 'America/Denver', label: t('settingsPage.appearance.tzMountainUs') }, { id: 'America/Los_Angeles', label: t('settingsPage.appearance.tzPacificUs') },
            { id: 'America/Sao_Paulo', label: t('settingsPage.appearance.tzBrazil') }, { id: 'Europe/London', label: t('settingsPage.appearance.tzLondon') },
            { id: 'Europe/Paris', label: t('settingsPage.appearance.tzParis') }, { id: 'Europe/Berlin', label: t('settingsPage.appearance.tzBerlin') },
            { id: 'Asia/Dubai', label: t('settingsPage.appearance.tzDubai') }, { id: 'Asia/Kolkata', label: t('settingsPage.appearance.tzIndia') },
            { id: 'Asia/Singapore', label: t('settingsPage.appearance.tzSingapore') }, { id: 'Asia/Tokyo', label: t('settingsPage.appearance.tzTokyo') },
            { id: 'Australia/Sydney', label: t('settingsPage.appearance.tzSydney') },
          ]}
          onChange={v => setField('preferences.timezone', v)} />
      </div>

      <SaveBar saving={saving} onSave={onSave} />
    </Card>
  )
}

/**
 * Workspace arrangement. These live on the ACCOUNT (UserSettings.preferences
 * via useWorkspacePrefs), not in localStorage, so a user's arrangement follows
 * them between browsers and devices — which is the whole point, and was not
 * true of any of Click's other UI customization.
 */
function WorkspaceSection() {
  const { t } = useTranslation()
  const { prefs, isPinned, togglePin, setDefaultLanding } = useWorkspacePrefs()

  // Somewhere to land other than Home. Kept to the primary destinations so this
  // can't strand a user on a page they rarely use.
  const LANDING_OPTIONS = [
    { id: '', label: t('settingsPage.workspace.landingHome') },
    { id: '/dashboard/forge', label: t('settingsPage.workspace.landingForge') },
    { id: '/dashboard/video', label: t('settingsPage.workspace.landingVideo') },
    { id: '/dashboard/clips/hub', label: t('settingsPage.workspace.landingClips') },
    { id: '/dashboard/scheduler', label: t('settingsPage.workspace.landingScheduler') },
    { id: '/dashboard/calendar', label: t('settingsPage.workspace.landingCalendar') },
    { id: '/dashboard/analytics', label: t('settingsPage.workspace.landingAnalytics') },
  ]

  return (
    <>
      <SubHeader>{t('settingsPage.workspace.title')}</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <SelectRow
          label={t('settingsPage.workspace.startOn')}
          description={t('settingsPage.workspace.startOnDesc')}
          value={prefs.defaultLanding}
          options={LANDING_OPTIONS}
          onChange={(v) => setDefaultLanding(v)}
        />
        <FormField label={t('settingsPage.workspace.pinned')} hint={t('settingsPage.workspace.pinnedHint')}>
          {prefs.pinnedNav.length === 0 ? (
            <p className="text-sm text-theme-muted">
              {t('settingsPage.workspace.pinnedEmpty')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {prefs.pinnedNav.map((path) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => togglePin(path)}
                  aria-label={t('settingsPage.workspace.unpinAria', { path })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2 py-1 text-xs text-theme-secondary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {path.replace('/dashboard/', '').replace('/dashboard', 'home') || 'home'}
                  <X size={12} aria-hidden />
                </button>
              ))}
            </div>
          )}
        </FormField>
      </div>
    </>
  )
}

function EditingSection({ settings, setField, saving, onSave }: {
  settings: UserSettings; setField: (p: string, v: any) => void; saving: boolean; onSave: () => void
}) {
  const { t } = useTranslation()
  const v = settings.videoEditing || {}
  return (
    <Card>
      <SubHeader>{t('settingsPage.editing.aiEditStyle')}</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
        <SelectRow label={t('settingsPage.editing.voiceTone')} value={v.preferredVoiceTone || 'Hype'}
          options={[{ id: 'Hype', label: t('settingsPage.editing.voiceHype') }, { id: 'Storyteller', label: t('settingsPage.editing.voiceStoryteller') }, { id: 'Educational', label: t('settingsPage.editing.voiceEducational') }, { id: 'Professional', label: t('settingsPage.editing.voiceProfessional') }, { id: 'Casual', label: t('settingsPage.editing.voiceCasual') }, { id: 'Aggressive', label: t('settingsPage.editing.voiceAggressive') }, { id: 'Calm', label: t('settingsPage.editing.voiceCalm') }, { id: 'Motivational', label: t('settingsPage.editing.voiceMotivational') }, { id: 'Conversational', label: t('settingsPage.editing.voiceConversational') }, { id: 'Authoritative', label: t('settingsPage.editing.voiceAuthoritative') }]}
          onChange={x => setField('videoEditing.preferredVoiceTone', x)} />
        <SelectRow label={t('settingsPage.editing.hookStyle')} value={v.preferredHookStyle || 'curiosity-gap'}
          options={[
            { id: 'curiosity-gap', label: t('settingsPage.editing.hookCuriosityGap') }, { id: 'list-tease', label: t('settingsPage.editing.hookListTease') },
            { id: 'visual-first', label: t('settingsPage.editing.hookVisualFirst') }, { id: 'question-based', label: t('settingsPage.editing.hookQuestionBased') },
            { id: 'bold-statement', label: t('settingsPage.editing.hookBoldStatement') }, { id: 'before-after', label: t('settingsPage.editing.hookBeforeAfter') },
            { id: 'enemy-frame', label: t('settingsPage.editing.hookEnemyFrame') }, { id: 'authority-proof', label: t('settingsPage.editing.hookAuthorityProof') },
            { id: 'shock-reveal', label: t('settingsPage.editing.hookShockReveal') },
          ]}
          onChange={x => setField('videoEditing.preferredHookStyle', x)} />
        <SelectRow label={t('settingsPage.editing.pacing')} value={v.pacingIntensity || 'medium'}
          options={[{ id: 'gentle', label: t('settingsPage.editing.pacingGentle') }, { id: 'medium', label: t('settingsPage.editing.pacingMedium') }, { id: 'aggressive', label: t('settingsPage.editing.pacingAggressive') }]}
          onChange={x => setField('videoEditing.pacingIntensity', x)} />
      </div>

      <SubHeader>{t('settingsPage.editing.platformTone')}</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
        <SelectRow label={t('settingsPage.editing.defaultPlatform')} value={v.defaultPlatform || 'auto'}
          options={[{ id: 'auto', label: t('settingsPage.platformAutoDetect') }, { id: 'tiktok', label: 'TikTok' }, { id: 'instagram', label: 'Instagram' }, { id: 'youtube', label: 'YouTube' }, { id: 'linkedin', label: 'LinkedIn' }]}
          onChange={x => setField('videoEditing.defaultPlatform', x)} />
        <SelectRow label={t('settingsPage.editing.contentTone')} value={v.contentTone || 'auto'}
          options={[{ id: 'auto', label: t('settingsPage.editing.auto') }, { id: 'educational', label: t('settingsPage.editing.toneEducational') }, { id: 'entertaining', label: t('settingsPage.editing.toneEntertaining') }, { id: 'motivational', label: t('settingsPage.editing.toneMotivational') }, { id: 'promotional', label: t('settingsPage.editing.tonePromotional') }]}
          onChange={x => setField('videoEditing.contentTone', x)} />
        <SelectRow label={t('settingsPage.editing.musicGenre')} value={v.musicGenre || 'auto'}
          options={[{ id: 'auto', label: t('settingsPage.editing.musicAuto') }, { id: 'phonk', label: t('settingsPage.editing.musicPhonk') }, { id: 'lofi', label: t('settingsPage.editing.musicLofi') }, { id: 'dark_ambient', label: t('settingsPage.editing.musicDarkAmbient') }, { id: 'synthwave', label: t('settingsPage.editing.musicSynthwave') }, { id: 'upbeat_pop', label: t('settingsPage.editing.musicUpbeatPop') }, { id: 'cinematic', label: t('settingsPage.editing.musicCinematic') }, { id: 'breakcore', label: t('settingsPage.editing.musicBreakcore') }]}
          onChange={x => setField('videoEditing.musicGenre', x)} />
      </div>

      <SubHeader>{t('settingsPage.editing.captions')}</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <SelectRow label={t('settingsPage.editing.captionStyle')} value={v.captionStyle || 'modern'}
          options={[{ id: 'modern', label: t('settingsPage.editing.captionModern') }, { id: 'pop', label: t('settingsPage.editing.captionPop') }, { id: 'karaoke', label: t('settingsPage.editing.captionKaraoke') }, { id: 'classic', label: t('settingsPage.editing.captionClassic') }, { id: 'bold', label: t('settingsPage.editing.captionBold') }, { id: 'outline', label: t('settingsPage.editing.captionOutline') }]}
          onChange={x => setField('videoEditing.captionStyle', x)} />
        <SelectRow label={t('settingsPage.editing.subtitlePosition')} value={v.subtitlePosition || 'auto'}
          options={[{ id: 'auto', label: t('settingsPage.editing.auto') }, { id: 'top', label: t('settingsPage.editing.subtitleTop') }, { id: 'middle', label: t('settingsPage.editing.subtitleMiddle') }, { id: 'bottom', label: t('settingsPage.editing.subtitleBottom') }, { id: 'lower-third', label: t('settingsPage.editing.subtitleLowerThird') }]}
          onChange={x => setField('videoEditing.subtitlePosition', x)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
        <FormField label={t('settingsPage.editing.captionFontScaleLabel', { value: (v.captionFontScale ?? 1.0).toFixed(1) })}>
          <Slider min={0.5} max={2.0} step={0.1} value={v.captionFontScale ?? 1.0}
            onValueChange={x => setField('videoEditing.captionFontScale', x)} aria-label={t('settingsPage.editing.captionFontScaleAria')} />
        </FormField>
        <FormField label={t('settingsPage.editing.captionVerticalOffsetLabel', { value: v.captionVerticalOffset ?? 0 })}>
          <Slider min={-200} max={200} step={10} value={v.captionVerticalOffset ?? 0}
            onValueChange={x => setField('videoEditing.captionVerticalOffset', x)} aria-label={t('settingsPage.editing.captionVerticalOffsetAria')} />
        </FormField>
      </div>

      <SubHeader>{t('settingsPage.editing.aesthetics')}</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <SelectRow label={t('settingsPage.editing.colorGrade')} value={v.aestheticColorGrade || 'vibrant'}
          options={[{ id: 'vibrant', label: t('settingsPage.editing.gradeVibrant') }, { id: 'cyberpunk_neon', label: t('settingsPage.editing.gradeCyberpunkNeon') }, { id: 'vintage_film', label: t('settingsPage.editing.gradeVintageFilm') }, { id: 'hyper_pop', label: t('settingsPage.editing.gradeHyperPop') }, { id: 'cinematic', label: t('settingsPage.editing.gradeCinematic') }, { id: 'monochrome', label: t('settingsPage.editing.gradeMonochrome') }, { id: 'dreamy_pastel', label: t('settingsPage.editing.gradeDreamyPastel') }, { id: 'none', label: t('settingsPage.editing.gradeNone') }]}
          onChange={x => setField('videoEditing.aestheticColorGrade', x)} />
        <SelectRow label={t('settingsPage.editing.transition')} value={v.aestheticTransition || 'fade'}
          options={[{ id: 'fade', label: t('settingsPage.editing.transitionFade') }, { id: 'slide', label: t('settingsPage.editing.transitionSlide') }, { id: 'zoom', label: t('settingsPage.editing.transitionZoom') }, { id: 'glitch', label: t('settingsPage.editing.transitionGlitch') }, { id: 'whip', label: t('settingsPage.editing.transitionWhip') }, { id: 'dissolve', label: t('settingsPage.editing.transitionDissolve') }, { id: 'none', label: t('settingsPage.editing.transitionNone') }]}
          onChange={x => setField('videoEditing.aestheticTransition', x)} />
      </div>

      <SubHeader>{t('settingsPage.editing.featureFlags')}</SubHeader>
      <div className="divide-y divide-[var(--border-subtle)]">
        <ToggleRow label={t('settingsPage.editing.speedRamping')} description={t('settingsPage.editing.speedRampingDesc')} checked={v.enableSpeedRamping ?? true} onChange={x => setField('videoEditing.enableSpeedRamping', x)} />
        <ToggleRow label={t('settingsPage.editing.brollOverlay')} description={t('settingsPage.editing.brollOverlayDesc')} checked={v.enableBRoll ?? true} onChange={x => setField('videoEditing.enableBRoll', x)} />
      </div>
      {(v.enableBRoll ?? true) && (
        <div className="mt-3">
          <SelectRow label={t('settingsPage.editing.brollFrequency')} value={v.brollFrequency || 'balanced'}
            options={[{ id: 'minimal', label: t('settingsPage.editing.brollMinimal') }, { id: 'balanced', label: t('settingsPage.editing.brollBalanced') }, { id: 'heavy', label: t('settingsPage.editing.brollHeavy') }]}
            onChange={x => setField('videoEditing.brollFrequency', x)} />
        </div>
      )}

      <SaveBar saving={saving} onSave={onSave} />
    </Card>
  )
}

function AutomationSection({ settings, setField, saving, onSave }: {
  settings: UserSettings; setField: (p: string, v: any) => void; saving: boolean; onSave: () => void
}) {
  const { t } = useTranslation()
  const g = settings.agentic
  return (
    <Card>
      <SubHeader>{t('settingsPage.automation.autonomousAgents')}</SubHeader>
      <div className="mt-2 divide-y divide-[var(--border-subtle)]">
        <ToggleRow label={t('settingsPage.automation.runWorkflows')}
          description={t('settingsPage.automation.runWorkflowsDesc')}
          checked={!!g.autonomousSwarm} onChange={v => setField('agentic.autonomousSwarm', v)} />
        <ToggleRow label={t('settingsPage.automation.slaAutoFulfill')}
          description={t('settingsPage.automation.slaAutoFulfillDesc')}
          checked={!!g.slaAutoFulfill} onChange={v => setField('agentic.slaAutoFulfill', v)} />
      </div>

      <div className="mt-5">
        <FormField label={t('settingsPage.automation.predictiveThresholdLabel', { value: Math.round(g.predictiveThreshold ?? 85) })}
          hint={t('settingsPage.automation.predictiveThresholdHint')}>
          <Slider min={0} max={100} step={1} value={g.predictiveThreshold ?? 85}
            onValueChange={v => setField('agentic.predictiveThreshold', Math.round(v))} aria-label={t('settingsPage.automation.predictiveThresholdAria')} />
        </FormField>
      </div>

      <div className="mt-5">
        <SubHeader>{t('settingsPage.automation.digitalTwin')}</SubHeader>
        <SelectRow label={t('settingsPage.automation.avatarProvider')} description={t('settingsPage.automation.avatarProviderDesc')}
          value={g.digitalTwinProvider}
          options={[{ id: 'heygen', label: 'HeyGen' }, { id: 'sora', label: 'Sora' }, { id: 'both', label: t('settingsPage.automation.providerBoth') }]}
          onChange={v => setField('agentic.digitalTwinProvider', v)} />

        {(g.digitalTwinProvider === 'heygen' || g.digitalTwinProvider === 'both') && (
          <div className="mt-4">
            <FormField label={t('settingsPage.automation.heygenKey')} hint={t('settingsPage.automation.heygenKeyHint')}>
              <Input type="password" autoComplete="off" placeholder={g.heygenApiKeySet ? t('settingsPage.apiKeySavedPlaceholder', { last4: g.heygenApiKeyLast4 || '' }) : 'hg_…'} value={g.heygenApiKey || ''}
                onChange={e => setField('agentic.heygenApiKey', e.target.value)} aria-label={t('settingsPage.automation.heygenKey')} />
            </FormField>
          </div>
        )}
        {(g.digitalTwinProvider === 'sora' || g.digitalTwinProvider === 'both') && (
          <div className="mt-4">
            <FormField label={t('settingsPage.automation.soraKey')} hint={t('settingsPage.automation.soraKeyHint')}>
              <Input type="password" autoComplete="off" placeholder={g.soraApiKeySet ? t('settingsPage.apiKeySavedPlaceholder', { last4: g.soraApiKeyLast4 || '' }) : 'sk-…'} value={g.soraApiKey || ''}
                onChange={e => setField('agentic.soraApiKey', e.target.value)} aria-label={t('settingsPage.automation.soraKey')} />
            </FormField>
          </div>
        )}
      </div>

      <SaveBar saving={saving} onSave={onSave} />
    </Card>
  )
}

function AiSection({ settings, setField, saving, onSave }: {
  settings: UserSettings; setField: (p: string, v: any) => void; saving: boolean; onSave: () => void
}) {
  const { t } = useTranslation()
  const a = settings.ai
  return (
    <Card>
      <SelectRow label={t('settingsPage.ai.provider')} description={t('settingsPage.ai.providerDesc')} value={a.provider}
        options={[{ id: 'auto', label: t('settingsPage.ai.providerAuto') }, { id: 'claude', label: 'Claude (Anthropic)' }, { id: 'gemini', label: 'Gemini (Google)' }]}
        onChange={v => setField('ai.provider', v)} />

      <div className="mt-5">
        <FormField label={t('settingsPage.ai.creativityLabel', { value: Math.round((a.creativity ?? 0.5) * 100) })} hint={t('settingsPage.ai.creativityHint')}>
          <Slider min={0} max={1} step={0.05} value={a.creativity ?? 0.5}
            onValueChange={v => setField('ai.creativity', v)} aria-label={t('settingsPage.ai.creativityAria')} />
        </FormField>
      </div>

      <div className="mt-4 divide-y divide-[var(--border-subtle)]">
        <ToggleRow label={t('settingsPage.ai.autoApply')}
          description={t('settingsPage.ai.autoApplyDesc')}
          checked={!!a.autoApply} onChange={v => setField('ai.autoApply', v)} />
      </div>

      <SaveBar saving={saving} onSave={onSave} />
    </Card>
  )
}

function BrandSection({ brandKit, setBrandKit, loading, saving, onSave }: {
  brandKit: BrandKit; setBrandKit: (b: BrandKit) => void; loading: boolean; saving: boolean; onSave: () => void
}) {
  const { t } = useTranslation()
  const upd = (field: keyof BrandKit, value: any) => setBrandKit({ ...brandKit, [field]: value })
  if (loading) return <Card><div className="flex items-center gap-3 py-10 justify-center text-theme-muted"><RefreshCw className="animate-spin" size={20} /> {t('settingsPage.loadingBrandKit')}</div></Card>
  return (
    <Card>
      <SubHeader>{t('settingsPage.brand.colors')}</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <FormField label={t('settingsPage.primaryColor')}>
          <div className="flex items-center gap-3">
            <input type="color" aria-label={t('settingsPage.primaryColor')} value={brandKit.primaryColor || '#6366f1'} onChange={e => upd('primaryColor', e.target.value)} className="h-10 w-12 rounded-lg border border-input cursor-pointer bg-transparent" />
            <Input value={brandKit.primaryColor || ''} placeholder="#6366f1" onChange={e => upd('primaryColor', e.target.value)} aria-label={t('settingsPage.brand.primaryHexAria')} />
          </div>
        </FormField>
        <FormField label={t('settingsPage.accentColor')}>
          <div className="flex items-center gap-3">
            <input type="color" aria-label={t('settingsPage.accentColor')} value={brandKit.accentColor || '#8b5cf6'} onChange={e => upd('accentColor', e.target.value)} className="h-10 w-12 rounded-lg border border-input cursor-pointer bg-transparent" />
            <Input value={brandKit.accentColor || ''} placeholder="#8b5cf6" onChange={e => upd('accentColor', e.target.value)} aria-label={t('settingsPage.brand.accentHexAria')} />
          </div>
        </FormField>
      </div>

      <SubHeader>{t('settingsPage.brand.typography')}</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <SelectRow label={t('settingsPage.headlineFont')} value={brandKit.titleFont || ''} options={FONT_OPTIONS.map(o => ({ id: o.value, label: o.labelKey ? t(o.labelKey) : o.label }))} onChange={v => upd('titleFont', v)} />
        <SelectRow label={t('settingsPage.bodyFont')} value={brandKit.bodyFont || ''} options={FONT_OPTIONS.map(o => ({ id: o.value, label: o.labelKey ? t(o.labelKey) : o.label }))} onChange={v => upd('bodyFont', v)} />
      </div>

      <SubHeader>{t('settingsPage.brand.layout')}</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <SelectRow label={t('settingsPage.lowerThirdStyle')} value={brandKit.lowerThirdStyle || ''}
          options={[{ id: '', label: t('settingsPage.none') }, { id: 'bar', label: t('settingsPage.brand.lowerThirdBar') }, { id: 'pill', label: t('settingsPage.brand.lowerThirdPill') }, { id: 'minimal', label: t('settingsPage.lowerThirdMinimal') }]}
          onChange={v => upd('lowerThirdStyle', v)} />
        <SelectRow label={t('settingsPage.logoPlacement')} value={brandKit.logoPlacement || ''}
          options={[{ id: '', label: t('settingsPage.logoHidden') }, { id: 'top-left', label: t('settingsPage.logoTopLeft') }, { id: 'top-right', label: t('settingsPage.logoTopRight') }, { id: 'bottom-right', label: t('settingsPage.logoBottomRight') }]}
          onChange={v => upd('logoPlacement', v)} />
      </div>

      <SaveBar saving={saving} onSave={onSave} label={t('settingsPage.saveBrandKit')} independent />
    </Card>
  )
}

function IntegrationsSection({ integrations, onAdd, onRemove }: {
  integrations: IntegrationEntry[]
  onAdd: (provider: string, label: string, key: string) => Promise<void>
  onRemove: (provider: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState(INTEGRATION_PROVIDERS[0].id)
  const [label, setLabel] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (keyValue.trim().length < 8) { setError(t('settingsPage.integrations.invalidKey')); return }
    setBusy(true)
    try {
      await onAdd(provider, label.trim(), keyValue.trim())
      setOpen(false); setKeyValue(''); setLabel(''); setProvider(INTEGRATION_PROVIDERS[0].id)
    } catch (e) {
      setError(handleApiError(e) || t('settingsPage.integrations.addFailed'))
    } finally { setBusy(false) }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <p className="ds-text-caption">
          {t('settingsPage.integrations.blurb')}
        </p>
        <Button variant="primary" size="sm" leftIcon={<Plus size={16} />} onClick={() => setOpen(true)}>{t('settingsPage.integrations.addKey')}</Button>
      </div>

      <div className="mt-5">
        {integrations.length === 0 ? (
          <EmptyState
            icon={Plug}
            title={t('settingsPage.integrations.emptyTitle')}
            description={t('settingsPage.integrations.emptyDesc')}
          />
        ) : (
          <ul className="space-y-2">
            {integrations.map(it => (
              <li key={it.provider} className="flex items-center justify-between gap-3 rounded-xl border border-input p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center"><KeyRound size={16} /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-theme-primary truncate">
                      {PROVIDER_LABEL[it.provider] || it.provider}
                      {it.label ? <span className="text-theme-muted font-normal"> · {it.label}</span> : null}
                    </p>
                    <p className="ds-text-caption">•••• •••• {it.last4 || '????'}</p>
                  </div>
                </div>
                <Button
                  variant="ghost" size="sm" loading={removing === it.provider}
                  onClick={async () => { setRemoving(it.provider); try { await onRemove(it.provider) } finally { setRemoving(null) } }}
                  aria-label={t('settingsPage.integrations.removeAria', { provider: it.provider })}
                  className="text-rose-500 hover:text-rose-600"
                >
                  <Trash2 size={16} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t('settingsPage.integrations.modalTitle')}
        description={t('settingsPage.integrations.modalDesc')}>
        <div className="space-y-4">
          <SelectRow label={t('settingsPage.integrations.provider')} value={provider} options={INTEGRATION_PROVIDERS}
            onChange={setProvider} />
          <FormField label={t('settingsPage.integrations.labelOptional')} hint={t('settingsPage.integrations.labelHint')}>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder={t('settingsPage.integrations.labelPlaceholder')} aria-label={t('settingsPage.integrations.labelAria')} />
          </FormField>
          <FormField label={t('settingsPage.integrations.apiKey')} error={error || undefined}>
            <Input type="password" value={keyValue} onChange={e => setKeyValue(e.target.value)} placeholder="sk-…" aria-label={t('settingsPage.integrations.apiKey')} autoComplete="off" />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" loading={busy} onClick={submit} leftIcon={!busy ? <Check size={16} /> : undefined}>{t('settingsPage.integrations.saveKey')}</Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}

function BillingSection() {
  const { t } = useTranslation()
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary inline-flex items-center justify-center"><Gauge size={18} /></div>
        <div>
          <p className="text-sm font-medium text-theme-primary">{t('settingsPage.billing.managePlan')}</p>
          <p className="ds-text-caption">{t('settingsPage.billing.managePlanDesc')}</p>
        </div>
      </div>
      <div className="mt-4">
        <Link href="/dashboard/billing">
          <Button variant="primary" rightIcon={<ChevronRight size={16} />}>{t('settingsPage.billing.open')}</Button>
        </Link>
      </div>
    </Card>
  )
}
