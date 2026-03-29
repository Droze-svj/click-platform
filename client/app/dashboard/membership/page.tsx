'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { 
  Shield, Zap, Activity, Cpu, Database, 
  Globe, Radio, ArrowUpRight, CheckCircle2, 
  Lock, Unlock, Target, Terminal, Layers, 
  Settings2, Box, Sparkles,
  ArrowLeft, Fingerprint, Gauge, Network, Brain, ArrowRight,
  Workflow, Binary, Orbit, Scan, Command, Wind, Ghost,
  Signal, ShieldCheck, ActivityIcon, CpuIcon, HardDrive,
  UserCheck, Key, Anchor, Sparkle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'

// Force dynamic rendering to avoid SSR issues with localStorage
export const dynamic = 'force-dynamic'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface MembershipPackage {
  _id: string; name: string; slug: string; description: string;
  price: { monthly: number; yearly: number };
  features: any;
  limits: any;
}

interface CurrentMembership {
  package: MembershipPackage | null;
  subscription: any;
  usage: any;
  limits: any;
}

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-3xl transition-all duration-1000'

export default function IdentityDNARegistryPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [packages, setPackages] = useState<MembershipPackage[]>([])
  const [currentMembership, setCurrentMembership] = useState<CurrentMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)

  const loadAccessData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const [packagesRes, membershipRes] = await Promise.all([
        axios.get(`${API_URL}/membership/packages`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/membership/current`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])

      const pkgs = packagesRes.data.success ? packagesRes.data.data : (packagesRes.data.packages || packagesRes.data)
      const current = membershipRes.data.success ? membershipRes.data.data : (membershipRes.data.membership || membershipRes.data)
      
      setPackages(Array.isArray(pkgs) ? pkgs : [])
      setCurrentMembership(current)
    } catch {
      showToast('SYNC_ERR: ACCESS_DATA_OFFLINE', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!user && !loading) {
      router.push('/login')
      return
    }
    loadAccessData()
  }, [user, router, loadAccessData, loading])

  const handleEscalateProtocol = async (packageSlug: string) => {
    setUpgrading(packageSlug)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/membership/upgrade`,
        { packageSlug },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        showToast('✓ NEURAL_ASCENSION_COMPLETE', 'success')
        await loadAccessData()
      }
    } catch (error: any) {
      showToast(error.response?.data?.error || 'ASCENSION_FAILED: PROTOCOL_REJECTED', 'error')
    } finally {
      setUpgrading(null)
    }
  }

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen font-inter">
        <Fingerprint size={64} className="text-indigo-500 animate-pulse mb-8" />
        <span className="text-[12px] font-black text-slate-800 uppercase tracking-[0.6em] animate-pulse italic">Synchronizing Access Protocols...</span>
     </div>
  );

  const currentPackageSlug = currentMembership?.package?.slug

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1700px] mx-auto space-y-24 font-inter">
        <ToastContainer />
        
        {/* Persistent Matrix Layer */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Layers size={1200} className="text-white absolute -bottom-40 -left-60 rotate-12 blur-[1px]" />
           <Shield size={1000} className="text-white absolute -top-80 -right-40 rotate-[32deg] blur-[2px]" />
        </div>

        {/* Identity Header HUD */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
           <div className="flex items-center gap-10">
              <button onClick={() => router.push('/dashboard')} title="Abort"
                className="w-20 h-20 rounded-[2.5rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all duration-700 hover:scale-110 active:scale-90 shadow-3xl hover:border-indigo-500/50 backdrop-blur-3xl group">
                <ArrowLeft size={36} className="group-hover:-translate-x-2 transition-transform duration-700" />
              </button>
              <div className="w-24 h-24 bg-indigo-500/5 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-[0_40px_150px_rgba(99,102,241,0.3)] relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Fingerprint size={48} className="text-indigo-400 relative z-10 group-hover:scale-125 transition-transform duration-1000 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-4">
                   <div className="flex items-center gap-3">
                      <Lock size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.8em] text-indigo-400 italic leading-none">Identity DNA v22.8.4</span>
                   </div>
                   <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-black/60 border-2 border-white/5 shadow-inner">
                       <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,1)]" />
                       <span className="text-[10px] font-black text-slate-800 tracking-widest uppercase italic leading-none">STRATUM_LOCK_SECURED</span>
                   </div>
                 </div>
                 <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none mb-3 drop-shadow-2xl">Stratum</h1>
                 <p className="text-slate-800 text-[13px] uppercase font-black tracking-[0.6em] mt-5 italic leading-none">Neural tier orchestration, operational saturation thresholds, and substrate access protocols.</p>
              </div>
           </div>

           <div className="flex items-center gap-12">
              <div className={`${glassStyle} px-12 py-8 rounded-[3.5rem] flex items-center gap-8 border-indigo-500/20 bg-indigo-500/5 shadow-3xl group`}>
                 <div className="w-16 h-16 rounded-[1.8rem] bg-indigo-500/10 flex items-center justify-center border-2 border-indigo-500/20 shadow-2xl group-hover:rotate-12 transition-transform duration-700">
                    <Activity size={32} className="text-indigo-400 animate-pulse" />
                 </div>
                 <div>
                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-[0.5em] italic leading-none opacity-40">LATTICE_INTEGRITY</span>
                    <p className="text-2xl font-black text-indigo-400 uppercase tracking-[0.4em] italic leading-none mt-2">PROTOCOLS_ACTIVE</p>
                 </div>
              </div>
              <button onClick={() => loadAccessData()} className={`${glassStyle} w-20 h-20 rounded-[2.5rem] border-2 flex items-center justify-center group shadow-3xl active:scale-90 border-white/5 bg-black/40 backdrop-blur-3xl`}>
                <RefreshCw size={32} className="text-slate-900 group-hover:text-indigo-400 transition-colors duration-700 group-hover:rotate-180 transition-transform" />
              </button>
           </div>
        </header>

        {/* Current Protocol Presence HUD */}
        {currentMembership && (
          <motion.section initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }}
            className={`${glassStyle} p-32 rounded-[7rem] border-indigo-500/30 shadow-[0_100px_300px_rgba(0,0,0,1)] relative overflow-hidden group z-10 bg-black/40`}
          >
            <div className="absolute top-0 right-0 p-32 opacity-[0.03] pointer-events-none group-hover:opacity-[0.1] transition-opacity duration-[3s]"><Network size={800} className="text-indigo-400" /></div>
            <div className="flex flex-col xl:flex-row justify-between items-center gap-24 relative z-10">
               <div className="max-w-2xl text-center xl:text-left space-y-12">
                  <div className="flex flex-wrap items-center justify-center xl:justify-start gap-8">
                     <div className="px-10 py-4 rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.6em] bg-indigo-500/10 border-2 border-indigo-500/30 text-indigo-400 shadow-3xl italic animate-pulse">
                        ACTIVE_NODE_UPLINK
                     </div>
                     <div className="flex items-center gap-6 text-[12px] font-black text-slate-800 uppercase tracking-[0.4em] italic leading-none bg-black/80 px-10 py-4 rounded-[2rem] border-2 border-white/5 shadow-inner">
                       <Database size={20} className="text-indigo-400" /> <span className="opacity-40">PROTOCOL_ID:</span> {currentMembership.subscription?.id?.slice(-16).toUpperCase() || 'ROOT_GENESIS'}
                     </div>
                  </div>
                  <h2 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none group-hover:text-indigo-400 transition-colors duration-1000 drop-shadow-2xl">
                     {currentMembership.package?.name?.toUpperCase() || 'GENERIC_ACCESS'}
                  </h2>
                  <div className="flex items-center justify-center xl:justify-start gap-10 text-[18px] font-black uppercase tracking-[0.6em] italic leading-none">
                     <span className="text-slate-800">Lifecycle Status:</span>
                     <span className={currentMembership.subscription?.status === 'active' ? 'text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'text-amber-400 animate-pulse'}>
                        {currentMembership.subscription?.status?.toUpperCase() || 'UNINITIALIZED'}
                     </span>
                  </div>
                  <div className="w-full h-[6px] bg-black/60 rounded-full mt-4 overflow-hidden border-2 border-white/5 relative">
                     <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 4, ease: "circIn" }} className="h-full bg-gradient-to-r from-indigo-900 via-indigo-500 to-indigo-300 shadow-[0_0_30px_rgba(99,102,241,1)]" />
                  </div>
               </div>

               <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-12 p-8 rounded-[5rem] bg-black/20 border-2 border-white/5 shadow-inner backdrop-blur-3xl">
                  <SaturationCard icon={Target} label="Spectral Video Flux" value={currentMembership.usage?.videosProcessed || 0} limit={currentMembership.limits?.videosPerMonth} />
                  <SaturationCard icon={Sparkles} label="Logic Synthesis Bandwidth" value={currentMembership.usage?.contentGenerated || 0} limit={currentMembership.limits?.contentPerMonth} />
               </div>
            </div>
          </motion.section>
        )}

        {/* Access Stratum Matrix Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-16 relative z-10">
          {(packages || []).map((pkg) => {
            const isCurrent = currentPackageSlug === pkg.slug
            const isUpgrading = upgrading === pkg.slug

            return (
              <motion.div layout key={pkg._id} whileHover={{ y: -30, scale: 1.05 }}
                className={`${glassStyle} rounded-[6rem] p-16 group relative flex flex-col h-full border-white/5 hover:border-indigo-500/50 transition-all duration-1000 shadow-[0_40px_100px_rgba(0,0,0,0.8)] ${isCurrent ? 'bg-indigo-500/[0.06] border-indigo-500/60 ring-[40px] ring-indigo-500/[0.04] shadow-[0_100px_300px_rgba(0,0,0,1)]' : 'bg-black/40'}`}
              >
                {isCurrent && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[14px] font-black uppercase tracking-[1em] px-16 py-5 rounded-full shadow-[0_0_100px_rgba(99,102,241,0.8)] z-20 italic border-4 border-indigo-400/50">
                     ACTIVE_NODE
                  </div>
                )}

                <div className="text-center mb-16 px-8 pt-8">
                  <div className="flex items-center justify-center gap-8 mb-12">
                     <div className="w-20 h-[3px] bg-gradient-to-r from-transparent to-indigo-500/20 rounded-full" />
                     <span className="text-[14px] font-black text-slate-900 uppercase tracking-[1em] italic leading-none whitespace-nowrap opacity-60">Stratum Tier</span>
                     <div className="w-20 h-[3px] bg-gradient-to-l from-transparent to-indigo-500/20 rounded-full" />
                  </div>
                  <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-10 group-hover:text-indigo-400 transition-colors duration-1000 leading-none drop-shadow-2xl">{pkg.name.toUpperCase()}</h3>
                  <p className="text-[16px] text-slate-700 font-bold uppercase italic tracking-widest leading-relaxed mb-16 h-16 line-clamp-2 px-4 shadow-[0_10px_20px_rgba(0,0,0,0.4)]">{pkg.description.toUpperCase()}</p>
                  
                  <div className="py-20 bg-black/60 rounded-[5rem] border-4 border-white/5 mb-16 shadow-inner group-hover:bg-black/80 transition-all duration-1000 relative overflow-hidden group/price">
                    <div className="absolute inset-x-0 bottom-0 h-2 bg-indigo-500/20 animate-pulse" />
                    <div className="flex items-center justify-center gap-6 relative z-10">
                       <span className="text-8xl font-black text-white italic tracking-tighter tabular-nums leading-none drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">${pkg.price.monthly}</span>
                       <span className="text-[16px] font-black text-slate-800 uppercase tracking-[0.5em] italic mb-6">/cycle</span>
                    </div>
                    {pkg.price.yearly > 0 && (
                      <div className="mt-8 relative z-10">
                         <span className="px-8 py-2 rounded-full bg-indigo-500/10 border-2 border-indigo-500/20 text-indigo-400 text-[12px] font-black uppercase tracking-[0.8em] italic">
                           ANNUAL_SYNC: ${pkg.price.yearly}/YR
                         </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-10 mb-24 px-8">
                  <FeatureBox icon={Activity} label="Spectral Video Flux" value={pkg.features.videoProcessing.maxVideosPerMonth === -1 ? 'Infinite Cognition' : `${pkg.features.videoProcessing.maxVideosPerMonth} NODES / CYCLE`} />
                  <FeatureBox icon={Sparkles} label="Synthesis Bandwidth" value={pkg.features.contentGeneration.maxGenerationsPerMonth === -1 ? 'Infinite Neural Bursts' : `${pkg.features.contentGeneration.maxGenerationsPerMonth} BURSTS / CYCLE`} />

                  <div className="space-y-8 pt-12 border-t-2 border-white/5">
                     {[
                       { check: pkg.features.analytics.advancedAnalytics, label: 'Deep Spectral Intel' },
                       { check: pkg.features.analytics.apiAccess, label: 'Core Matrix Uplink' },
                       { check: pkg.features.support.prioritySupport, label: 'Prime Command Uplink' }
                     ].map((f, i) => f.check && (
                       <div key={i} className="flex items-center gap-8 text-[14px] font-black text-slate-800 uppercase italic tracking-[0.3em] group-hover:text-white transition-colors duration-700">
                         <div className="w-8 h-8 rounded-2xl border-2 border-indigo-500/30 flex items-center justify-center bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.3)] group-hover:scale-125 transition-transform">
                            <CheckCircle2 size={18} className="text-indigo-400" />
                         </div>
                         {f.label}
                       </div>
                     ))}
                  </div>
                </div>

                <div className="px-8 pb-8">
                   <button onClick={() => handleEscalateProtocol(pkg.slug)} disabled={isCurrent || isUpgrading}
                     className={`w-full py-12 rounded-[3.5rem] text-[18px] font-black uppercase tracking-[0.8em] transition-all duration-1000 shadow-3xl flex items-center justify-center gap-10 italic group/btn relative overflow-hidden active:scale-95 border-none outline-none ${
                       isCurrent ? 'bg-white/5 text-slate-900 border-2 border-white/10 cursor-not-allowed' : 'bg-white text-black hover:bg-indigo-600 hover:text-white'
                     }`}
                   >
                     <div className="absolute inset-0 bg-indigo-500 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-1000" />
                     <div className="relative z-10 flex items-center gap-10">
                       {isCurrent ? 'ACTIVE_PROTOCOL' : isUpgrading ? 'ASCENDING...' : pkg.price.monthly === 0 ? 'GENESIS_UPLINK' : 'ESCALATE_PROTOCOL'}
                       {!isCurrent && <ArrowUpRight size={36} className="group-hover/btn:translate-x-4 group-hover/btn:-translate-y-4 transition-transform duration-1000" />}
                     </div>
                   </button>
                </div>
              </motion.div>
            )
          })}
        </section>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.4); border-radius: 10px; }
          ::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 10px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.5); }
          .shadow-3xl { filter: drop-shadow(0 40px 100px rgba(0,0,0,0.8)); }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

function SaturationCard({ icon: Icon, label, value, limit }: { icon: any; label: string; value: number; limit: number }) {
  const percent = limit === -1 ? 5 : Math.min(100, (value / (limit || 1)) * 100)
  return (
    <div className="bg-black/60 border-2 border-white/5 p-16 rounded-[4.5rem] group/sat hover:border-indigo-500/40 transition-all duration-1000 shadow-inner backdrop-blur-3xl relative overflow-hidden">
       <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.02] to-transparent opacity-0 group-hover/sat:opacity-100 transition-opacity" />
       <div className="flex justify-between items-center mb-12 relative z-10">
          <span className="text-[15px] font-black text-slate-800 uppercase tracking-[0.8em] italic leading-none group-hover/sat:text-indigo-400 transition-colors">{label}</span>
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border-2 border-white/5 flex items-center justify-center shadow-3xl group-hover/sat:rotate-12 transition-transform duration-1000">
             <Icon size={32} className="text-slate-900 group-hover/sat:text-indigo-500" />
          </div>
       </div>
       <div className="flex items-end gap-10 mb-12 relative z-10">
          <span className="text-7xl font-black text-white italic tabular-nums leading-none tracking-tighter drop-shadow-2xl">
             {value}
             {limit !== -1 && <span className="text-slate-900 ml-4 opacity-40 text-4xl"> / {limit}</span>}
          </span>
       </div>
       <div className="h-4 w-full bg-black/80 rounded-full overflow-hidden shadow-inner border-2 border-white/5 p-0.5 relative z-10">
          <motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 3, ease: 'circOut' }}
            className="h-full bg-gradient-to-r from-indigo-900 to-indigo-400 shadow-[0_0_40px_rgba(99,102,241,0.8)] rounded-full relative" >
             <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </motion.div>
       </div>
    </div>
  )
}

function FeatureBox({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-black/80 p-12 rounded-[3.5rem] border-2 border-white/5 hover:border-indigo-500/40 transition-all duration-1000 cursor-default shadow-inner group/feat relative overflow-hidden">
       <div className="absolute inset-0 bg-indigo-500/[0.03] opacity-0 group-hover/feat:opacity-100 transition-opacity" />
       <div className="flex items-center gap-6 text-[13px] font-black text-slate-900 uppercase tracking-[0.6em] mb-8 italic group-hover/feat:text-indigo-400 transition-colors relative z-10">
          <Icon size={24} className="text-indigo-500 animate-pulse" /> {label}
       </div>
       <p className="text-[20px] font-black text-white uppercase italic tracking-[0.4em] leading-none group-hover/feat:text-white transition-colors relative z-10 drop-shadow-2xl">{value.toUpperCase()}</p>
    </div>
  )
}
