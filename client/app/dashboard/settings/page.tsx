'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import axios from 'axios'
import Link from 'next/link'
import {
  Settings, User, Lock, Bell, EyeOff, Palette, Sliders, Sparkles, Plug,
  CreditCard, Search, Plus, Trash2, Check, ChevronRight,
  Monitor, Sun, Moon, ArrowLeft, KeyRound, Gauge, ShieldAlert, LayoutGrid,
  RefreshCw, Bot,
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
import { FormField, Input } from '../../../components/ui/form-field'
import { Switch } from '../../../components/ui/switch'
import { Slider } from '../../../components/ui/slider'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'

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
    heygenApiKey?: string; soraApiKey?: string;
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

const FONT_OPTIONS = [
  { value: '', label: 'Default' },
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
  label: string
  icon: React.ReactNode
  /** keywords used by the settings search */
  keywords: string[]
}

const SECTIONS: SectionDef[] = [
  { id: 'profile', label: 'Profile', icon: <User size={18} />, keywords: ['profile', 'name', 'avatar', 'account info'] },
  { id: 'security', label: 'Account & Security', icon: <Lock size={18} />, keywords: ['password', 'security', 'change password', 'delete account', 'danger'] },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={18} />, keywords: ['notifications', 'email', 'push', 'digest', 'alerts', 'mentions'] },
  { id: 'privacy', label: 'Privacy', icon: <EyeOff size={18} />, keywords: ['privacy', 'analytics', 'consent', 'data', 'marketing'] },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={18} />, keywords: ['theme', 'dark', 'light', 'density', 'compact', 'motion', 'accent', 'appearance', 'display', 'language', 'timezone'] },
  { id: 'editing', label: 'Editing Defaults', icon: <Sliders size={18} />, keywords: ['video', 'editing', 'captions', 'pacing', 'hook', 'voice', 'music', 'broll', 'platform'] },
  { id: 'automation', label: 'Automation', icon: <Bot size={18} />, keywords: ['automation', 'agentic', 'agent', 'autonomous', 'swarm', 'sla', 'auto-fulfill', 'predictive', 'threshold', 'digital twin', 'heygen', 'sora', 'avatar'] },
  { id: 'ai', label: 'AI', icon: <Sparkles size={18} />, keywords: ['ai', 'provider', 'claude', 'gemini', 'creativity', 'auto apply', 'model'] },
  { id: 'brand', label: 'Brand Kit', icon: <LayoutGrid size={18} />, keywords: ['brand', 'colors', 'fonts', 'logo', 'lower third'] },
  { id: 'integrations', label: 'Integrations & API Keys', icon: <Plug size={18} />, keywords: ['integrations', 'api key', 'keys', 'openai', 'anthropic', 'connect'] },
  { id: 'billing', label: 'Billing', icon: <CreditCard size={18} />, keywords: ['billing', 'subscription', 'plan', 'payment', 'invoice'] },
]

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { setLanguage } = useTranslation()
  const { setTheme } = useTheme()
  const { ref: shellRef, width } = useContainerWidth<HTMLDivElement>()
  const isNarrow = width > 0 && width < 860

  const [loading, setLoading] = useState(true)
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
      if (!token) { router.push('/login'); return }
      const response = await axios.get(`${API_URL}/user/settings`, { headers: { Authorization: `Bearer ${token}` } })
      const data = extractApiData<UserSettings>(response)
      if (data) {
        setSettings(prev => ({ ...prev, ...data }))
        if (data.preferences?.language && isValidLang(data.preferences.language)) setLanguage(data.preferences.language)
        // Apply persisted appearance to the live document.
        applyAppearance(data.appearance)
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
    setSavingSection(section)
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      await axios.put(`${API_URL}/user/settings`, payload, { headers: { Authorization: `Bearer ${token}` } })
      toast('Settings saved', 'success')
    } catch (err) {
      toast(handleApiError(err) || 'Could not save settings', 'error')
      throw err
    } finally { setSavingSection(null) }
  }, [])

  /* ── Brand kit save ── */
  const saveBrandKit = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    setBrandKitSaving(true)
    try {
      await axios.put(`${API_URL}/pro-mode/brand-kit`, brandKit, { headers: { Authorization: `Bearer ${token}` } })
      toast('Brand kit updated', 'success')
    } catch (e) {
      toast(handleApiError(e) || 'Could not update brand kit', 'error')
    } finally { setBrandKitSaving(false) }
  }

  /* ── Account deactivation ── */
  const deactivateAccount = async () => {
    if (!window.confirm('Permanently deactivate your account? This cannot be undone.')) return
    const password = window.prompt('Enter your password to confirm')
    if (!password) { toast('Cancelled', 'info'); return }
    try {
      await apiPost('/auth/deactivate', { password, reason: 'user_request' })
      toast('Account deactivated', 'success')
      try { localStorage.removeItem('token') } catch (_) { /* best effort */ }
      setTimeout(() => router.push('/login'), 800)
    } catch (err: any) {
      toast(handleApiError(err) || 'Could not deactivate account', 'error')
    }
  }

  /* ── Integrations ── */
  const addIntegration = async (provider: string, label: string, key: string) => {
    const res = await apiPost<{ data?: { integrations: IntegrationEntry[] } }>(
      '/user/settings/integrations', { provider, label, key }
    )
    const list = (res as any)?.data?.integrations || (res as any)?.integrations
    if (Array.isArray(list)) setField('integrations', list)
    toast('API key added', 'success')
  }
  const removeIntegration = async (provider: string) => {
    const res = await apiDelete<{ data?: { integrations: IntegrationEntry[] } }>(
      `/user/settings/integrations/${encodeURIComponent(provider)}`
    )
    const list = (res as any)?.data?.integrations || (res as any)?.integrations
    if (Array.isArray(list)) setField('integrations', list)
    else setField('integrations', settings.integrations.filter(i => i.provider !== provider))
    toast('API key removed', 'success')
  }

  /* ── Search → matching sections ── */
  const matchingSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return SECTIONS.filter(s =>
      s.label.toLowerCase().includes(q) || s.keywords.some(k => k.includes(q))
    ).map(s => s.id)
  }, [query])

  const visibleSections = useMemo(
    () => (matchingSections ? SECTIONS.filter(s => matchingSections.includes(s.id)) : SECTIONS),
    [matchingSections]
  )

  // If the active section is filtered out by search, jump to first match.
  useEffect(() => {
    if (matchingSections && matchingSections.length > 0 && !matchingSections.includes(activeSection)) {
      setActiveSection(matchingSections[0])
    }
  }, [matchingSections, activeSection])

  if (loading) return (
    <div className="min-h-screen ds-bg-mesh-soft px-4 sm:px-8 pt-8 pb-24 max-w-[1500px] mx-auto" aria-busy="true">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  )

  const activeDef = SECTIONS.find(s => s.id === activeSection)!

  return (
    <ErrorBoundary>
      <div ref={shellRef} className="min-h-screen ds-bg-mesh-soft text-theme-primary px-4 sm:px-8 pt-8 pb-24 max-w-[1500px] mx-auto">
        <ToastContainer />

        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
          <button
            type="button" onClick={() => router.push('/dashboard')}
            aria-label="Back to dashboard"
            className="ds-surface-card h-11 w-11 inline-flex items-center justify-center rounded-xl text-theme-muted hover:text-theme-primary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 inline-flex items-center justify-center text-primary">
            <Settings size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="ds-text-h1 text-theme-primary leading-none">Settings</h1>
            <p className="ds-text-caption mt-1">Manage your account, workspace and AI preferences</p>
          </div>
        </header>

        {/* Search */}
        <div className="relative mb-6 max-w-xl">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings…"
            aria-label="Search settings"
            className="pl-9 ds-surface-card"
          />
        </div>

        <div className={cn('flex gap-8', isNarrow && 'flex-col gap-4')}>
          {/* Section nav */}
          {isNarrow ? (
            <nav className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" aria-label="Settings sections">
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
              <nav className="ds-surface-card p-2 rounded-2xl sticky top-6 space-y-1" aria-label="Settings sections">
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
                  <p className="px-3 py-4 ds-text-caption">No settings match “{query}”.</p>
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
                  await saveSection('appearance', {
                    appearance: settings.appearance,
                    preferences: settings.preferences,
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
          </main>
        </div>
      </div>
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

function SaveBar({ saving, onSave, label = 'Save changes' }: { saving: boolean; onSave: () => void; label?: string }) {
  return (
    <div className="flex justify-end pt-4 mt-2 border-t border-[var(--border-subtle)]">
      <Button variant="primary" onClick={onSave} loading={saving} leftIcon={!saving ? <Check size={16} /> : undefined}>
        {saving ? 'Saving…' : label}
      </Button>
    </div>
  )
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return <h3 className="ds-text-label text-theme-secondary uppercase tracking-wide mt-2 mb-1">{children}</h3>
}

/* ── Sections ──────────────────────────────────────────────────────────── */

function ProfileSection({ user }: { user: any }) {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground inline-flex items-center justify-center text-2xl font-bold">
          {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-theme-primary truncate">{user?.name || 'Your profile'}</p>
          <p className="ds-text-caption truncate">{user?.email || ''}</p>
        </div>
      </div>
      <p className="ds-text-caption mt-5">
        Update your name, avatar and public profile details on the dedicated profile page.
      </p>
      <div className="mt-4">
        <Link href="/dashboard/settings/profile">
          <Button variant="secondary" rightIcon={<ChevronRight size={16} />}>Edit profile</Button>
        </Link>
      </div>
    </Card>
  )
}

function SecuritySection({ onDeactivate }: { onDeactivate: () => void }) {
  return (
    <div className="space-y-6">
      <Card>
        <SubHeader>Change password</SubHeader>
        <div className="mt-3">
          <ChangePasswordForm />
        </div>
      </Card>
      <Card className="border-rose-500/30">
        <div className="flex items-center gap-2 text-rose-500">
          <ShieldAlert size={18} />
          <h3 className="text-sm font-semibold">Danger zone</h3>
        </div>
        <p className="ds-text-caption mt-2">
          Deactivating your account is irreversible and removes access to all your content.
        </p>
        <div className="mt-4">
          <Button variant="destructive" onClick={onDeactivate} leftIcon={<Trash2 size={16} />}>
            Deactivate account
          </Button>
        </div>
      </Card>
    </div>
  )
}

function NotificationsSection({ settings, setField, saving, onSave }: {
  settings: UserSettings; setField: (p: string, v: any) => void; saving: boolean; onSave: () => void
}) {
  const n = settings.notifications
  return (
    <Card>
      <SubHeader>Channels</SubHeader>
      <div className="divide-y divide-[var(--border-subtle)]">
        <ToggleRow label="Email notifications" description="Receive updates by email" checked={!!n.email} onChange={v => setField('notifications.email', v)} />
        <ToggleRow label="Push notifications" description="Browser & device push" checked={!!n.push} onChange={v => setField('notifications.push', v)} />
        <ToggleRow label="Content ready" description="Alert when a render finishes" checked={!!n.contentReady} onChange={v => setField('notifications.contentReady', v)} />
        <ToggleRow label="Mentions" description="When someone @mentions you" checked={n.mentions ?? true} onChange={v => setField('notifications.mentions', v)} />
      </div>

      <SubHeader>Activity</SubHeader>
      <div className="divide-y divide-[var(--border-subtle)]">
        <ToggleRow label="Weekly digest" description="A weekly summary email" checked={!!n.weeklyDigest} onChange={v => setField('notifications.weeklyDigest', v)} />
        <ToggleRow label="Achievements" checked={n.achievements ?? true} onChange={v => setField('notifications.achievements', v)} />
        <ToggleRow label="Comments" checked={n.comments ?? false} onChange={v => setField('notifications.comments', v)} />
      </div>

      <SubHeader>Delivery</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
        <SelectRow label="Alert priority" value={n.priorityTiers || 'all'}
          options={[{ id: 'all', label: 'All' }, { id: 'high_medium', label: 'High & medium' }, { id: 'high_only', label: 'High only' }]}
          onChange={v => setField('notifications.priorityTiers', v)} />
        <SelectRow label="Digest mode" value={n.digestMode || 'immediate'}
          options={[{ id: 'immediate', label: 'Immediate' }, { id: 'daily', label: 'Daily' }, { id: 'weekly', label: 'Weekly' }]}
          onChange={v => setField('notifications.digestMode', v)} />
        <FormField label="Digest time" hint="When daily/weekly digests send">
          <Input type="time" value={n.digestTime || '09:00'} onChange={e => setField('notifications.digestTime', e.target.value)} aria-label="Digest time" />
        </FormField>
      </div>

      <SaveBar saving={saving} onSave={onSave} />
    </Card>
  )
}

function PrivacySection({ settings, setField, saving, onSave }: {
  settings: UserSettings; setField: (p: string, v: any) => void; saving: boolean; onSave: () => void
}) {
  const p = settings.privacy
  return (
    <Card>
      <div className="divide-y divide-[var(--border-subtle)]">
        <ToggleRow label="Anonymous analytics" description="Help improve the product with anonymous usage data" checked={!!p.analyticsConsent} onChange={v => setField('privacy.analyticsConsent', v)} />
        <ToggleRow label="Use my content to improve AI" description="Allow your content to train and improve AI features" checked={!!p.dataConsent} onChange={v => setField('privacy.dataConsent', v)} />
        <ToggleRow label="Marketing communications" description="Occasional product news and offers" checked={!!p.marketingConsent} onChange={v => setField('privacy.marketingConsent', v)} />
      </div>
      <SaveBar saving={saving} onSave={onSave} />
    </Card>
  )
}

function AppearanceSection({ settings, setField, saving, onSave, applyAppearance }: {
  settings: UserSettings; setField: (p: string, v: any) => void; saving: boolean; onSave: () => void
  applyAppearance: (a?: Partial<AppearanceSettings>) => void
}) {
  const a = settings.appearance
  const themeOpts: { id: AppearanceSettings['theme']; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <Sun size={18} /> },
    { id: 'dark', label: 'Dark', icon: <Moon size={18} /> },
    { id: 'auto', label: 'System', icon: <Monitor size={18} /> },
  ]
  return (
    <Card>
      <SubHeader>Theme</SubHeader>
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

      <SubHeader>Display</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <SelectRow label="Density" description="Compact reduces spacing" value={a.density}
          options={[{ id: 'comfortable', label: 'Comfortable' }, { id: 'compact', label: 'Compact' }]}
          onChange={v => { setField('appearance.density', v); applyAppearance({ ...a, density: v as any }) }} />
        <FormField label="Accent color" hint="Optional custom accent (hex)">
          <div className="flex items-center gap-3">
            <input type="color" aria-label="Accent color"
              value={a.accent || '#6366f1'}
              onChange={e => { setField('appearance.accent', e.target.value); applyAppearance({ ...a, accent: e.target.value }) }}
              className="h-10 w-12 rounded-lg border border-input cursor-pointer bg-transparent" />
            <Input value={a.accent || ''} placeholder="#6366f1"
              onChange={e => setField('appearance.accent', e.target.value)} aria-label="Accent hex" />
          </div>
        </FormField>
      </div>

      <div className="mt-2">
        <ToggleRow
          label="Reduced motion"
          description="Minimize animations and transitions"
          checked={!!a.reducedMotion}
          onChange={v => { setField('appearance.reducedMotion', v); applyAppearance({ ...a, reducedMotion: v }) }}
        />
      </div>

      <SubHeader>Regional</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <SelectRow label="Language" value={settings.preferences.language}
          options={supportedLanguages.map(l => ({ id: l, label: languageNames[l] }))}
          onChange={v => setField('preferences.language', v)} />
        <SelectRow label="Timezone" value={settings.preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
          options={[
            { id: 'America/New_York', label: 'Eastern (US)' }, { id: 'America/Chicago', label: 'Central (US)' },
            { id: 'America/Denver', label: 'Mountain (US)' }, { id: 'America/Los_Angeles', label: 'Pacific (US)' },
            { id: 'America/Sao_Paulo', label: 'Brazil (BRT)' }, { id: 'Europe/London', label: 'London (GMT/BST)' },
            { id: 'Europe/Paris', label: 'Paris (CET)' }, { id: 'Europe/Berlin', label: 'Berlin (CET)' },
            { id: 'Asia/Dubai', label: 'Dubai (GST)' }, { id: 'Asia/Kolkata', label: 'India (IST)' },
            { id: 'Asia/Singapore', label: 'Singapore (SGT)' }, { id: 'Asia/Tokyo', label: 'Tokyo (JST)' },
            { id: 'Australia/Sydney', label: 'Sydney (AEST)' },
          ]}
          onChange={v => setField('preferences.timezone', v)} />
      </div>

      <SaveBar saving={saving} onSave={onSave} />
    </Card>
  )
}

function EditingSection({ settings, setField, saving, onSave }: {
  settings: UserSettings; setField: (p: string, v: any) => void; saving: boolean; onSave: () => void
}) {
  const v = settings.videoEditing || {}
  return (
    <Card>
      <SubHeader>AI edit style</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
        <SelectRow label="Voice tone" value={v.preferredVoiceTone || 'Hype'}
          options={['Hype', 'Storyteller', 'Educational', 'Professional', 'Casual', 'Aggressive', 'Calm', 'Motivational', 'Conversational', 'Authoritative'].map(x => ({ id: x, label: x }))}
          onChange={x => setField('videoEditing.preferredVoiceTone', x)} />
        <SelectRow label="Hook style" value={v.preferredHookStyle || 'curiosity-gap'}
          options={[
            { id: 'curiosity-gap', label: 'Curiosity gap' }, { id: 'list-tease', label: 'List tease' },
            { id: 'visual-first', label: 'Visual first' }, { id: 'question-based', label: 'Question based' },
            { id: 'bold-statement', label: 'Bold statement' }, { id: 'before-after', label: 'Before / after' },
            { id: 'enemy-frame', label: 'Enemy frame' }, { id: 'authority-proof', label: 'Authority proof' },
            { id: 'shock-reveal', label: 'Shock reveal' },
          ]}
          onChange={x => setField('videoEditing.preferredHookStyle', x)} />
        <SelectRow label="Pacing" value={v.pacingIntensity || 'medium'}
          options={[{ id: 'gentle', label: 'Gentle' }, { id: 'medium', label: 'Medium' }, { id: 'aggressive', label: 'Aggressive' }]}
          onChange={x => setField('videoEditing.pacingIntensity', x)} />
      </div>

      <SubHeader>Platform & tone</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
        <SelectRow label="Default platform" value={v.defaultPlatform || 'auto'}
          options={[{ id: 'auto', label: 'Auto-detect' }, { id: 'tiktok', label: 'TikTok' }, { id: 'instagram', label: 'Instagram' }, { id: 'youtube', label: 'YouTube' }, { id: 'linkedin', label: 'LinkedIn' }]}
          onChange={x => setField('videoEditing.defaultPlatform', x)} />
        <SelectRow label="Content tone" value={v.contentTone || 'auto'}
          options={[{ id: 'auto', label: 'Auto' }, { id: 'educational', label: 'Educational' }, { id: 'entertaining', label: 'Entertaining' }, { id: 'motivational', label: 'Motivational' }, { id: 'promotional', label: 'Promotional' }]}
          onChange={x => setField('videoEditing.contentTone', x)} />
        <SelectRow label="Music genre" value={v.musicGenre || 'auto'}
          options={['auto', 'phonk', 'lofi', 'dark_ambient', 'synthwave', 'upbeat_pop', 'cinematic', 'breakcore'].map(x => ({ id: x, label: x.replace('_', ' ') }))}
          onChange={x => setField('videoEditing.musicGenre', x)} />
      </div>

      <SubHeader>Captions</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <SelectRow label="Caption style" value={v.captionStyle || 'modern'}
          options={['modern', 'pop', 'karaoke', 'classic', 'bold', 'outline'].map(x => ({ id: x, label: x }))}
          onChange={x => setField('videoEditing.captionStyle', x)} />
        <SelectRow label="Subtitle position" value={v.subtitlePosition || 'auto'}
          options={[{ id: 'auto', label: 'Auto' }, { id: 'top', label: 'Top' }, { id: 'middle', label: 'Middle' }, { id: 'bottom', label: 'Bottom' }, { id: 'lower-third', label: 'Lower third' }]}
          onChange={x => setField('videoEditing.subtitlePosition', x)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
        <FormField label={`Caption font scale — ${(v.captionFontScale ?? 1.0).toFixed(1)}x`}>
          <Slider min={0.5} max={2.0} step={0.1} value={v.captionFontScale ?? 1.0}
            onValueChange={x => setField('videoEditing.captionFontScale', x)} aria-label="Caption font scale" />
        </FormField>
        <FormField label={`Caption vertical offset — ${v.captionVerticalOffset ?? 0}px`}>
          <Slider min={-200} max={200} step={10} value={v.captionVerticalOffset ?? 0}
            onValueChange={x => setField('videoEditing.captionVerticalOffset', x)} aria-label="Caption vertical offset" />
        </FormField>
      </div>

      <SubHeader>Aesthetics</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <SelectRow label="Color grade" value={v.aestheticColorGrade || 'vibrant'}
          options={['vibrant', 'cyberpunk_neon', 'vintage_film', 'hyper_pop', 'cinematic', 'monochrome', 'dreamy_pastel', 'none'].map(x => ({ id: x, label: x.replace('_', ' ') }))}
          onChange={x => setField('videoEditing.aestheticColorGrade', x)} />
        <SelectRow label="Transition" value={v.aestheticTransition || 'fade'}
          options={['fade', 'slide', 'zoom', 'glitch', 'whip', 'dissolve', 'none'].map(x => ({ id: x, label: x }))}
          onChange={x => setField('videoEditing.aestheticTransition', x)} />
      </div>

      <SubHeader>Feature flags</SubHeader>
      <div className="divide-y divide-[var(--border-subtle)]">
        <ToggleRow label="Speed ramping" description="AI-driven dynamic speed changes" checked={v.enableSpeedRamping ?? true} onChange={x => setField('videoEditing.enableSpeedRamping', x)} />
        <ToggleRow label="B-roll overlay" description="Auto-insert relevant b-roll" checked={v.enableBRoll ?? true} onChange={x => setField('videoEditing.enableBRoll', x)} />
      </div>
      {(v.enableBRoll ?? true) && (
        <div className="mt-3">
          <SelectRow label="B-roll frequency" value={v.brollFrequency || 'balanced'}
            options={[{ id: 'minimal', label: 'Minimal' }, { id: 'balanced', label: 'Balanced' }, { id: 'heavy', label: 'Heavy' }]}
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
  const g = settings.agentic
  return (
    <Card>
      <SubHeader>Autonomous agents</SubHeader>
      <div className="mt-2 divide-y divide-[var(--border-subtle)]">
        <ToggleRow label="Autonomous creator swarm"
          description="Let the agent swarm plan, draft and assemble content end-to-end without manual steps"
          checked={!!g.autonomousSwarm} onChange={v => setField('agentic.autonomousSwarm', v)} />
        <ToggleRow label="SLA auto-fulfill"
          description="Automatically pick up and complete queued jobs to meet delivery SLAs"
          checked={!!g.slaAutoFulfill} onChange={v => setField('agentic.slaAutoFulfill', v)} />
      </div>

      <div className="mt-5">
        <FormField label={`Predictive threshold — ${Math.round(g.predictiveThreshold ?? 85)}%`}
          hint="Minimum predicted performance score before the agent acts autonomously">
          <Slider min={0} max={100} step={1} value={g.predictiveThreshold ?? 85}
            onValueChange={v => setField('agentic.predictiveThreshold', Math.round(v))} aria-label="Predictive threshold" />
        </FormField>
      </div>

      <div className="mt-5">
        <SubHeader>Digital twin</SubHeader>
        <SelectRow label="Avatar provider" description="Service used to generate your digital twin / talking-head avatar"
          value={g.digitalTwinProvider}
          options={[{ id: 'heygen', label: 'HeyGen' }, { id: 'sora', label: 'Sora' }, { id: 'both', label: 'Both (best available)' }]}
          onChange={v => setField('agentic.digitalTwinProvider', v)} />

        {(g.digitalTwinProvider === 'heygen' || g.digitalTwinProvider === 'both') && (
          <div className="mt-4">
            <FormField label="HeyGen API key" hint="Stored securely and used for HeyGen avatar generation">
              <Input type="password" autoComplete="off" placeholder="hg_…" value={g.heygenApiKey || ''}
                onChange={e => setField('agentic.heygenApiKey', e.target.value)} aria-label="HeyGen API key" />
            </FormField>
          </div>
        )}
        {(g.digitalTwinProvider === 'sora' || g.digitalTwinProvider === 'both') && (
          <div className="mt-4">
            <FormField label="Sora API key" hint="Stored securely and used for Sora avatar generation">
              <Input type="password" autoComplete="off" placeholder="sk-…" value={g.soraApiKey || ''}
                onChange={e => setField('agentic.soraApiKey', e.target.value)} aria-label="Sora API key" />
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
  const a = settings.ai
  return (
    <Card>
      <SelectRow label="Preferred AI provider" description="Auto lets Click pick the best model for each task" value={a.provider}
        options={[{ id: 'auto', label: 'Auto (recommended)' }, { id: 'claude', label: 'Claude (Anthropic)' }, { id: 'gemini', label: 'Gemini (Google)' }]}
        onChange={v => setField('ai.provider', v)} />

      <div className="mt-5">
        <FormField label={`Creativity — ${Math.round((a.creativity ?? 0.5) * 100)}%`} hint="Lower is more precise, higher is more inventive">
          <Slider min={0} max={1} step={0.05} value={a.creativity ?? 0.5}
            onValueChange={v => setField('ai.creativity', v)} aria-label="AI creativity" />
        </FormField>
      </div>

      <div className="mt-4 divide-y divide-[var(--border-subtle)]">
        <ToggleRow label="Auto-apply AI suggestions"
          description="Apply AI edit suggestions automatically without manual review"
          checked={!!a.autoApply} onChange={v => setField('ai.autoApply', v)} />
      </div>

      <SaveBar saving={saving} onSave={onSave} />
    </Card>
  )
}

function BrandSection({ brandKit, setBrandKit, loading, saving, onSave }: {
  brandKit: BrandKit; setBrandKit: (b: BrandKit) => void; loading: boolean; saving: boolean; onSave: () => void
}) {
  const upd = (field: keyof BrandKit, value: any) => setBrandKit({ ...brandKit, [field]: value })
  if (loading) return <Card><div className="flex items-center gap-3 py-10 justify-center text-theme-muted"><RefreshCw className="animate-spin" size={20} /> Loading brand kit…</div></Card>
  return (
    <Card>
      <SubHeader>Colors</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <FormField label="Primary color">
          <div className="flex items-center gap-3">
            <input type="color" aria-label="Primary color" value={brandKit.primaryColor || '#6366f1'} onChange={e => upd('primaryColor', e.target.value)} className="h-10 w-12 rounded-lg border border-input cursor-pointer bg-transparent" />
            <Input value={brandKit.primaryColor || ''} placeholder="#6366f1" onChange={e => upd('primaryColor', e.target.value)} aria-label="Primary color hex" />
          </div>
        </FormField>
        <FormField label="Accent color">
          <div className="flex items-center gap-3">
            <input type="color" aria-label="Accent color" value={brandKit.accentColor || '#8b5cf6'} onChange={e => upd('accentColor', e.target.value)} className="h-10 w-12 rounded-lg border border-input cursor-pointer bg-transparent" />
            <Input value={brandKit.accentColor || ''} placeholder="#8b5cf6" onChange={e => upd('accentColor', e.target.value)} aria-label="Accent color hex" />
          </div>
        </FormField>
      </div>

      <SubHeader>Typography</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <SelectRow label="Headline font" value={brandKit.titleFont || ''} options={FONT_OPTIONS.map(o => ({ id: o.value, label: o.label }))} onChange={v => upd('titleFont', v)} />
        <SelectRow label="Body font" value={brandKit.bodyFont || ''} options={FONT_OPTIONS.map(o => ({ id: o.value, label: o.label }))} onChange={v => upd('bodyFont', v)} />
      </div>

      <SubHeader>Layout</SubHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <SelectRow label="Lower-third style" value={brandKit.lowerThirdStyle || ''}
          options={[{ id: '', label: 'None' }, { id: 'bar', label: 'Bar' }, { id: 'pill', label: 'Pill' }, { id: 'minimal', label: 'Minimal' }]}
          onChange={v => upd('lowerThirdStyle', v)} />
        <SelectRow label="Logo placement" value={brandKit.logoPlacement || ''}
          options={[{ id: '', label: 'Hidden' }, { id: 'top-left', label: 'Top left' }, { id: 'top-right', label: 'Top right' }, { id: 'bottom-right', label: 'Bottom right' }]}
          onChange={v => upd('logoPlacement', v)} />
      </div>

      <SaveBar saving={saving} onSave={onSave} label="Save brand kit" />
    </Card>
  )
}

function IntegrationsSection({ integrations, onAdd, onRemove }: {
  integrations: IntegrationEntry[]
  onAdd: (provider: string, label: string, key: string) => Promise<void>
  onRemove: (provider: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState(INTEGRATION_PROVIDERS[0].id)
  const [label, setLabel] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (keyValue.trim().length < 8) { setError('Enter a valid API key (min 8 characters).'); return }
    setBusy(true)
    try {
      await onAdd(provider, label.trim(), keyValue.trim())
      setOpen(false); setKeyValue(''); setLabel(''); setProvider(INTEGRATION_PROVIDERS[0].id)
    } catch (e) {
      setError(handleApiError(e) || 'Could not add API key.')
    } finally { setBusy(false) }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <p className="ds-text-caption">
          Connect third-party providers. Keys are encrypted at rest and never shown again — only the last 4 digits.
        </p>
        <Button variant="primary" size="sm" leftIcon={<Plus size={16} />} onClick={() => setOpen(true)}>Add key</Button>
      </div>

      <div className="mt-5">
        {integrations.length === 0 ? (
          <EmptyState
            icon={Plug}
            title="No API keys yet"
            description="Add a provider key to enable extra integrations."
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
                  aria-label={`Remove ${it.provider} key`}
                  className="text-rose-500 hover:text-rose-600"
                >
                  <Trash2 size={16} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add API key"
        description="Your key is encrypted on our servers and never displayed again.">
        <div className="space-y-4">
          <SelectRow label="Provider" value={provider} options={INTEGRATION_PROVIDERS}
            onChange={setProvider} />
          <FormField label="Label (optional)" hint="A name to recognize this key">
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Production key" aria-label="Key label" />
          </FormField>
          <FormField label="API key" error={error || undefined}>
            <Input type="password" value={keyValue} onChange={e => setKeyValue(e.target.value)} placeholder="sk-…" aria-label="API key" autoComplete="off" />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={submit} leftIcon={!busy ? <Check size={16} /> : undefined}>Save key</Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}

function BillingSection() {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary inline-flex items-center justify-center"><Gauge size={18} /></div>
        <div>
          <p className="text-sm font-medium text-theme-primary">Manage your plan</p>
          <p className="ds-text-caption">View invoices, update payment method and change your subscription.</p>
        </div>
      </div>
      <div className="mt-4">
        <Link href="/dashboard/billing">
          <Button variant="primary" rightIcon={<ChevronRight size={16} />}>Open billing</Button>
        </Link>
      </div>
    </Card>
  )
}
