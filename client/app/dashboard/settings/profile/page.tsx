'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, Mail, Camera, ArrowLeft, Globe, Instagram, Linkedin,
  MapPin, Twitter, Lock, RefreshCw, X, type LucideIcon,
} from 'lucide-react'
import { apiGet, apiPost, apiPut } from '../../../../lib/api'
import ToastContainer from '../../../../components/ToastContainer'
import { useAuth } from '../../../../hooks/useAuth'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'
import { useTranslation } from '@/hooks/useTranslation'
import { cn } from '@/lib/utils'
import {
  Panel, SectionHeader, Button, IconButton, FormField, Input, Textarea,
} from '@/components/ui'

export default function IdentityMatrixInterfacePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // Coarser save-state for the header pill. idle → saving → saved → idle.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'dirty'>('idle')
  const [profile, setProfile] = useState({
    name: '',
    username: '',
    email: '',
    bio: '',
    website: '',
    location: '',
    social_links: {} as Record<string, string>,
    niche: '',
    profilePicture: null as File | null,
  })
  const [preview, setPreview] = useState<string | null>(null)
  const lastSavedSnapshotRef = useRef<string>('')

  // Drift detector: serialise persisted fields and compare against snapshot.
  useEffect(() => {
    if (loading) return
    if (saveState === 'saving' || saveState === 'saved') return
    const current = JSON.stringify({
      name: profile.name,
      username: profile.username,
      bio: profile.bio,
      website: profile.website,
      location: profile.location,
      social_links: profile.social_links,
      niche: profile.niche,
      hasNewAvatar: !!profile.profilePicture,
    })
    if (!lastSavedSnapshotRef.current) return
    if (current !== lastSavedSnapshotRef.current && saveState !== 'dirty') {
      setSaveState('dirty')
    } else if (current === lastSavedSnapshotRef.current && saveState === 'dirty') {
      setSaveState('idle')
    }
  }, [profile, loading, saveState])

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true)
      const profileData: any = await apiGet('/auth/profile')
      const u = profileData.profile || profileData.user || profileData;
      const next = {
        name: u.name || '',
        username: u.username || '',
        email: u.email || '',
        bio: u.bio || '',
        website: u.website || '',
        location: u.location || '',
        social_links: u.social_links || {},
        niche: u.niche || '',
        profilePicture: null as File | null,
      }
      setProfile(next)
      lastSavedSnapshotRef.current = JSON.stringify({
        name: next.name,
        username: next.username,
        bio: next.bio,
        website: next.website,
        location: next.location,
        social_links: next.social_links,
        niche: next.niche,
        hasNewAvatar: false,
      })
    } catch {
      if (user) {
        setProfile({
          name: user.name || '',
          username: (user as any).username || '',
          email: user.email || '',
          bio: (user as any).bio || '',
          website: (user as any).website || '',
          location: (user as any).location || '',
          social_links: (user as any).social_links || {},
          niche: user.niche || '',
          profilePicture: null,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setProfile(prev => ({ ...prev, profilePicture: file }))
      const reader = new FileReader()
      reader.onloadend = () => setPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    setSaveState('saving')
    try {
      const updateData = {
        name: profile.name,
        username: profile.username,
        bio: profile.bio,
        website: profile.website,
        location: profile.location,
        social_links: profile.social_links,
        niche: profile.niche,
      }
      const saved = await apiPut<{ profile?: any }>('/auth/profile', updateData)
      const persisted = (saved as any)?.profile
      if (persisted) {
        setProfile((p) => ({
          ...p,
          name: persisted.name ?? p.name,
          username: persisted.username ?? p.username,
          bio: persisted.bio ?? p.bio,
          website: persisted.website ?? p.website,
          location: persisted.location ?? p.location,
          social_links: persisted.social_links ?? p.social_links,
          niche: persisted.niche ?? p.niche,
        }))
      }

      if (profile.profilePicture) {
        const form = new FormData()
        form.append('avatar', profile.profilePicture)
        try {
          const res = await apiPost<{ avatar?: string }>(
            '/auth/avatar',
            form,
            { headers: { 'Content-Type': 'multipart/form-data' }, transformRequest: [(d: any) => d] } as any,
          )
          if (res?.avatar) setPreview(res.avatar)
          setProfile((p) => ({ ...p, profilePicture: null }))
        } catch (avatarErr: any) {
          window.dispatchEvent(new CustomEvent('toast', {
            detail: { message: avatarErr?.response?.data?.error || t('profilePage.avatarUploadError'), type: 'error' },
          }))
        }
      }

      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('profilePage.saveSuccess'), type: 'success' } }))
      const baselineSource = persisted || updateData
      lastSavedSnapshotRef.current = JSON.stringify({
        name: baselineSource.name ?? '',
        username: baselineSource.username ?? '',
        bio: baselineSource.bio ?? '',
        website: baselineSource.website ?? '',
        location: baselineSource.location ?? '',
        social_links: baselineSource.social_links ?? {},
        niche: baselineSource.niche ?? '',
        hasNewAvatar: false,
      })
      setSaveState('saved')
      window.setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000)
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('profilePage.saveError'), type: 'error' } }))
      setSaveState('dirty')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="ds-bg-mesh-soft min-h-screen flex flex-col items-center justify-center gap-4" aria-busy="true">
      <RefreshCw size={40} className="text-primary motion-safe:animate-spin" aria-hidden />
      <p className="ds-text-caption">{t('profilePage.loading')}</p>
    </div>
  );

  const saveStateLabel =
    saveState === 'saving' ? t('profilePage.statusSaving')
      : saveState === 'dirty' ? t('profilePage.statusUnsaved')
        : t('profilePage.statusSaved')

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1400px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={t('profilePage.title')}
          description={t('profilePage.accountDetailsSubtitle')}
          className="mb-6"
          actions={
            <>
              <span className="inline-flex items-center gap-2 ds-text-caption">
                <span className={cn(
                  'h-2 w-2 rounded-full',
                  saveState === 'saving' ? 'bg-primary motion-safe:animate-pulse' :
                    saveState === 'dirty' ? 'bg-amber-500' : 'bg-emerald-500'
                )} />
                {saveStateLabel}
              </span>
              <IconButton
                variant="secondary"
                size="md"
                aria-label={t('profilePage.backToSettings')}
                onClick={() => router.push('/dashboard/settings')}
              >
                <ArrowLeft size={18} aria-hidden />
              </IconButton>
              <Button
                variant="primary"
                size="md"
                onClick={saveProfile}
                loading={saving}
                leftIcon={!saving ? <Lock size={16} aria-hidden /> : undefined}
              >
                {saving ? t('profilePage.statusSaving') : t('profilePage.saveButton')}
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Avatar + social */}
          <aside className="lg:col-span-4 space-y-4">
            <Panel variant="bento" className="ds-anim-rise p-6 flex flex-col items-center text-center gap-5">
              <div className="relative">
                <div className="h-40 w-40 rounded-2xl overflow-hidden bg-accent flex items-center justify-center">
                  {preview || (user as any)?.avatar ? (
                    <img src={preview || (user as any)?.avatar} alt={t('profilePage.avatarAlt')} className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-16 w-16 text-theme-muted" aria-hidden />
                  )}
                </div>
                <label
                  title={t('profilePage.changePhoto')}
                  aria-label={t('profilePage.changePhoto')}
                  className="absolute -bottom-2 -right-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  <Camera size={18} aria-hidden />
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
              </div>

              <div className="min-w-0 w-full">
                <h3 className="ds-text-h3 text-theme-primary [overflow-wrap:anywhere]">{profile.name || t('profilePage.namePlaceholderDisplay')}</h3>
                <p className="ds-text-caption mt-1 break-all">{profile.email || t('profilePage.emailPlaceholderDisplay')}</p>
              </div>

              {preview && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setPreview(null); setProfile(prev => ({ ...prev, profilePicture: null })) }}
                  leftIcon={<X size={14} aria-hidden />}
                  className="text-rose-500"
                >
                  {t('profilePage.removePhoto')}
                </Button>
              )}
            </Panel>

            <Panel variant="bento" className="ds-anim-rise p-6 space-y-4">
              <SectionHeader as="h2" title={t('profilePage.socialLinks')} />
              <UplinkField icon={Twitter} label={t('profilePage.socialTwitter')} value={profile.social_links.twitter || ''} placeholder="https://x.com/..."
                onChange={(v) => setProfile(prev => ({ ...prev, social_links: { ...prev.social_links, twitter: v } }))} />
              <UplinkField icon={Linkedin} label={t('profilePage.socialLinkedin')} value={profile.social_links.linkedin || ''} placeholder="https://linkedin.com/..."
                onChange={(v) => setProfile(prev => ({ ...prev, social_links: { ...prev.social_links, linkedin: v } }))} />
              <UplinkField icon={Instagram} label={t('profilePage.socialInstagram')} value={profile.social_links.instagram || ''} placeholder="https://instagram.com/..."
                onChange={(v) => setProfile(prev => ({ ...prev, social_links: { ...prev.social_links, instagram: v } }))} />
            </Panel>
          </aside>

          {/* Account details */}
          <section className="lg:col-span-8">
            <Panel variant="bento" className="ds-anim-rise p-6 space-y-6">
              <SectionHeader as="h2" title={t('profilePage.accountDetails')} description={t('profilePage.accountDetailsSubtitle')} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label={t('profilePage.fullName')} htmlFor="pf-name">
                  <Input id="pf-name" value={profile.name} placeholder={t('profilePage.fullNamePlaceholder')}
                    onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))} />
                </FormField>
                <FormField label={t('profilePage.email')} htmlFor="pf-email" hint={undefined}>
                  <div className="relative">
                    <Input id="pf-email" value={profile.email} disabled className="pr-9" />
                    <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted" aria-hidden />
                  </div>
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label={t('profilePage.displayName')} htmlFor="pf-username" hint={t('profilePage.displayNameHint')}>
                  <Input id="pf-username" value={profile.username} placeholder={t('profilePage.displayNamePlaceholder')}
                    onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))} />
                </FormField>
              </div>

              <FormField label={t('profilePage.bio')} htmlFor="pf-bio"
                error={profile.bio.length > 450 ? t('profilePage.bioCharCount', { count: profile.bio.length }) : undefined}
                hint={t('profilePage.bioCharCount', { count: profile.bio.length })}
              >
                <Textarea
                  id="pf-bio"
                  value={profile.bio}
                  rows={6}
                  placeholder={t('profilePage.bioPlaceholder')}
                  onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value.slice(0, 500) }))}
                />
              </FormField>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label={t('profilePage.website')} htmlFor="pf-website">
                  <Input id="pf-website" value={profile.website} placeholder="https://yoursite.com"
                    onChange={(e) => setProfile(prev => ({ ...prev, website: e.target.value }))} />
                </FormField>
                <FormField label={t('profilePage.location')} htmlFor="pf-location">
                  <Input id="pf-location" value={profile.location} placeholder={t('profilePage.locationPlaceholder')}
                    onChange={(e) => setProfile(prev => ({ ...prev, location: e.target.value }))} />
                </FormField>
              </div>

              <FormField label={t('profilePage.niche')} htmlFor="pf-niche">
                <select
                  id="pf-niche"
                  title={t('profilePage.niche')}
                  value={profile.niche}
                  onChange={(e) => setProfile(prev => ({ ...prev, niche: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">{t('profilePage.nicheChoose')}</option>
                  <option value="health">{t('profilePage.nicheHealth')}</option>
                  <option value="finance">{t('profilePage.nicheFinance')}</option>
                  <option value="education">{t('profilePage.nicheEducation')}</option>
                  <option value="technology">{t('profilePage.nicheTechnology')}</option>
                  <option value="lifestyle">{t('profilePage.nicheLifestyle')}</option>
                  <option value="business">{t('profilePage.nicheBusiness')}</option>
                  <option value="entertainment">{t('profilePage.nicheEntertainment')}</option>
                  <option value="other">{t('profilePage.nicheOther')}</option>
                </select>
              </FormField>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[var(--border-subtle)]">
                <span className="ds-text-caption">{t('profilePage.encryptedNote')}</span>
                <Button
                  variant="primary"
                  size="md"
                  onClick={saveProfile}
                  loading={saving}
                  leftIcon={!saving ? <Lock size={16} aria-hidden /> : undefined}
                  className="w-full sm:w-auto"
                >
                  {saving ? t('profilePage.statusSaving') : t('profilePage.saveButton')}
                </Button>
              </div>
            </Panel>
          </section>
        </div>
      </div>
    </ErrorBoundary>
  )
}

function UplinkField({ icon: Icon, label, value, placeholder, onChange }: { icon: LucideIcon; label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <FormField label={<span className="inline-flex items-center gap-2"><Icon size={14} aria-hidden /> {label}</span>}>
      <Input type="url" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </FormField>
  )
}
