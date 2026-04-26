'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  User, Mail, Camera, Save, Key, ArrowLeft, 
  Globe, Instagram, Linkedin, MapPin, Activity, 
  Cpu, Layers, Lock, Shield, Twitter, Target,
  RefreshCw, Plus, X, ArrowRight, Zap, Terminal, Fingerprint, Network
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPut } from '../../../../lib/api'
import LoadingSkeleton from '../../../../components/LoadingSkeleton'
import ToastContainer from '../../../../components/ToastContainer'
import { useAuth } from '../../../../hooks/useAuth'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'

export default function IdentityMatrixInterfacePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    bio: '',
    website: '',
    location: '',
    social_links: {} as Record<string, string>,
    niche: '',
    profilePicture: null as File | null,
  })
  const [preview, setPreview] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    try {
      const profileData: any = await apiGet('/auth/profile')
      const u = profileData.user || profileData;
      setProfile({
        name: u.name || '',
        email: u.email || '',
        bio: u.bio || '',
        website: u.website || '',
        location: u.location || '',
        social_links: u.social_links || {},
        niche: u.niche || '',
        profilePicture: null,
      })
    } catch {
      if (user) {
        setProfile({
          name: user.name || '',
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
    try {
      const updateData = {
        name: profile.name,
        bio: profile.bio,
        website: profile.website,
        location: profile.location,
        social_links: profile.social_links,
        niche: profile.niche,
      }
      await apiPut('/auth/profile', updateData)
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'NODE_IDENTITY_SYNCHRONIZED', type: 'success' } }))
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'SYNC_ERR: UPLINK_ABORTED', type: 'error' } }))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
        <Fingerprint size={64} className="text-indigo-500 animate-pulse mb-8" />
        <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.6em] animate-pulse italic">Deciphering Identity DNA...</span>
     </div>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1500px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <User size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Matrix Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
           <div className="flex items-center gap-10">
              <button onClick={() => router.push('/dashboard/settings')} title="Back"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <ArrowLeft size={32} />
              </button>
              <div className="w-20 h-20 bg-indigo-500/5 border border-indigo-500/20 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Fingerprint size={40} className="text-indigo-400 relative z-10 group-hover:scale-110 transition-transform duration-700" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Cpu size={14} className="text-indigo-400 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Node Identity v8.4.1</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-inner">
                       <Shield size={12} className="text-emerald-400 animate-pulse" />
                       <span className="text-[9px] font-black text-emerald-400 tracking-widest uppercase italic leading-none">SIGNATURE_STABLE</span>
                   </div>
                 </div>
                 <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Identity</h1>
                 <p className="text-slate-400 text-[11px] uppercase font-black tracking-[0.4em] italic leading-none">Calibrating neural bio-synthesis, visual signature, and global node coordinates.</p>
              </div>
           </div>

           <button onClick={saveProfile} disabled={saving}
             className="px-16 py-8 bg-white text-black font-black uppercase text-[15px] tracking-[0.6em] italic rounded-[3rem] hover:bg-indigo-500 hover:text-white transition-all duration-700 shadow-[0_40px_100px_rgba(255,255,255,0.1)] active:scale-95 flex items-center gap-6 group relative overflow-hidden"
           >
             <div className="absolute inset-0 bg-indigo-600 translate-y-full group-hover:translate-y-0 transition-transform duration-700" />
             <div className="relative z-10 flex items-center gap-6">
               {saving ? <RefreshCw className="animate-spin" size={28} /> : <Lock size={28} className="group-hover:scale-110 transition-transform duration-700" />}
               {saving ? 'SYNCHRONIZING...' : 'LOCK_MISSION_IDENTITY'}
             </div>
           </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 relative z-10">
           {/* Visual Signature & Core Intel */}
           <div className="lg:col-span-1 space-y-16">
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                className={`${glassStyle} p-16 rounded-[6rem] flex flex-col items-center text-center space-y-12 border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.6)]`}
              >
                 <div className="relative group/avatar">
                    <div className="w-56 h-56 rounded-[4.5rem] bg-black/60 border border-white/10 p-3 shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-300 group-hover/avatar:border-indigo-500/40 group-hover/avatar:scale-105">
                       <div className="w-full h-full rounded-[3.8rem] overflow-hidden bg-white/[0.02] flex items-center justify-center relative">
                          {preview ? (
                            <img src={preview} alt="Profile" className="w-full h-full object-cover transition-transform duration-700 group-hover/avatar:scale-110 grayscale group-hover/avatar:grayscale-0" />
                          ) : (
                            <User className="w-24 h-24 text-slate-500 group-hover/avatar:text-indigo-400 transition-all duration-300" />
                          )}
                          <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-300" />
                       </div>
                    </div>
                    <label className="absolute -bottom-4 -right-4 w-20 h-20 bg-white text-black border-4 border-[#020205] rounded-[2rem] flex items-center justify-center cursor-pointer hover:bg-indigo-500 hover:text-white transition-all duration-700 shadow-2xl scale-100 hover:rotate-12 active:scale-90 group-hover/avatar:translate-x-2 group-hover/avatar:-translate-y-2">
                       <Camera size={32} />
                       <input type="file" accept="image/*" title="Visual Signature" aria-label="Visual Signature" onChange={handleImageChange} className="hidden" />
                    </label>
                 </div>
                 
                 <div className="space-y-4">
                    <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none truncate max-w-xs drop-shadow-2xl">{profile.name || 'Sovereign_Node'}</h3>
                    <div className="px-6 py-2 rounded-full bg-black/40 border border-white/5 shadow-inner">
                       <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.4em] italic leading-none">{profile.email || 'NULL_SIGNAL_PROTOCOL'}</p>
                    </div>
                 </div>

                 <div className="w-full pt-12 border-t border-white/5 flex flex-col gap-6">
                    {preview && (
                       <button onClick={() => { setPreview(null); setProfile(prev => ({ ...prev, profilePicture: null })) }} 
                         className="text-[11px] font-black text-rose-500 uppercase tracking-[0.5em] hover:text-white transition-all duration-700 p-4 italic bg-rose-500/5 rounded-2xl border border-rose-500/10 shadow-inner group/purge"
                       >
                          <div className="flex items-center justify-center gap-4">
                             <X size={16} className="group-hover:rotate-180 transition-transform" /> PURGE_VISUAL_SIGNATURE
                          </div>
                       </button>
                    )}
                    <div className="p-8 rounded-[3rem] bg-black/60 border border-white/5 flex items-center justify-between group cursor-default shadow-inner hover:border-indigo-500/30 transition-all duration-300">
                       <div className="flex items-center gap-5 text-slate-400 group-hover:text-indigo-400 transition-colors duration-700">
                          <Activity size={20} className="animate-pulse" />
                          <span className="text-[12px] font-black uppercase tracking-[0.4em] italic">Logic Tier</span>
                       </div>
                       <span className="text-[11px] font-black text-white italic bg-indigo-600 px-5 py-2 rounded-xl shadow-[0_0_30px_rgba(99,102,241,0.5)]">ELITE_SYNDICATE</span>
                    </div>
                 </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className={`${glassStyle} p-12 rounded-[5rem] space-y-12 border-white/5 shadow-[inset_0_0_50px_rgba(0,0,0,0.5)]`}
              >
                 <div className="flex items-center gap-6 border-b border-white/5 pb-8">
                    <Network size={20} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
                    <h3 className="text-[13px] font-black text-slate-500 uppercase tracking-[0.6em] italic leading-none">Mesh Hub Uplinks</h3>
                 </div>
                 <div className="space-y-10">
                    <UplinkField icon={Twitter} label="X_SIGNAL" value={profile.social_links.twitter || ''} placeholder="https://x.com/..." 
                      onChange={(v) => setProfile(prev => ({ ...prev, social_links: { ...prev.social_links, twitter: v } }))} />
                    <UplinkField icon={Linkedin} label="LINKEDIN_LATTICE" value={profile.social_links.linkedin || ''} placeholder="https://linkedin.com/..." 
                      onChange={(v) => setProfile(prev => ({ ...prev, social_links: { ...prev.social_links, linkedin: v } }))} />
                    <UplinkField icon={Instagram} label="INSTAGRAM_VISUAL" value={profile.social_links.instagram || ''} placeholder="https://instagram.com/..." 
                      onChange={(v) => setProfile(prev => ({ ...prev, social_links: { ...prev.social_links, instagram: v } }))} />
                 </div>
              </motion.div>
           </div>

           {/* Neural Synthesis Terminal */}
           <div className="lg:col-span-2 space-y-16">
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className={`${glassStyle} rounded-[6rem] p-24 border-white/5 relative overflow-hidden flex flex-col h-full shadow-[inset_0_0_100px_rgba(0,0,0,0.6)]`}
              >
                 <div className="absolute top-0 right-0 p-32 opacity-[0.01] pointer-events-none"><Terminal size={600} className="text-white" /></div>
                 
                 <div className="flex items-center gap-8 mb-20 relative z-10">
                    <div className="p-6 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/20 shadow-2xl"><Target size={40} className="text-indigo-400 animate-pulse" /></div>
                    <div>
                       <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Signature Terminal</h2>
                       <p className="text-[12px] text-slate-400 font-black uppercase tracking-[0.5em] italic leading-none">Calibrating neural bio-synthesis, operational parameters and mission hub coordinates.</p>
                    </div>
                 </div>

                 <div className="space-y-16 relative z-10 flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                       <ConfigField icon={User} label="Identity Designation" value={profile.name} placeholder="OPERATIVE_NAME" 
                         onChange={(v) => setProfile(prev => ({ ...prev, name: v }))} isLarge />
                       <ConfigField icon={Mail} label="Signal Frequency" value={profile.email} placeholder="NODE@SIGNAL.CORE" 
                         onChange={(v) => setProfile(prev => ({ ...prev, email: v }))} isLocked />
                    </div>

                    <div className="space-y-6">
                       <label className="text-[13px] font-black text-slate-400 uppercase tracking-[0.6em] italic pl-6">Neural Bio-Synthesis</label>
                       <div className="group relative">
                          <textarea
                            value={profile.bio}
                            onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value.slice(0, 500) }))}
                            rows={8}
                            placeholder="OUTLINE YOUR LOGIC PARADIGM AND CORE HEURISTICS..."
                            className="w-full bg-black/60 border border-white/10 rounded-[4rem] px-12 py-12 text-[18px] font-black text-white uppercase italic tracking-[0.1em] focus:outline-none focus:border-indigo-500/40 transition-all placeholder:text-slate-600 shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] leading-relaxed min-h-[300px] font-mono"
                            title="Bio"
                          />
                          <div className="absolute top-8 right-8 pointer-events-none opacity-5 group-focus-within:opacity-20 transition-opacity">
                             <Fingerprint size={120} className="text-white" />
                          </div>
                       </div>
                       <div className="flex justify-between items-center px-10">
                          <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic">
                             <Activity size={12} className="text-indigo-500 animate-pulse" /> RECURSIVE_OUTPUT_BUFFER
                          </div>
                          <span className={`text-[12px] font-black italic tracking-widest ${profile.bio.length > 450 ? 'text-rose-500' : 'text-slate-400'}`}>
                             {profile.bio.length} / 500_IDEATION_BITS
                          </span>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                       <ConfigField icon={Globe} label="Matrix Hub (Website)" value={profile.website} placeholder="HTTPS://MATRIX.HUB/..." 
                         onChange={(v) => setProfile(prev => ({ ...prev, website: v }))} />
                       <ConfigField icon={MapPin} label="Node Coordinates" value={profile.location} placeholder="CITY_CODE, SECTOR_ALPHA" 
                         onChange={(v) => setProfile(prev => ({ ...prev, location: v }))} />
                    </div>

                    <div className="space-y-6">
                       <label className="text-[13px] font-black text-slate-400 uppercase tracking-[0.6em] italic pl-6">Domain Expertise (Niche)</label>
                       <div className="relative group/select">
                          <select
                            value={profile.niche}
                            onChange={(e) => setProfile(prev => ({ ...prev, niche: e.target.value }))}
                            className="w-full bg-black/60 border border-white/10 rounded-[3rem] px-12 py-8 text-[15px] font-black text-indigo-400 uppercase italic tracking-[0.4em] focus:outline-none appearance-none cursor-pointer hover:bg-black/80 transition-all shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]"
                            title="Niche"
                          >
                             <option value="" className="bg-black">SELECT_DOMAIN_EXPERTISE</option>
                             <option value="health" className="bg-black">NEURAL_VITALITY (HEALTH)</option>
                             <option value="finance" className="bg-black">CAPITAL_ALGORITHMS (FINANCE)</option>
                             <option value="education" className="bg-black">COGNITIVE_UPLOAD (EDUCATION)</option>
                             <option value="technology" className="bg-black">SYNTHETIC_LOGIC (TECH)</option>
                             <option value="lifestyle" className="bg-black">LATTICE_LIVING (LIFESTYLE)</option>
                             <option value="business" className="bg-black">ENTERPRISE_SWARM (BUSINESS)</option>
                             <option value="entertainment" className="bg-black">KINETIC_FLOW (ENTERTAINMENT)</option>
                             <option value="other" className="bg-black">NULL_CATEGORY_OVERRIDE</option>
                          </select>
                          <div className="absolute right-12 top-1/2 -translate-y-1/2 text-indigo-400 rotate-90 pointer-events-none transition-transform group-hover/select:rotate-0"><ArrowRight size={28} /></div>
                       </div>
                    </div>
                 </div>

                 <div className="pt-20 mt-20 border-t border-white/5 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-6 text-slate-500 group-hover:text-indigo-400 transition-colors duration-300">
                       <Shield size={24} className="text-indigo-600/50" />
                       <span className="text-[12px] font-black uppercase tracking-[0.4em] italic leading-none">Encryption_Standard: AES-256_SOVEREIGN</span>
                    </div>
                    <button onClick={saveProfile} disabled={saving}
                      className="px-24 py-10 bg-white text-black font-black uppercase text-[18px] tracking-[0.6em] italic rounded-[4rem] hover:bg-indigo-600 hover:text-white transition-all duration-300 shadow-[0_40px_100px_rgba(255,255,255,0.1)] active:scale-95 flex items-center gap-10 group/lock relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-indigo-600 translate-y-full group-hover:translate-y-0 transition-transform duration-700" />
                      <div className="relative z-10 flex items-center gap-10">
                        {saving ? <RefreshCw className="animate-spin" size={32} /> : <Lock size={32} className="group-hover/lock:scale-110 transition-transform duration-300" />}
                        {saving ? 'SYNCHRONIZING...' : 'LOCK_MISSION_IDENTITY'}
                      </div>
                    </button>
                 </div>
              </motion.div>
           </div>
        </div>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          select { -webkit-appearance: none; -moz-appearance: none; appearance: none; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

function UplinkField({ icon: Icon, label, value, placeholder, onChange }: { icon: any; label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-5 group/uplink">
       <div className="flex items-center gap-4 text-slate-400 italic px-4 group-hover/uplink:text-indigo-400 transition-colors duration-700">
          <Icon size={18} />
          <span className="text-[11px] font-black uppercase tracking-[0.5em]">{label}</span>
       </div>
       <div className="relative">
          <input type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} title={label}
            className="w-full bg-black/40 border border-white/5 rounded-[2rem] px-10 py-6 text-[13px] font-mono text-indigo-400 focus:outline-none focus:border-indigo-500/30 transition-all placeholder:text-slate-600 italic shadow-[inset_0_0_30px_rgba(0,0,0,0.5)]"
          />
          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/uplink:opacity-100 transition-opacity">
             <Zap size={14} className="text-indigo-400 animate-pulse" />
          </div>
       </div>
    </div>
  )
}

