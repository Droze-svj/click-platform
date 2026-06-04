'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  User, Mail, Camera, Save, Key, ArrowLeft, 
  Globe, Instagram, Linkedin, MapPin, Activity, 
  Cpu, Layers, Lock, Shield, Twitter, Target,
  RefreshCw, Plus, X, ArrowRight, Zap, Terminal, Fingerprint, Network,
  ActivitySquare, ShieldCheck, UserCheck, Monitor, Database, Sparkles,
  Search, Sliders, ChevronRight
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost, apiPut } from '../../../../lib/api'
import LoadingSkeleton from '../../../../components/LoadingSkeleton'
import ToastContainer from '../../../../components/ToastContainer'
import { useAuth } from '../../../../hooks/useAuth'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'
import { useTranslation } from '@/hooks/useTranslation'

export default function IdentityMatrixInterfacePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // Coarser save-state for the pill in the header. Cycles:
  //   idle → saving → saved → idle (after 2s) → dirty (on any edit) → saving …
  // The previous header pill was hardcoded to "Saved" regardless of state,
  // so a user couldn't tell whether a click had landed.
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
  // Snapshot of the last-known-saved profile values. When `profile`
  // diverges from this snapshot the header pill flips to "Unsaved
  // changes"; the snapshot resets on every successful save.
  const lastSavedSnapshotRef = useRef<string>('')

  // Drift detector: serialise the fields the form actually persists and
  // compare against the saved snapshot. We skip this work while a save
  // is in-flight or right after a save (saveState === 'saved') to avoid
  // flicker. If the snapshot is empty we haven't loaded yet — also skip.
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
      // Baseline for the drift detector — anything the user changes
      // after this point flips the header pill to "Unsaved changes".
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
        username: profile.username, // preferred display name
        bio: profile.bio,
        website: profile.website,
        location: profile.location,
        social_links: profile.social_links,
        niche: profile.niche,
      }
      // Capture the server's authoritative profile back so the form
      // rehydrates with what actually persisted (niche, social_links
      // merges, etc.). Previously the form trusted local state and
      // silently drifted when the server normalised values.
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

      // If the user picked a new avatar, upload it as multipart in a
      // second request. Doing it separately keeps the JSON profile update
      // cleanly typed and lets the avatar route handle the file with
      // multer. The previous code silently discarded the file.
      if (profile.profilePicture) {
        const form = new FormData()
        form.append('avatar', profile.profilePicture)
        try {
          const res = await apiPost<{ avatar?: string }>(
            '/auth/avatar',
            form,
            // axios reads FormData boundary automatically when we don't
            // override Content-Type; but transformRequest in the api
            // client may JSON-stringify objects, so override explicitly.
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
      // Re-baseline the drift detector with the values that actually
      // persisted (server may normalise) so the pill doesn't re-flip
      // to "Unsaved changes" immediately.
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
      // Settle the pill back to idle after the success animation. If the
      // user edits something within those 2s, the dirty handler flips it
      // forward; otherwise we go to idle.
      window.setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000)
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('profilePage.saveError'), type: 'error' } }))
      setSaveState('dirty')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-surface-page min-h-screen transition-colors duration-500">
        <Fingerprint size={80} className="text-primary-500 animate-spin mb-12" />
        <p className="text-sm font-black text-surface-500 uppercase tracking-widest animate-pulse italic leading-none">{t('profilePage.loading')}</p>
     </div>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-12 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter">
        <ToastContainer />

        {/* Matrix Header */}
        <header className="flex flex-col lg:flex-row justify-between items-center gap-12 pb-10 border-b border-surface-200 dark:border-surface-800 relative z-50">
           <div className="flex items-center gap-6 w-full lg:w-auto min-w-0">
               <button type="button" onClick={() => router.push('/dashboard/settings')} title={t('profilePage.backToSettings')} aria-label={t('profilePage.backToSettings')} className="w-14 h-14 rounded-2xl bg-surface-card border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all shadow-sm active:scale-90">
                 <ArrowLeft size={24} />
               </button>
              <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg flex-shrink-0 group hover:rotate-12 transition-transform duration-500">
                 <User size={40} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-4 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-[0.2em] border border-primary-200 dark:border-primary-800 italic leading-none">
                      {t('profilePage.badge')}
                    </span>
                    {/* Live save indicator. Was hardcoded to "Saved" + a
                        green dot regardless of state, which let users
                        click Save and not realise whether the request had
                        actually landed. Reflects `saveState` now. */}
                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-card text-surface-500 border border-surface-200 dark:bg-surface-800/50 dark:text-surface-400 dark:border-surface-700/50 text-[10px] font-black italic shadow-inner">
                        <div className={`w-2 h-2 rounded-full ${
                          saveState === 'saving' ? 'bg-primary-500 animate-pulse' :
                          saveState === 'saved' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                          saveState === 'dirty' ? 'bg-amber-500' :
                          'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                        }`} />
                        {saveState === 'saving' ? t('profilePage.statusSaving')
                          : saveState === 'dirty' ? t('profilePage.statusUnsaved')
                          : t('profilePage.statusSaved')}
                    </div>
                 </div>
                 <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none mt-3 truncate uppercase italic">{t('profilePage.title')}</h1>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-6 justify-end w-full lg:w-auto">
              <button type="button" onClick={saveProfile} disabled={saving}
                className="px-10 py-5 bg-surface-900 dark:bg-white text-white dark:text-black font-black uppercase text-[11px] tracking-[0.6em] italic rounded-2xl hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all shadow-2xl active:scale-95 flex items-center gap-4 group border-none"
              >
                {saving ? <RefreshCw className="animate-spin" size={22} /> : <Lock size={22} className="group-hover:scale-110 transition-transform duration-500" />}
                {saving ? t('profilePage.statusSaving') : t('profilePage.saveButton')}
              </button>
           </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
           {/* Change photo & Core Intel */}
           <aside className="lg:col-span-4 space-y-10">
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 p-12 sm:p-14 rounded-[4rem] flex flex-col items-center text-center gap-10 shadow-2xl relative overflow-hidden group transition-all duration-500 hover:shadow-[0_80px_150px_rgba(0,0,0,0.4)]"
              >
                 <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-1000"><Activity size={250} className="text-primary-500" /></div>
                 
                 <div className="relative group/avatar">
                    <div className="w-60 h-60 rounded-[4rem] bg-surface-page dark:bg-surface-950 border-4 border-surface-100 dark:border-surface-800 p-2 shadow-inner overflow-hidden transition-all duration-700 group-hover/avatar:border-primary-500/30 group-hover/avatar:scale-105">
                       <div className="w-full h-full rounded-[3.4rem] overflow-hidden bg-surface-card dark:bg-surface-900 flex items-center justify-center relative">
                          {preview || (user as any)?.avatar ? (
                            <img src={preview || (user as any)?.avatar} alt={t('profilePage.avatarAlt')} className="w-full h-full object-cover grayscale group-hover/avatar:grayscale-0 transition-all duration-1000" />
                          ) : (
                            <User className="w-24 h-24 text-surface-200 dark:text-slate-800 group-hover/avatar:text-primary-500 transition-all duration-500" />
                          )}
                          <div className="absolute inset-0 bg-primary-500/5 opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
                       </div>
                    </div>
                     <label title={t('profilePage.changePhoto')} aria-label={t('profilePage.changePhoto')} className="absolute -bottom-4 -right-4 w-18 h-18 bg-surface-900 dark:bg-white text-white dark:text-black border-4 border-surface-page dark:border-surface-card rounded-[1.8rem] flex items-center justify-center cursor-pointer hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all shadow-2xl active:scale-90 group-hover/avatar:rotate-12">
                        <Camera size={28} />
                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                     </label>
                 </div>
                 
                 <div className="space-y-4 w-full relative z-10 min-w-0">
                    {/* Name autofit — was `text-4xl font-black italic uppercase tracking-tighter leading-none` which forced
                        "Dario Vuma" onto one too-wide line, getting clipped at the avatar column edge to "DARIO VUM".
                        Switched to a fluid size + wrapping so any first+last name renders cleanly. */}
                    <h3 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white leading-tight group-hover:text-primary-500 transition-colors duration-500 [overflow-wrap:anywhere]">{profile.name || t('profilePage.namePlaceholderDisplay')}</h3>
                    <div className="px-6 py-2 rounded-2xl bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 shadow-inner max-w-full">
                       {/* Email was uppercase + tracking-[0.4em] + truncated which clipped "dariovuma@gmail.com" to
                           "DARIOVUMA@G…". Plain case + break-all so the whole address always shows. */}
                       <p className="text-[11px] sm:text-xs text-surface-500 dark:text-slate-400 font-semibold italic leading-snug break-all">{profile.email || t('profilePage.emailPlaceholderDisplay')}</p>
                    </div>
                 </div>

                 <div className="w-full pt-10 border-t-2 border-surface-100 dark:border-surface-800 flex flex-col gap-6 relative z-10">
                     {preview && (
                        <button type="button" onClick={() => { setPreview(null); setProfile(prev => ({ ...prev, profilePicture: null })) }} 
                          title={t('profilePage.removePhoto')} aria-label={t('profilePage.removePhoto')}
                          className="text-[10px] font-black text-rose-500 uppercase tracking-[0.5em] hover:text-rose-600 transition-all p-5 italic bg-rose-500/5 rounded-2xl border-2 border-rose-500/10 shadow-inner group/purge"
                        >
                           <div className="flex items-center justify-center gap-4">
                              <X size={18} className="group-hover:rotate-180 transition-transform duration-500" /> {t('profilePage.removePhoto')}
                           </div>
                        </button>
                     )}
                    <div className="p-8 rounded-[2.5rem] bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-between group cursor-default shadow-inner hover:border-primary-500/30 transition-all duration-500">
                       <div className="flex items-center gap-5 text-surface-400 dark:text-slate-600 group-hover:text-primary-500 transition-colors duration-700">
                          <Activity size={20} className="animate-pulse" />
                          <span className="text-[11px] font-black uppercase tracking-[0.4em] italic">{t('profilePage.plan')}</span>
                       </div>
                       <span className="text-[10px] font-black text-white italic bg-primary-600 px-5 py-2 rounded-xl shadow-lg uppercase tracking-widest">{t('profilePage.planPro')}</span>
                    </div>
                 </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 p-10 sm:p-12 rounded-[3.5rem] space-y-10 shadow-2xl relative overflow-hidden group transition-all duration-500"
              >
                 <div className="flex items-center gap-6 border-b-2 border-surface-100 dark:border-surface-800 pb-8">
                    <Network size={20} className="text-surface-300 dark:text-slate-800 group-hover:text-primary-500 transition-colors duration-700" />
                    <h3 className="text-[12px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.6em] italic leading-none">{t('profilePage.socialLinks')}</h3>
                 </div>
                 <div className="space-y-8">
                    <UplinkField icon={Twitter} label={t('profilePage.socialTwitter')} value={profile.social_links.twitter || ''} placeholder="https://x.com/..."
                      onChange={(v) => setProfile(prev => ({ ...prev, social_links: { ...prev.social_links, twitter: v } }))} />
                    <UplinkField icon={Linkedin} label={t('profilePage.socialLinkedin')} value={profile.social_links.linkedin || ''} placeholder="https://linkedin.com/..."
                      onChange={(v) => setProfile(prev => ({ ...prev, social_links: { ...prev.social_links, linkedin: v } }))} />
                    <UplinkField icon={Instagram} label={t('profilePage.socialInstagram')} value={profile.social_links.instagram || ''} placeholder="https://instagram.com/..."
                      onChange={(v) => setProfile(prev => ({ ...prev, social_links: { ...prev.social_links, instagram: v } }))} />
                 </div>
              </motion.div>
           </aside>

           {/* Neural Synthesis Terminal */}
           <section className="lg:col-span-8 space-y-10">
              <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-surface-800 rounded-[4rem] p-10 sm:p-14 shadow-2xl relative overflow-hidden group transition-all duration-500 hover:shadow-[0_80px_150px_rgba(0,0,0,0.4)]"
              >
                 <div className="absolute top-0 right-0 p-24 opacity-[0.01] pointer-events-none group-hover:opacity-[0.03] transition-opacity duration-1000"><Terminal size={550} className="text-primary-500" /></div>
                 
                 <div className="flex items-center gap-8 mb-16 relative z-10">
                    <div className="w-18 h-18 rounded-[1.8rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform duration-500"><Target size={36} className="text-primary-600 dark:text-primary-400 animate-pulse" /></div>
                    <div>
                       <h2 className="text-3xl sm:text-4xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none mb-3">{t('profilePage.accountDetails')}</h2>
                       <p className="text-[11px] text-surface-400 dark:text-slate-500 font-black uppercase tracking-[0.5em] italic leading-none">{t('profilePage.accountDetailsSubtitle')}</p>
                    </div>
                 </div>

                 <div className="space-y-14 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <ConfigField icon={User} label={t('profilePage.fullName')} value={profile.name} placeholder={t('profilePage.fullNamePlaceholder')}
                         onChange={(v) => setProfile(prev => ({ ...prev, name: v }))} isLarge />
                       <ConfigField icon={Mail} label={t('profilePage.email')} value={profile.email} placeholder={t('profilePage.emailFieldPlaceholder')}
                         onChange={(v) => setProfile(prev => ({ ...prev, email: v }))} isLocked />
                    </div>

                    {/* Preferred display name — shown in dashboard greeting and anywhere a single label is rendered. */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <ConfigField
                         icon={UserCheck}
                         label={t('profilePage.displayName')}
                         value={profile.username}
                         placeholder={t('profilePage.displayNamePlaceholder')}
                         onChange={(v) => setProfile(prev => ({ ...prev, username: v }))}
                         isLarge
                       />
                       <div className="flex items-end pb-2 px-2">
                         <p className="text-[11px] font-bold text-surface-400 dark:text-slate-500 italic uppercase tracking-[0.2em]">
                           {t('profilePage.displayNameHint')}
                         </p>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <label className="text-[12px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.6em] italic pl-6">{t('profilePage.bio')}</label>
                       <div className="group relative">
                          <textarea
                            value={profile.bio}
                            onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value.slice(0, 500) }))}
                            rows={8}
                            placeholder={t('profilePage.bioPlaceholder')}
                            className="w-full bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 rounded-[3rem] px-10 py-10 text-lg font-black text-surface-900 dark:text-white uppercase italic tracking-[0.05em] focus:outline-none focus:border-primary-500/40 transition-all placeholder:text-surface-200 dark:placeholder:text-slate-900 shadow-inner leading-relaxed min-h-[280px]"
                            title={t('profilePage.bio')}
                          />
                          <div className="absolute top-10 right-10 pointer-events-none opacity-5 group-focus-within:opacity-20 transition-opacity duration-1000">
                             <Fingerprint size={120} className="text-primary-500" />
                          </div>
                       </div>
                       <div className="flex justify-between items-center px-8">
                          <div className="flex items-center gap-4 text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.4em] italic">
                             <ActivitySquare size={14} className="text-primary-500 animate-pulse" /> {t('profilePage.bioLength')}
                          </div>
                          <span className={`text-[11px] font-black italic tracking-widest ${profile.bio.length > 450 ? 'text-rose-500' : 'text-surface-300 dark:text-slate-800'}`}>
                             {t('profilePage.bioCharCount', { count: profile.bio.length })}
                          </span>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <ConfigField icon={Globe} label={t('profilePage.website')} value={profile.website} placeholder="https://yoursite.com"
                         onChange={(v) => setProfile(prev => ({ ...prev, website: v }))} />
                       <ConfigField icon={MapPin} label={t('profilePage.location')} value={profile.location} placeholder={t('profilePage.locationPlaceholder')}
                         onChange={(v) => setProfile(prev => ({ ...prev, location: v }))} />
                    </div>

                    <div className="space-y-6">
                       <label className="text-[12px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.6em] italic pl-6">{t('profilePage.niche')}</label>
                       <div className="relative group/select">
                          <select
                            value={profile.niche}
                            onChange={(e) => setProfile(prev => ({ ...prev, niche: e.target.value }))}
                            className="w-full bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 rounded-[2.5rem] px-10 py-7 text-sm font-black text-primary-600 dark:text-primary-400 uppercase italic tracking-[0.4em] focus:outline-none appearance-none cursor-pointer hover:bg-surface-page transition-all shadow-inner backdrop-blur-xl"
                            title={t('profilePage.niche')}
                          >
                             <option value="" className="bg-surface-card dark:bg-surface-900">{t('profilePage.nicheChoose')}</option>
                             <option value="health" className="bg-surface-card dark:bg-surface-900">{t('profilePage.nicheHealth')}</option>
                             <option value="finance" className="bg-surface-card dark:bg-surface-900">{t('profilePage.nicheFinance')}</option>
                             <option value="education" className="bg-surface-card dark:bg-surface-900">{t('profilePage.nicheEducation')}</option>
                             <option value="technology" className="bg-surface-card dark:bg-surface-900">{t('profilePage.nicheTechnology')}</option>
                             <option value="lifestyle" className="bg-surface-card dark:bg-surface-900">{t('profilePage.nicheLifestyle')}</option>
                             <option value="business" className="bg-surface-card dark:bg-surface-900">{t('profilePage.nicheBusiness')}</option>
                             <option value="entertainment" className="bg-surface-card dark:bg-surface-900">{t('profilePage.nicheEntertainment')}</option>
                             <option value="other" className="bg-surface-card dark:bg-surface-900">{t('profilePage.nicheOther')}</option>
                          </select>
                          <div className="absolute right-10 top-1/2 -translate-y-1/2 text-primary-500 rotate-90 pointer-events-none transition-transform group-hover/select:rotate-0"><ArrowRight size={24} /></div>
                       </div>
                    </div>
                 </div>

                 <div className="pt-14 mt-14 border-t-2 border-surface-100 dark:border-surface-800 flex flex-col sm:flex-row items-center justify-between gap-10 relative z-10">
                    <div className="flex items-center gap-6 text-surface-400 dark:text-slate-600">
                       <ShieldCheck size={28} className="text-primary-500/50" />
                       <span className="text-[11px] font-black uppercase tracking-[0.4em] italic leading-none">{t('profilePage.encryptedNote')}</span>
                    </div>
                    <button type="button" onClick={saveProfile} disabled={saving}
                      className="w-full sm:w-auto px-16 py-7 bg-surface-900 dark:bg-white text-white dark:text-black font-black uppercase text-[12px] tracking-[0.8em] italic rounded-[2.5rem] hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all shadow-[0_30px_80px_rgba(0,0,0,0.4)] active:scale-95 flex items-center justify-center gap-8 border-none group/lock"
                    >
                      {saving ? <RefreshCw className="animate-spin" size={28} /> : <Lock size={28} className="group-hover/lock:rotate-12 transition-transform duration-500" />}
                      {saving ? t('profilePage.statusSaving') : t('profilePage.saveButton')}
                    </button>
                 </div>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 {[
                   { label: t('profilePage.statUptime'), val: '99.9%', icon: Activity, col: 'text-emerald-500' },
                   { label: t('profilePage.statAccount'), val: t('profilePage.statAccountValue'), icon: UserCheck, col: 'text-primary-500' },
                   { label: t('profilePage.stat2fa'), val: t('profilePage.stat2faValue'), icon: Shield, col: 'text-cyan-500' }
                 ].map((s, i) => (
                   <div key={i} className="bg-surface-card backdrop-blur-3xl p-8 rounded-[3rem] border border-surface-200 dark:border-surface-800 shadow-xl flex items-center gap-6 group hover:border-primary-500/30 transition-all duration-500">
                      <div className="w-14 h-14 rounded-2xl bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform duration-700">
                         <s.icon size={28} className={s.col} />
                      </div>
                      <div>
                         <p className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest italic mb-1">{s.label}</p>
                         <p className="text-sm font-black text-surface-900 dark:text-white uppercase italic tracking-tighter">{s.val}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </section>
        </div>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--color-primary-500), 0.1); border-radius: 10px; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
          select { -webkit-appearance: none; -moz-appearance: none; appearance: none; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

function UplinkField({ icon: Icon, label, value, placeholder, onChange }: { icon: any; label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-4 group/uplink">
       <div className="flex items-center gap-4 text-surface-300 dark:text-slate-800 italic px-4 group-hover/uplink:text-primary-500 transition-colors duration-700">
          <Icon size={18} />
          <span className="text-[10px] font-black uppercase tracking-[0.4em]">{label}</span>
       </div>
       <div className="relative">
          <input type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} title={label}
            className="w-full bg-surface-page dark:bg-surface-950/60 border-2 border-surface-100 dark:border-surface-800 rounded-2xl px-8 py-5 text-xs font-black text-primary-600 dark:text-primary-400 focus:outline-none focus:border-primary-500/40 transition-all placeholder:text-surface-200 dark:placeholder:text-slate-900 italic shadow-inner"
          />
       </div>
    </div>
  )
}

function ConfigField({ icon: Icon, label, value, placeholder, onChange, isLarge = false, isLocked = false }: { icon: any; label: string; value: string; placeholder: string; onChange: (v: string) => void; isLarge?: boolean; isLocked?: boolean }) {
  return (
    <div className="space-y-6 group/field">
       <label className="text-[11px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.6em] italic pl-8 group-hover/field:text-primary-500 transition-colors duration-700">{label}</label>
       <div className="relative">
          <Icon className={`absolute left-8 top-1/2 -translate-y-1/2 transition-all duration-500 ${isLocked ? 'text-surface-300 dark:text-slate-800' : 'text-surface-200 dark:text-slate-900 group-focus-within/field:text-primary-500 group-hover/field:scale-110'}`} size={isLarge ? 32 : 24} />
          <input
            type="text"
            value={value}
            onChange={(e) => !isLocked && onChange(e.target.value)}
            disabled={isLocked}
            className={`w-full bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 rounded-[3rem] pl-20 pr-10 py-8 transition-all duration-700 placeholder:text-surface-200 dark:placeholder:text-slate-900 italic shadow-inner font-black uppercase tracking-tighter ${
               isLarge ? 'text-3xl' : 'text-xl'
            } ${
               isLocked ? 'opacity-40 text-surface-300 dark:text-slate-800 cursor-not-allowed border-dashed' : 'text-surface-900 dark:text-white focus:outline-none focus:border-primary-500/50'
            }`}
            placeholder={placeholder}
            title={label}
          />
          {isLocked && <Lock size={18} className="absolute right-10 top-1/2 -translate-y-1/2 text-surface-200 dark:text-slate-900" />}
       </div>
    </div>
  )
}
