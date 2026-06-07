'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import ToastContainer from '../../../components/ToastContainer'
import {
  Target, Globe, Palette, Layers,
  CheckCircle, ChevronRight, Sparkles,
  Network, Calendar, ArrowRight, ShieldCheck, Box, RefreshCw,
} from 'lucide-react'
import { useToast } from '../../../contexts/ToastContext'
import { useTranslation } from '../../../hooks/useTranslation'
import { useWorkflow } from '../../../contexts/WorkflowContext'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { cn } from '../../../lib/utils'
import { Button } from '../../../components/ui/button'
import { FormField, Input } from '../../../components/ui/form-field'

import { API_URL } from '../../../lib/api'
import { StatsCardSkeleton, ListItemSkeleton } from '../../../components/LoadingSkeleton'

const sectors = [
  'health', 'finance', 'education', 'technology',
  'lifestyle', 'business', 'entertainment', 'other'
]

export default function SectorResonanceMatrixPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { setNiche } = useWorkflow()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userSector, setUserSector] = useState('other')
  const [sectorPacks, setSectorPacks] = useState<any>(null)
  const [identitySettings, setIdentitySettings] = useState({
    primaryColor: '#8b5cf6',
    secondaryColor: '#ffffff',
    logo: '',
    font: 'Arial'
  })

  const loadLattice = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) { router.push('/login'); return }
      const [userRes, packRes] = await Promise.all([
        axios.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/niche/packs`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      const u = userRes.data.user || userRes.data.data?.user
      setUserSector(u.niche || 'other')
      if (u.niche) setNiche(u.niche)
      setIdentitySettings(u.brandSettings || identitySettings)
      setSectorPacks(packRes.data.data || packRes.data)
    } catch {
      showToast(t('nichePage.errorSectorAccessDenied'), 'error')
    } finally {
      setLoading(false)
    }
  }, [router, identitySettings, setNiche, t, showToast])

  useEffect(() => {
    loadLattice()
  }, [loadLattice])

  const handleSectorChange = async (sector: string) => {
    setSaving(true)
    try {
      await axios.put(`${API_URL}/niche/select`, { niche: sector }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      setUserSector(sector)
      setNiche(sector)
      showToast(t('nichePage.toastSectorUplinkSecured'), 'success')
    } catch {
      showToast(t('nichePage.errorRedesignationFailed'), 'error')
    } finally { setSaving(false) }
  }

  const handleIdentityUpdate = async () => {
    setSaving(true)
    try {
      await axios.put(`${API_URL}/niche/brand`, identitySettings, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      showToast(t('nichePage.toastIdentitySyncComplete'), 'success')
    } catch {
      showToast(t('nichePage.errorConfigurationSyncFailed'), 'error')
    } finally { setSaving(false) }
  }

  const currentPack = sectorPacks?.[userSector]

  if (loading) return (
     <div className="min-h-screen ds-bg-mesh-soft px-4 sm:px-8 pt-8 pb-24 max-w-[1500px] mx-auto" aria-busy="true" aria-label={t('nichePage.loading')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
           {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
        </div>
        <div className="space-y-3">
           {Array.from({ length: 5 }).map((_, i) => <ListItemSkeleton key={i} />)}
        </div>
     </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen ds-bg-mesh-soft text-theme-primary px-4 sm:px-8 pt-8 pb-24 max-w-[1500px] mx-auto space-y-8">
        <ToastContainer />

        {/* Header */}
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 inline-flex items-center justify-center text-primary">
              <Target size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="ds-text-h1 text-theme-primary leading-none">{t('nichePage.title')}</h1>
              <p className="ds-text-caption mt-1 max-w-2xl">{t('nichePage.subtitle')}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => loadLattice()}
            aria-label={t('nichePage.refreshData')} title={t('nichePage.refreshData')}
            leftIcon={<RefreshCw size={16} className={saving ? 'animate-spin' : ''} />}>
            {t('nichePage.refreshData')}
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sector Mapping Matrix */}
          <section className="ds-surface-card p-5 sm:p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-subtle)]">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary inline-flex items-center justify-center"><Layers size={20} /></div>
              <h2 className="ds-text-h3 text-theme-primary">{t('nichePage.latticeMatrix')}</h2>
            </div>

            <FormField label={t('nichePage.sectorDesignations')}>
              <div className="grid grid-cols-2 gap-2">
                {sectors.map((sector) => (
                  <button
                    key={sector}
                    type="button"
                    onClick={() => handleSectorChange(sector)}
                    disabled={saving}
                    aria-pressed={userSector === sector ? 'true' : 'false'}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium capitalize transition-colors disabled:opacity-50',
                      userSector === sector
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input text-theme-secondary hover:bg-accent'
                    )}
                  >
                    {sector}
                    {userSector === sector
                      ? <CheckCircle size={18} className="text-primary" />
                      : <ArrowRight size={16} className="opacity-40" />}
                  </button>
                ))}
              </div>
            </FormField>

            {currentPack && (
              <div className="rounded-xl border border-input p-5 space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-subtle)]">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary inline-flex items-center justify-center"><Layers size={20} /></div>
                  <div className="min-w-0">
                    <p className="ds-text-caption">{t('nichePage.sectorIntelArchive')}</p>
                    <h3 className="ds-text-h3 text-theme-primary">{currentPack.name}</h3>
                  </div>
                </div>
                <p className="text-sm text-theme-secondary leading-relaxed">{currentPack.description}</p>
                <div className="space-y-2">
                  <p className="ds-text-label text-theme-muted">{t('nichePage.operationalSchematics')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(currentPack.templates || []).map((tpl: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm font-medium text-theme-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {tpl.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Identity Calibration Matrix */}
          <section className="ds-surface-card p-5 sm:p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-subtle)]">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary inline-flex items-center justify-center"><Palette size={20} /></div>
              <h2 className="ds-text-h3 text-theme-primary">{t('nichePage.identityHash')}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={t('nichePage.resonancePolarity')}>
                <div className="flex items-center gap-3">
                  <input type="color" value={identitySettings.primaryColor}
                    onChange={e => setIdentitySettings({ ...identitySettings, primaryColor: e.target.value })}
                    aria-label={t('nichePage.primaryColourPicker')} title={t('nichePage.primaryColour')}
                    className="h-10 w-12 rounded-lg border border-input cursor-pointer bg-transparent" />
                  <Input value={identitySettings.primaryColor}
                    onChange={e => setIdentitySettings({ ...identitySettings, primaryColor: e.target.value })}
                    aria-label={t('nichePage.primaryColourHexValue')} title={t('nichePage.primaryColourHex')}
                    placeholder="#6366F1" />
                </div>
              </FormField>
              <FormField label={t('nichePage.diffractionBaseline')}>
                <div className="flex items-center gap-3">
                  <input type="color" value={identitySettings.secondaryColor}
                    onChange={e => setIdentitySettings({ ...identitySettings, secondaryColor: e.target.value })}
                    aria-label={t('nichePage.secondaryColourPicker')} title={t('nichePage.secondaryColour')}
                    className="h-10 w-12 rounded-lg border border-input cursor-pointer bg-transparent" />
                  <Input value={identitySettings.secondaryColor}
                    onChange={e => setIdentitySettings({ ...identitySettings, secondaryColor: e.target.value })}
                    aria-label={t('nichePage.secondaryColourHexValue')} title={t('nichePage.secondaryColourHex')}
                    placeholder="#8B5CF6" />
                </div>
              </FormField>
            </div>

            <FormField label={t('nichePage.logicTopography')}>
              <select value={identitySettings.font}
                onChange={e => setIdentitySettings({ ...identitySettings, font: e.target.value })}
                aria-label={t('nichePage.brandFontSelection')} title={t('nichePage.selectBrandFont')}
                className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="Arial">{t('nichePage.fontArial')}</option>
                <option value="Helvetica">{t('nichePage.fontHelvetica')}</option>
                <option value="Verdana">{t('nichePage.fontVerdana')}</option>
                <option value="Georgia">{t('nichePage.fontGeorgia')}</option>
              </select>
            </FormField>

            <FormField label={t('nichePage.visualSignatureUplink')}>
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-theme-muted shrink-0" />
                <Input type="url" value={identitySettings.logo}
                  onChange={e => setIdentitySettings({ ...identitySettings, logo: e.target.value })}
                  placeholder={t('nichePage.logoUrlPlaceholder')} />
              </div>
            </FormField>

            <Button variant="primary" onClick={handleIdentityUpdate} loading={saving}
              leftIcon={!saving ? <ShieldCheck size={16} /> : undefined} className="w-full">
              {t('nichePage.initializeIdentityHash')}
            </Button>

            {/* Identity preview */}
            <div className="space-y-2 pt-2">
              <p className="ds-text-label text-theme-muted">{t('nichePage.identityRenderBuffer')}</p>
              <div className="h-56 rounded-xl flex flex-col items-center justify-center gap-4 border border-input"
                style={{ background: `linear-gradient(135deg, ${identitySettings.primaryColor}, ${identitySettings.secondaryColor})`, fontFamily: identitySettings.font }}>
                <div className="h-16 w-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center border border-white/40">
                  <Box size={32} className="text-white" />
                </div>
                <div className="text-center px-6">
                  <p className="text-3xl font-bold text-white leading-none drop-shadow">{t('nichePage.previewBrandName')}</p>
                  <p className="text-xs text-white/70 mt-3">{t('nichePage.previewTagline')}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Navigation shortcuts */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t('nichePage.navNeuralForge'), desc: t('nichePage.navNeuralForgeDesc'), icon: Sparkles, href: '/dashboard/content' },
            { label: t('nichePage.navTemporalHub'), desc: t('nichePage.navTemporalHubDesc'), icon: Calendar, href: '/dashboard/scheduler' },
            { label: t('nichePage.navAxiomVault'), desc: t('nichePage.navAxiomVaultDesc'), icon: Network, href: '/dashboard/library' },
            { label: t('nichePage.navBlueprintArray'), desc: t('nichePage.navBlueprintArrayDesc'), icon: Layers, href: '/dashboard/templates' },
          ].map((a) => (
            <button
              key={a.label} type="button" onClick={() => router.push(a.href)}
              className="ds-surface-card ds-hover-lift p-5 text-left group"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary inline-flex items-center justify-center mb-3">
                <a.icon size={20} />
              </div>
              <h4 className="text-sm font-semibold text-theme-primary group-hover:text-primary transition-colors flex items-center gap-1.5">
                {a.label}
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="ds-text-caption mt-1">{a.desc}</p>
            </button>
          ))}
        </section>
      </div>
    </ErrorBoundary>
  )
}