function ConfigField({ icon: Icon, label, value, placeholder, onChange, isLarge = false, isLocked = false }: { icon: any; label: string; value: string; placeholder: string; onChange: (v: string) => void; isLarge?: boolean; isLocked?: boolean }) {
  return (
    <div className="space-y-6 group/field">
       <label className="text-[13px] font-black text-slate-400 uppercase tracking-[0.6em] italic pl-8 group-hover/field:text-indigo-400/50 transition-colors duration-700">{label}</label>
       <div className="relative group">
          <Icon className={`absolute left-8 top-1/2 -translate-y-1/2 transition-all duration-300 ${isLocked ? 'text-slate-500 group-hover:text-amber-500/50' : 'text-slate-500 group-focus-within:text-indigo-400 group-hover:scale-110'}`} size={isLarge ? 28 : 22} />
          <input
            type="text"
            value={value}
            onChange={(e) => !isLocked && onChange(e.target.value)}
            disabled={isLocked}
            className={`w-full bg-black/60 border border-white/10 rounded-[3rem] pl-20 pr-10 py-8 transition-all duration-700 placeholder:text-slate-600 italic shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] font-black uppercase tracking-widest ${
               isLarge ? 'text-3xl' : 'text-xl'
            } ${
               isLocked ? 'opacity-40 text-slate-500 cursor-not-allowed border-dashed' : 'text-white focus:outline-none focus:border-indigo-500/50'
            }`}
            placeholder={placeholder}
            title={label}
          />
          {isLocked && <Lock size={16} className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-500" />}
       </div>
    </div>
  )
}
