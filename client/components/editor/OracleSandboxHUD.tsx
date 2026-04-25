'use client'

import React, { useState } from 'react'
import { 
  TestTube2, 
  TrendingUp, 
  DollarSign, 
  Zap, 
  ArrowUpRight,
  Target,
  FlaskConical,
  BarChart3,
  Search
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiPost } from '../../lib/api'

interface OracleVariant {
  variantId: string
  type: string
  budget: number
  status: string
  velocity: number
}

interface OracleSandboxHUDProps {
  projectId?: string
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

export const OracleSandboxHUD: React.FC<OracleSandboxHUDProps> = ({ projectId, showToast }) => {
  const [isDeploying, setIsDeploying] = useState(false)
  const [sandbox, setSandbox] = useState<{
    sandboxId: string
    variants: OracleVariant[]
    scalingLogic: string
  } | null>(null)

  const deploySandbox = async () => {
    setIsDeploying(true)
    try {
      const data = await apiPost('/phase9/oracle-sandbox/deploy', { projectId: projectId || 'current' })
      setSandbox(data)
      showToast('Oracle Concept Sandbox Deployed', 'success')
    } catch (err) {
      showToast('Sandbox Deployment Failed', 'error')
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <div className={`${glassStyle} rounded-[3rem] p-10 space-y-8 relative overflow-hidden group`}>
        {/* Background Decorative */}
        <div className="absolute -bottom-20 -right-20 opacity-5 pointer-events-none">
            <FlaskConical className="w-80 h-80 text-white" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-6">
                <div className="p-4 rounded-[1.2rem] bg-indigo-500/10 border border-indigo-500/20">
                    <FlaskConical className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                <h4 className="text-2xl font-black text-white italic tracking-tighter leading-none uppercase">Oracle Sandbox</h4>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 block italic text-indigo-500/70">Autonomous Micro-Budget Variant Testing</span>
                </div>
            </div>

            <button 
                onClick={deploySandbox}
                disabled={isDeploying || !!sandbox}
                className="px-10 py-4 bg-white/5 border border-white/10 hover:border-indigo-500/50 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] italic transition-all disabled:opacity-50"
            >
                {isDeploying ? 'Processing Concept Matrix...' : sandbox ? 'Sandbox Active' : 'Deploy Concept Array'}
            </button>
        </div>

        <AnimatePresence mode="wait">
            {sandbox ? (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10"
                >
                    {sandbox.variants.map((variant) => (
                        <div key={variant.variantId} className="p-6 bg-black/40 border border-white/5 rounded-3xl space-y-6 group hover:border-indigo-500/20 transition-all">
                            <div className="flex items-center justify-between">
                                <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{variant.variantId}</span>
                                </div>
                                <div className="flex items-center gap-2 text-indigo-400">
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-black italic">{(variant.velocity * 100).toFixed(0)}% Lift</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <h5 className="text-sm font-black text-white italic tracking-tight uppercase leading-none">{variant.type}</h5>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{variant.status}</p>
                            </div>

                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${variant.velocity * 100}%` }}
                                    className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full"
                                />
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                <div className="flex items-center gap-2 text-emerald-500">
                                    <DollarSign className="w-3 h-3" />
                                    <span className="text-[10px] font-black">${variant.budget.toFixed(2)}</span>
                                </div>
                                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ArrowUpRight className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    ))}
                </motion.div>
            ) : (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-16 border border-dashed border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-6"
                >
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
                        < FlaskConical className="w-8 h-8 text-slate-700" />
                    </div>
                    <div className="max-w-sm space-y-2">
                        <p className="text-xs font-black text-white uppercase tracking-widest italic">Awaiting Concept Injection</p>
                        <p className="text-[10px] font-medium text-slate-600 italic">Deploy a micro-budget array to autonomously test hooks, pacing, and visual styles across the global network nodes.</p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {sandbox && (
            <div className="pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-white/5 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-500">
                        <Target className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest italic">Logic: {sandbox.scalingLogic}</span>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic animate-pulse">Scanning viral nodes...</span>
                    <div className="h-4 w-40 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                        <div className="h-full bg-indigo-500/50 w-2/3 rounded-full animate-progress" />
                    </div>
                </div>
            </div>
        )}
        
        <style jsx>{`
            @keyframes progress {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
            }
            .animate-progress {
                animation: progress 2s infinite ease-in-out;
            }
        `}</style>
    </div>
  )
}
