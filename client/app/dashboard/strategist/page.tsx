'use client'

import { Sparkles, Compass, BrainCircuit, Activity } from 'lucide-react'
import MarketingStrategistChat from '../../../components/MarketingStrategistChat'
import NicheStrategyPanel from '../../../components/NicheStrategyPanel'
import HookVariantsCard from '../../../components/HookVariantsCard'
import { useWorkflow } from '../../../contexts/WorkflowContext'
import { motion } from 'framer-motion'

export default function StrategistPage() {
  const { state, setNiche } = useWorkflow()
  const niche = state.niche || 'general'
  const platform = state.platform || 'tiktok'

  return (
    <div className="min-h-screen relative z-10 pb-32 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-8 overflow-x-hidden font-inter bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-50 transition-colors duration-500">
      
      {/* ── Advanced Dashboard Header ── */}
      <header className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6 pb-6 border-b border-surface-200 dark:border-surface-800">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/40 border border-primary-200 dark:border-primary-800 flex items-center justify-center shadow-sm">
            <BrainCircuit size={32} className="text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-secondary-100 text-secondary-700 dark:bg-secondary-900/50 dark:text-secondary-400 uppercase tracking-wide border border-secondary-200 dark:border-secondary-800">
                Click Intelligence
              </span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                <Activity size={12} /> Systems Online
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none mt-2">
              Marketing Strategist
            </h1>
            <p className="text-sm font-medium text-surface-500 dark:text-surface-400 mt-2 max-w-2xl">
              Niche-aware playbooks, hook libraries, and an autonomous strategist actively analyzing your category.
            </p>
          </div>
        </div>

        {/* Dynamic Context Pill */}
        <div className="flex items-center gap-4 px-5 py-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-sm text-xs w-full lg:w-auto">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-0.5">Active Niche</span>
            <span className="font-bold text-primary-600 dark:text-primary-400 capitalize flex items-center gap-1.5">
              <Sparkles size={14} /> {niche}
            </span>
          </div>
          <div className="w-px h-8 bg-surface-200 dark:bg-surface-800 mx-2" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-0.5">Target Platform</span>
            <span className="font-bold text-secondary-600 dark:text-secondary-400 capitalize flex items-center gap-1.5">
              <Compass size={14} /> {platform}
            </span>
          </div>
        </div>
      </header>

      {/* ── Bionic Dashboard Grid ── */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="grid grid-cols-1 xl:grid-cols-12 gap-8"
      >
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900/50">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={16} className="text-primary-500" /> Niche Intelligence
              </h2>
            </div>
            <div className="p-4">
              <NicheStrategyPanel currentNiche={niche} currentPlatform={platform} onNicheChange={setNiche} />
            </div>
          </div>
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
            <HookVariantsCard niche={niche} platform={platform} />
          </div>
        </div>
        
        <div className="xl:col-span-8 min-h-[700px] bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900/50 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <BrainCircuit size={16} className="text-secondary-500" /> Autonomous Agent Chat
            </h2>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="flex-1 p-4">
            <MarketingStrategistChat niche={niche} platforms={[platform]} className="h-full" />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
