'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Zap,
  Target,
  ArrowRight,
  TrendingUp,
  Activity,
  SearchCode,
  PieChart,
} from 'lucide-react'
import { Panel, Button, Input, EmptyState, SectionHeader, StatCard } from '../ui'

export default function IdeationHub() {
  const [activeTab, setActiveTab] = useState<'gaps' | 'forcing' | 'autopsy'>('gaps')
  const [competitorUrl, setCompetitorUrl] = useState('')
  const [autopsyData, setAutopsyData] = useState<any>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleAutopsy = async () => {
    setIsAnalyzing(true)
    // Simulation of heavy neural analysis
    setTimeout(() => {
      setAutopsyData({
        hook: 'Visual pattern interrupt at 1.2s',
        pacing: '16 cuts/minute (Top 1% intensity)',
        psychology: 'FOMO + Logic-Defying Visuals',
        score: 96
      })
      setIsAnalyzing(false)
    }, 2500)
  }

  return (
    <div className="flex flex-col gap-10 py-10">
      {/* Header Area */}
      <SectionHeader
        as="h1"
        title="Ideation Hub"
        description="Strategic nerve center"
        actions={
          <div className="flex gap-1 p-1 rounded-xl ds-surface-subtle border border-border">
            {(['gaps', 'forcing', 'autopsy'] as const).map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'gaps' ? 'Content Gaps' : tab === 'forcing' ? 'Format Forcing' : 'Autopsy'}
              </Button>
            ))}
          </div>
        }
      />

      <AnimatePresence mode="wait">
        {activeTab === 'gaps' && (
          <motion.div
            key="gaps"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-8 space-y-8">
              <Panel variant="glass" className="ds-elev-2 p-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] text-theme-muted">
                  <PieChart size={200} aria-hidden />
                </div>

                <div className="flex items-center gap-3 mb-8">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                    <TrendingUp className="w-5 h-5" aria-hidden />
                  </div>
                  <h2 className="ds-text-h2 text-theme-primary">Content gap analysis</h2>
                </div>

                <EmptyState
                  icon={PieChart}
                  title="No gap analysis yet"
                  description="Connect your niche and publishing history to surface real, ranked content gaps for your audience."
                  action={<Button variant="secondary" size="sm" rightIcon={<ArrowRight size={16} />}>Run analysis</Button>}
                />
              </Panel>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <Panel variant="glass" className="ds-elev-1 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Activity className="w-5 h-5 text-primary" aria-hidden />
                  <h3 className="ds-text-h3 text-theme-primary">Market heat</h3>
                </div>
                <EmptyState
                  icon={Activity}
                  title="Awaiting data"
                  description="Niche velocity and saturation index appear here once market signals are ingested."
                  className="p-0"
                />
              </Panel>
            </div>
          </motion.div>
        )}

        {activeTab === 'forcing' && (
          <motion.div
            key="forcing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {[
              { id: 'pas', name: 'Problem-Agitate-Solve', desc: 'Best for direct response and selling digital products.' },
              { id: 'aida', name: 'Attention-Interest-Desire-Action', desc: 'The classic framework for storytelling and engagement.' },
              { id: 'hook-payoff', name: 'Loop-The-Loop (Loop Hook)', desc: 'Optimized for high-retention short form loops.' },
            ].map((framework, i) => (
              <motion.div
                key={framework.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
              >
                <Panel variant="glass" className="ds-elev-1 ds-hover-lift p-8 flex flex-col h-full">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-6">
                    <Zap size={24} aria-hidden />
                  </div>
                  <h3 className="ds-text-h3 text-theme-primary mb-4">{framework.name}</h3>
                  <p className="ds-text-body text-theme-muted leading-relaxed mb-8 flex-1">
                    {framework.desc}
                  </p>
                  <Button variant="secondary" size="md" title={`Apply ${framework.name} framework`} className="w-full">
                    Apply Framework
                  </Button>
                </Panel>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeTab === 'autopsy' && (
          <motion.div
            key="autopsy"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <Panel variant="glass" className="ds-elev-2 p-12 flex flex-col items-center text-center max-w-4xl mx-auto">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-8">
                <SearchCode className="w-10 h-10" aria-hidden />
              </div>
              <h2 className="ds-text-h2 text-theme-primary mb-4">Competitor autopsy</h2>
              <p className="ds-text-body text-theme-muted mb-10 max-w-lg">
                Analyze viral videos to strip away the creative and reveal the raw marketing DNA behind their success.
              </p>

              <div className="w-full flex gap-3 max-w-2xl">
                <Input
                  type="text"
                  value={competitorUrl}
                  onChange={(e) => setCompetitorUrl(e.target.value)}
                  placeholder="Paste TikTok or YouTube Link..."
                  className="flex-1 h-12"
                />
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleAutopsy}
                  disabled={isAnalyzing || !competitorUrl}
                  loading={isAnalyzing}
                >
                  {isAnalyzing ? 'Analyzing…' : 'Autopsy'}
                </Button>
              </div>
            </Panel>

            {autopsyData && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Hook DNA', val: autopsyData.hook, icon: Zap },
                  { label: 'Pacing Ratios', val: autopsyData.pacing, icon: Activity },
                  { label: 'Psych Trigger', val: autopsyData.psychology, icon: Brain },
                  { label: 'Viral Score', val: autopsyData.score + '%', icon: Target },
                ].map((stat) => (
                  <StatCard key={stat.label} label={stat.label} value={stat.val} icon={stat.icon} />
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
