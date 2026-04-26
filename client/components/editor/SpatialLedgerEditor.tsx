'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Box, 
  BoxSelect, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Lock, 
  Unlock,
  Eye,
  Settings,
  X,
  Plus,
  Trash2,
  ChevronRight,
  Database
} from 'lucide-react'
import { apiGet, apiPost } from '../../lib/api'

interface EntityState {
  label: string
  type: string
  lastKnownState: string
  mustPersist: boolean
  isOverridden: boolean
}

interface SpatialLedgerEditorProps {
  videoId: string
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

export const SpatialLedgerEditor: React.FC<SpatialLedgerEditorProps> = ({ videoId, showToast }) => {
  const [loading, setLoading] = useState(true)
  const [ledger, setLedger] = useState<any>(null)
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null)
  const [overrideValue, setOverrideValue] = useState('')

  useEffect(() => {
    loadLedger()
  }, [videoId])

  const loadLedger = async () => {
    setLoading(true)
    try {
      // In production, fetch from /api/phase8/spatial/ledger/:videoId
      // Mocking for now
      const mockLedger = {
        ledgerId: 'ledger_7c8d',
        globalEntities: {
          'prop_coffee_cup': { label: 'coffee cup', type: 'prop', lastKnownState: 'steaming on desk', mustPersist: true, isOverridden: false },
          'character_john': { label: 'John', type: 'character', lastKnownState: 'wearing blue hoodie', mustPersist: true, isOverridden: true },
          'lighting_main': { label: 'main light', type: 'lighting', lastKnownState: 'warm sunset', mustPersist: true, isOverridden: false },
        },
        continuityLog: [
          { sceneIndex: 3, entityKey: 'prop_coffee_cup', riskLevel: 'HIGH', message: 'Entity missing from frame. Auto-enforcing.' }
        ],
        riskScore: 24
      }
      setLedger(mockLedger)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyOverride = async () => {
    if (!selectedEntity || !overrideValue) return
    
    showToast(`Applying Spatial Override: ${selectedEntity}`, 'info')
    
    // Simulate API call to save override
    setTimeout(() => {
      setLedger((prev: any) => ({
        ...prev,
        globalEntities: {
          ...prev.globalEntities,
          [selectedEntity]: {
            ...prev.globalEntities[selectedEntity],
            lastKnownState: overrideValue,
            isOverridden: true
          }
        }
      }))
      setOverrideValue('')
      setSelectedEntity(null)
      showToast('Spatial Ledger Synchronized', 'success')
    }, 1000)
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4 opacity-50">
      <RefreshCw className="animate-spin text-indigo-400" />
      <span className="text-[10px] font-black uppercase tracking-widest italic">Syncing Spatial Ledger...</span>
    </div>
  )

  const entities = Object.entries(ledger?.globalEntities || {})

  return (
    <div className={`${glassStyle} rounded-[3rem] p-8 space-y-8 overflow-hidden relative group`}>
      <div className="absolute top-0 right-0 p-8 opacity-[0.05] group-hover:opacity-10 transition-opacity">
        <Database size={100} />
      </div>

      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
            <BoxSelect className="text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">Spatial Memory</h3>
            <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest mt-2 bg-white/5 px-2 py-0.5 rounded italic">Project: {videoId.slice(-6)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">Continuity Risk</p>
          <p className={`text-2xl font-black italic leading-none ${ledger.riskScore > 50 ? 'text-rose-500' : 'text-emerald-400'}`}>
            {ledger.riskScore}%
          </p>
        </div>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {entities.map(([key, entity]: [string, any]) => (
          <motion.div 
            key={key}
            whileHover={{ x: 5 }}
            onClick={() => setSelectedEntity(key)}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              selectedEntity === key 
              ? 'bg-indigo-500/20 border-indigo-500/50' 
              : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {entity.isOverridden ? <Lock size={14} className="text-amber-400" /> : <Unlock size={14} className="text-slate-800" />}
                <p className="text-sm font-black text-white italic uppercase tracking-tighter">{entity.label}</p>
              </div>
              <span className="text-[8px] font-black text-slate-800 uppercase tracking-widest opacity-50">{entity.type}</span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-2 italic truncate">&ldquo;{entity.lastKnownState}&rdquo;</p>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedEntity && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-4 border-t border-white/5 space-y-4"
          >
            <div className="flex items-center justify-between">
               <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] italic">MOD_OVERRIDE: {selectedEntity.toUpperCase()}</p>
               <button onClick={() => setSelectedEntity(null)} title="Close Selection"><X size={16} className="text-slate-800 hover:text-white" /></button>
            </div>
            <textarea
              className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs placeholder:text-slate-800 focus:outline-none focus:border-indigo-500/50 italic"
              placeholder="Enforce new spatial status..."
              value={overrideValue}
              onChange={(e) => setOverrideValue(e.target.value)}
              rows={2}
            />
            <button
              onClick={handleApplyOverride}
              className="w-full py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] hover:bg-indigo-500 hover:text-white transition-all italic active:scale-95 shadow-xl"
            >
              COMMIT_SPATIAL_SYNC
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {ledger.continuityLog.length > 0 && (
         <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-rose-500">
               <AlertTriangle size={14} />
               <span className="text-[9px] font-black uppercase tracking-widest">DIFF_ANOMALY detected</span>
            </div>
            <p className="text-[10px] font-medium text-rose-200/60 leading-tight italic">
              {ledger.continuityLog[0].message}
            </p>
         </div>
      )}
    </div>
  )
}
