'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Server, Database, Cpu, HardDrive, ShieldAlert, 
  ArrowLeft, Activity, Radio, Terminal, Fingerprint, 
  Compass, Boxes, Layout, Layers, Timer, Box, 
  Monitor, ChevronRight, X, Eye, RefreshCw, Zap, Target,
  Workflow, Binary, Orbit, Scan, Command, Wind, Ghost,
  Signal, ShieldCheck, ActivityIcon, CpuIcon, Shield,
  Lock, Key, Anchor, Sparkle, Gauge, Network, UserCheck
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import InfrastructureDashboard from '../../../components/InfrastructureDashboard';
import ToastContainer from '../../../components/ToastContainer';
import { ErrorBoundary } from '../../../components/ErrorBoundary';

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-3xl transition-all duration-1000'

export const dynamic = 'force-dynamic';

export default function SubstrateIntegrityTerminalPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const checkAdmin = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) return;

        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        const userData = data.user || data.data?.user;
        const isAdm = userData?.role === 'admin' || userData?.isAdmin === true;
        setIsAdmin(isAdm);
      } catch (error) {
        console.error('Failed to check admin status', error);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [user, router]);

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen font-inter">
        <Server size={64} className="text-indigo-500 animate-pulse mb-8" />
        <span className="text-[12px] font-black text-slate-800 uppercase tracking-[0.6em] animate-pulse italic">Synchronizing Substrate Telemetry...</span>
     </div>
  );

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#020205] flex items-center justify-center p-12 font-inter relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
           <Shield size={1200} className="text-white absolute -top-40 -right-40 rotate-[30deg] blur-[2px]" />
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.9, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.8 }}
          className={`${glassStyle} p-32 rounded-[6rem] max-w-3xl text-center border-rose-500/20 shadow-[0_40px_150px_rgba(225,29,72,0.1)] relative z-10 bg-black/40 backdrop-blur-[100px]`}
        >
           <div className="w-32 h-32 bg-rose-500/10 rounded-[3.5rem] border-4 border-rose-500/20 flex items-center justify-center mx-auto mb-16 shadow-3xl animate-pulse">
              <ShieldAlert size={80} className="text-rose-500" />
           </div>
           <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter mb-8 leading-none drop-shadow-2xl">Access Diffracted</h2>
           <p className="text-[16px] font-black text-slate-800 uppercase tracking-[0.5em] italic leading-relaxed mb-16 max-w-xl mx-auto border-l-4 border-rose-500/20 pl-8">
             Mission critical substrate telemetry is restricted to administrative entities. Your entry vector has been logged into the Sovereign Integrity Ledger.
           </p>
           <button onClick={() => router.push('/dashboard')} 
             className="px-16 py-8 bg-white text-black rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] hover:bg-rose-600 hover:text-white transition-all duration-700 italic shadow-[0_40px_100px_rgba(255,255,255,0.1)] active:scale-90 flex items-center gap-6 mx-auto group">
             <ArrowLeft size={24} className="group-hover:-translate-x-2 transition-transform" /> RETURN_TO_BASE
           </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1700px] mx-auto space-y-24 font-inter">
        <ToastContainer />
        
        {/* Background Substrate Layer */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Server size={1200} className="text-white absolute -bottom-40 -left-60 rotate-12 blur-[1px]" />
           <Cpu size={1000} className="text-white absolute -top-80 -right-40 rotate-[32deg] blur-[2px]" />
        </div>

        {/* Substrate Integrity Header HUD */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
           <div className="flex items-center gap-10">
              <button onClick={() => router.push('/dashboard')} title="Abort"
                className="w-20 h-20 rounded-[2.5rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all duration-700 hover:scale-110 active:scale-90 shadow-3xl hover:border-indigo-500/50 backdrop-blur-3xl group">
                <ArrowLeft size={36} className="group-hover:-translate-x-2 transition-transform duration-700" />
              </button>
              <div className="w-24 h-24 bg-indigo-500/5 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-[0_40px_150px_rgba(99,102,241,0.3)] relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Server size={48} className="text-indigo-400 relative z-10 group-hover:scale-125 transition-transform duration-1000 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-4">
                   <div className="flex items-center gap-3">
                      <Fingerprint size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.8em] text-indigo-400 italic leading-none">Substrate Telemetry v18.4.2</span>
                   </div>
                   <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-indigo-500/10 border-2 border-indigo-500/20 shadow-inner">
                       <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,1)]" />
                       <span className="text-[10px] font-black text-indigo-400 tracking-widest uppercase italic leading-none">CORE_STABILITY_SECURED</span>
                   </div>
                 </div>
                 <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none mb-3 drop-shadow-2xl">Integrity</h1>
                 <p className="text-slate-800 text-[13px] uppercase font-black tracking-[0.6em] mt-5 italic leading-none">Full-spectrum system resource monitoring, neural capacity calibration, and substrate operations matrix.</p>
              </div>
           </div>

           <div className="flex items-center gap-12">
              <div className={`${glassStyle} px-12 py-8 rounded-[3.5rem] flex items-center gap-8 border-indigo-500/20 bg-indigo-500/5 shadow-3xl group`}>
                 <div className="w-16 h-16 rounded-[1.8rem] bg-indigo-500/10 flex items-center justify-center border-2 border-indigo-500/20 shadow-2xl group-hover:rotate-12 transition-transform duration-700">
                    <Activity size={32} className="text-indigo-400 animate-pulse" />
                 </div>
                 <div>
                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-[0.5em] italic leading-none opacity-40">RESISTANCE_STATUS</span>
                    <p className="text-2xl font-black text-indigo-400 uppercase tracking-[0.4em] italic leading-none mt-2">SYSTEM_OPTIMAL</p>
                 </div>
              </div>
              <button onClick={() => window.location.reload()} className={`${glassStyle} w-20 h-20 rounded-[2.5rem] border-2 flex items-center justify-center group shadow-3xl active:scale-90 border-white/5 bg-black/40 backdrop-blur-3xl`}>
                <RefreshCw size={32} className="text-slate-900 group-hover:text-indigo-400 transition-colors duration-700 group-hover:rotate-180 transition-transform" />
              </button>
           </div>
        </header>

        {/* Neural Substrate Operations Matrix */}
        <main className="relative z-10 space-y-24">
           {/* Primary Telemetry Dashboard */}
           <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}
             className={`${glassStyle} rounded-[7rem] overflow-hidden p-8 bg-black/40 shadow-[0_100px_300px_rgba(0,0,0,1)]`}
           >
              <div className="p-16 border-b-2 border-white/5 flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden bg-white/[0.02]">
                 <div className="absolute top-0 right-0 p-16 opacity-[0.03] pointer-events-none group-hover:opacity-[0.1] transition-opacity duration-[5s]"><Orbit size={500} className="text-white" /></div>
                 <div className="flex items-center gap-10 relative z-10">
                    <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center shadow-3xl"><Database size={40} className="text-indigo-400" /></div>
                    <div>
                       <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-3 drop-shadow-2xl">Operations Matrix</h2>
                       <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.6em] italic leading-none border-l-4 border-indigo-500/20 pl-8 ml-4">Lattice density: 1.4PB // Neural Flux: 12.8 GHz</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-6 relative z-10">
                    <div className="px-10 py-4 bg-black/60 rounded-full border-2 border-white/5 shadow-inner">
                       <span className="text-[11px] font-black text-slate-900 uppercase tracking-[0.5em] italic">TELEMETRY_SCAN_ACTIVE</span>
                    </div>
                 </div>
              </div>
              
              <div className="p-8">
                 <InfrastructureDashboard />
              </div>
           </motion.div>

           {/* Heuristic Resource Monitoring Grid */}
           <section className="grid grid-cols-1 xl:grid-cols-3 gap-16 relative z-10">
              {[
                { label: 'Neural Buffer', val: '92.4%', icon: Brain, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                { label: 'Lattice Capacity', val: '42.8 TB', icon: HardDrive, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'Swarm Latency', val: '12 ms', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' }
              ].map((s, i) => (
                <motion.div initial={{ opacity: 0, scale: 0.9, x: i % 2 === 0 ? -50 : 50 }} whileInView={{ opacity: 1, scale: 1, x: 0 }} transition={{ duration: 0.8, delay: i * 0.1 }}
                  key={i} className={`${glassStyle} p-16 rounded-[5.5rem] group bg-black/40 relative overflow-hidden flex flex-col items-center text-center hover:border-indigo-500/40 shadow-3xl border-white/5`}
                >
                  <div className="absolute top-0 right-0 p-16 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity duration-1000 pointer-events-none group-hover:rotate-12 group-hover:scale-150"><s.icon size={250} /></div>
                  <div className="flex items-center justify-center mb-12 w-full">
                    <div className={`w-28 h-28 rounded-[3.5rem] ${s.bg} border-2 border-white/5 flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-all duration-1000 scale-110 group-hover:border-white/10`}>
                      <s.icon className={`w-14 h-14 ${s.color} drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]`} />
                    </div>
                  </div>
                  <p className="text-[14px] font-black text-slate-900 uppercase tracking-[0.8em] mb-6 italic leading-none opacity-60 group-hover:text-white transition-colors">{s.label}</p>
                  <h3 className="text-6xl font-black text-white italic tracking-tighter tabular-nums leading-none mb-4 group-hover:text-indigo-400 transition-colors duration-1000 drop-shadow-2xl">{s.val}</h3>
                  <div className="w-48 h-1.5 bg-black/60 rounded-full mt-4 overflow-hidden border border-white/5">
                     <motion.div initial={{ width: 0 }} whileInView={{ width: '80%' }} transition={{ duration: 2, delay: 0.5 }} className={`h-full bg-gradient-to-r from-transparent to-current ${s.color} opacity-40`} />
                  </div>
                </motion.div>
              ))}
           </section>
        </main>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.4); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.5); }
          .shadow-3xl { filter: drop-shadow(0 40px 100px rgba(0,0,0,0.8)); }
        `}</style>
      </div>
    </ErrorBoundary>
  );
}
