import React from 'react'
import { m } from 'framer-motion'
import {
  Zap,
  Clock,
  Fingerprint,
  Activity,
  Undo2
} from 'lucide-react'
import { StyleDNA, AgenticKPIs } from '../../../types/editor'
import { useTranslation } from '../../../hooks/useTranslation'

interface IntelligenceEngineViewProps {
  dna: StyleDNA
  /** Session telemetry captured by the editor (newest first); each entry carries the KPIs measured for that edit. */
  history: any[]
}

/**
 * Style snapshot of the current edit + how much of the AI's edit was kept.
 *
 * Everything shown is computed: cuts/min, visual density, theme and preferred
 * fonts/transitions come from useStyleDNA (the live timeline + saved style
 * profile); the acceptance / adjusted / removed rates come from the editor's
 * telemetry entries. Removed: hard-coded "Mock KPIs" (88% / 8.2% / 4.5% /
 * 92/100), "Identity Lock: 99.8%", a placeholder sentiment-drift value, a
 * canned "AI has identified a preference for…" paragraph, and an invented
 * insights section ("120% zoom at 0:02 improves retention by 14%").
 */
const IntelligenceEngineView: React.FC<IntelligenceEngineViewProps> = ({ dna, history }) => {
  const { t } = useTranslation()
  const latest = Array.isArray(history) ? history.find(h => h && h.kpis) : undefined
  const kpis: AgenticKPIs | undefined = latest?.kpis

  const glassStyle = "bg-white/[0.03] backdrop-blur-3xl border border-white/10"
  const fmtPct = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v * 10) / 10}%` : '—')

  const themeLabel: Record<string, string> = {
    'cinematic': t('intelligenceView.themeCinematic'),
    'vlog': t('intelligenceView.themeVlog'),
    'high-octane': t('intelligenceView.themeHighEnergy'),
    'corporate': t('intelligenceView.themeCorporate'),
  }

  const kpiCards = [
    { icon: Zap, color: 'text-amber-400', label: t('intelligenceView.kpiKept'), hint: t('intelligenceView.kpiKeptHint'), value: fmtPct(kpis?.agenticAcceptanceRate) },
    { icon: Clock, color: 'text-blue-400', label: t('intelligenceView.kpiAdjusted'), hint: t('intelligenceView.kpiAdjustedHint'), value: fmtPct(kpis?.manualOverrideDelta) },
    { icon: Undo2, color: 'text-rose-400', label: t('intelligenceView.kpiRemoved'), hint: t('intelligenceView.kpiRemovedHint'), value: fmtPct(kpis?.reversionRate) },
  ]

  return (
    <div className="flex flex-col gap-12 p-8 h-full overflow-y-auto custom-scrollbar">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <Fingerprint className="w-8 h-8 text-emerald-400" aria-hidden />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-[var(--text-main)] tracking-tight leading-none">{t('intelligenceView.title')}</h1>
            <p className="text-slate-500 text-sm font-medium tracking-tight mt-1">{t('intelligenceView.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Style snapshot (computed from the live timeline + saved style profile) */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${glassStyle} p-8 rounded-[3rem] col-span-1 flex flex-col gap-8 relative overflow-hidden group`}
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
             <Activity className="w-32 h-32 text-emerald-500" aria-hidden />
          </div>

          <div className="space-y-2">
             <h3 className="text-xl font-bold text-[var(--text-main)] tracking-tight">
               {t('intelligenceView.styleSnapshot')} <span className="text-emerald-400">{themeLabel[dna.theme || 'vlog'] || dna.theme}</span>
             </h3>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs font-semibold">{t('intelligenceView.pacing')}</span>
              <span className="text-white font-bold">{t('intelligenceView.cutsPerMin', { value: dna.cpm })}</span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
               <m.div
                 initial={{ width: 0 }}
                 animate={{ width: `${Math.min(dna.cpm * 5, 100)}%` }}
                 className="h-full bg-emerald-500"
               />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs font-semibold">{t('intelligenceView.visualDensity')}</span>
              <span className="text-white font-bold">{t('intelligenceView.elementsPerMin', { value: dna.visualDensity })}</span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
               <m.div
                 initial={{ width: 0 }}
                 animate={{ width: `${Math.min(dna.visualDensity * 10, 100)}%` }}
                 className="h-full bg-emerald-400"
               />
            </div>
          </div>

          {(dna.preferredFonts.length > 0 || dna.preferredTransitions.length > 0) && (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2 text-xs text-slate-400">
              {dna.preferredFonts.length > 0 && (
                <p>
                  <span className="font-semibold text-slate-300">{t('intelligenceView.fonts')}</span>{' '}
                  {dna.preferredFonts.slice(0, 3).join(', ')}
                </p>
              )}
              {dna.preferredTransitions.length > 0 && (
                <p>
                  <span className="font-semibold text-slate-300">{t('intelligenceView.transitions')}</span>{' '}
                  {dna.preferredTransitions.slice(0, 3).join(', ')}
                </p>
              )}
            </div>
          )}
        </m.div>

        {/* How much of the AI's edit was kept (from the editor's telemetry) */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`${glassStyle} p-8 rounded-[3rem] col-span-2 grid grid-cols-1 gap-8 sm:grid-cols-3 relative overflow-hidden group`}
        >
          <div className="sm:col-span-3 border-b border-white/5 pb-4">
             <h3 className="text-xl font-bold text-[var(--text-main)] tracking-tight">{t('intelligenceView.aiEditTitle')}</h3>
             {!kpis && (
               <p className="text-xs text-slate-500 mt-2">{t('intelligenceView.notEnoughData')}</p>
             )}
          </div>

          {kpiCards.map(card => (
            <div key={card.label} className="space-y-2">
              <div className="flex items-center gap-3">
                <card.icon className={`w-4 h-4 ${card.color}`} aria-hidden />
                <span className="text-xs font-semibold text-slate-500">{card.label}</span>
              </div>
              <div className="text-4xl font-bold text-white tracking-tight">{card.value}</div>
              <p className="text-[11px] text-slate-500 font-medium">{card.hint}</p>
            </div>
          ))}
        </m.div>
      </div>
    </div>
  )
}

export default IntelligenceEngineView
