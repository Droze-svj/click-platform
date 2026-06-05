'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Activity, Database, Server, Cpu, 
  BarChart3, Clock, AlertCircle, CheckCircle2,
  Orbit, Signal, Shield, Binary, ZapOff,
  RefreshCw, TrendingUp, Search, Layers, Boxes
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

const glassStyle = 'backdrop-blur-2xl bg-white/[0.02] border border-white/10 shadow-2xl transition-all duration-500';

interface TelemetryData {
  logs: any[];
  metrics: {
    totalRequests: number;
    totalErrors: number;
    totalRetries: number;
    avgLatency: number;
  };
}

interface BatchJob {
  _id: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
}

export default function ScalingHub() {
  const { t } = useTranslation();
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updateTelemetry = () => {
      if (typeof window !== 'undefined') {
        setTelemetry((window as any).__CLICK_API_TELEMETRY__ || null);
      }
    };

    const fetchJobs = async () => {
      try {
        const response = await fetch('/api/content?status=processing', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();
        if (data.success) {
          setBatchJobs(data.data);
        }
      } catch (error) {
        console.error('Fetch batch jobs error:', error);
      } finally {
        setLoading(false);
      }
    };

    updateTelemetry();
    fetchJobs();

    const telemetryInterval = setInterval(updateTelemetry, 2000);
    const jobsInterval = setInterval(fetchJobs, 10000);

    return () => {
      clearInterval(telemetryInterval);
      clearInterval(jobsInterval);
    };
  }, []);

  return (
    <div className="space-y-12 font-inter">
      {/* Real-time Telemetry Pulse */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {[
          { label: t('scalingHub.neuralThroughput'), val: telemetry?.metrics.totalRequests || 0, unit: t('scalingHub.unitReqs'), icon: Activity, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { label: t('scalingHub.synapseLatency'), val: telemetry?.metrics.avgLatency?.toFixed(1) || '0', unit: t('scalingHub.unitMs'), icon: Clock, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: t('scalingHub.substrateErrors'), val: telemetry?.metrics.totalErrors || 0, unit: t('scalingHub.unitErrs'), icon: ZapOff, color: 'text-rose-400', bg: 'bg-rose-500/10' },
          { label: t('scalingHub.retryResilience'), val: telemetry?.metrics.totalRetries || 0, unit: t('scalingHub.unitTries'), icon: RefreshCw, color: 'text-amber-400', bg: 'bg-amber-500/10' }
        ].map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i} 
            className={cn(glassStyle, "p-8 rounded-[3rem] group hover:bg-white/[0.05]")}
          >
            <div className="flex items-center gap-6 mb-4">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner border border-white/5", stat.bg)}>
                <stat.icon className={cn("w-7 h-7", stat.color)} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-dim)] opacity-60 italic">{stat.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white tabular-nums">{stat.val}</span>
                  <span className={cn("text-[10px] font-bold uppercase", stat.color)}>{stat.unit}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Scaling Matrix & Jobs */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        <div className="xl:col-span-2 space-y-8">
          <div className="flex items-center justify-between px-6">
             <div className="flex items-center gap-4">
                <Boxes className="text-indigo-400" />
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">{t('scalingHub.scalingHubMatrix')}</h3>
             </div>
             <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{t('scalingHub.pipelineActive')}</span>
             </div>
          </div>

          <div className={cn(glassStyle, "rounded-[4rem] overflow-hidden")}>
             <div className="p-8 border-b border-white/5 bg-white/[0.01] grid grid-cols-12 text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] italic">
                <div className="col-span-6 pl-4">{t('scalingHub.substrateEntity')}</div>
                <div className="col-span-3">{t('scalingHub.entityType')}</div>
                <div className="col-span-3">{t('scalingHub.latticeStatus')}</div>
             </div>
             <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {batchJobs.length > 0 ? batchJobs.map((job, i) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.5, delay: i * 0.05 }}
                      key={job._id} 
                      className="p-8 border-b border-white/5 grid grid-cols-12 items-center hover:bg-white/[0.02] transition-colors group"
                    >
                      <div className="col-span-6 flex items-center gap-6 pl-4">
                         <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Binary className="w-5 h-5 text-indigo-400" />
                         </div>
                         <div>
                            <p className="text-[14px] font-bold text-white group-hover:text-indigo-300 transition-colors">{job.title}</p>
                            <p className="text-[10px] text-[var(--text-dim)] opacity-60 font-mono">{t('scalingHub.idLabel')} {job._id.substring(job._id.length - 8)}</p>
                         </div>
                      </div>
                      <div className="col-span-3">
                         <span className="px-4 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-indigo-400">{job.type}</span>
                      </div>
                      <div className="col-span-3 flex items-center gap-3">
                         <div className="w-24 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                            <motion.div 
                              animate={{ width: '100%' }}
                              transition={{ duration: 5, repeat: Infinity }}
                              className="h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,1)]" 
                            />
                         </div>
                         <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 animate-pulse italic">{job.status}</span>
                      </div>
                    </motion.div>
                  )) : (
                    <div className="py-32 flex flex-col items-center justify-center text-[var(--text-dim)]">
                       <ZapOff className="w-16 h-16 mb-6 opacity-20" />
                       <p className="text-[11px] font-black uppercase tracking-[0.6em] italic">{t('scalingHub.noActiveJobs')}</p>
                    </div>
                  )}
                </AnimatePresence>
             </div>
          </div>
        </div>

        <div className="space-y-8">
           <div className="flex items-center gap-4 px-6">
              <Signal className="text-amber-400" />
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">{t('scalingHub.integrityLogs')}</h3>
           </div>
           
           <div className={cn(glassStyle, "rounded-[4rem] p-8 h-[585px] relative overflow-hidden")}>
              <div className="absolute inset-0 pointer-events-none opacity-[0.02]">
                 <Orbit size={400} className="absolute -bottom-20 -right-20 text-white" />
              </div>
              <div className="space-y-4 overflow-y-auto h-full custom-scrollbar pr-4 relative z-10">
                 {telemetry?.logs?.slice().reverse().map((log, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 group hover:border-indigo-500/20 transition-colors">
                       <div className="flex items-center justify-between">
                          <span className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full", 
                             log.type === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                             log.type === 'retry' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                             'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          )}>
                             {log.type}
                          </span>
                          <span className="text-[9px] font-mono text-[var(--text-dim)] opacity-40">{new Date(log.timestamp).toLocaleTimeString()}</span>
                       </div>
                       <p className="text-[11px] font-mono text-indigo-300 break-all leading-tight group-hover:text-white transition-colors">
                          {log.method || 'GET'} {log.url}
                       </p>
                       {log.status && (
                          <div className="flex items-center gap-2">
                             <span className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest opacity-40 italic">{t('scalingHub.resultLabel')}</span>
                             <span className={cn("text-[9px] font-bold", log.status < 400 ? 'text-emerald-400' : 'text-rose-400')}>{log.status}</span>
                          </div>
                       )}
                    </div>
                 ))}
                 {!telemetry?.logs?.length && (
                    <div className="h-full flex flex-col items-center justify-center py-32 opacity-20">
                       <Search className="w-16 h-16 mb-4" />
                       <p className="text-[10px] font-black uppercase tracking-widest italic">{t('scalingHub.monitoringFlux')}</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
      `}</style>
    </div>
  );
}
