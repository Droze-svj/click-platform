'use client'

import React from 'react'
import { Pipette, Sparkles, RotateCcw } from 'lucide-react'
import { useTranslation } from '../../../hooks/useTranslation'

export interface ChromaKeySettings {
  enabled: boolean
  color: string
  tolerance: number
  spill: number
  edge: number
  opacity: number
}

const DEFAULT_CHROMA: ChromaKeySettings = {
  enabled: false,
  color: '#00ff00',
  tolerance: 0.40,
  spill: 0.50,
  edge: 0.25,
  opacity: 1,
}

const PRESET_COLORS = [
  { nameKey: 'chromaKey.colorGreen', hex: '#00ff00' },
  { nameKey: 'chromaKey.colorBlue', hex: '#0000ff' },
  { nameKey: 'chromaKey.colorMagenta', hex: '#ff00ff' },
]

interface ChromakeyViewProps {
  chromaKey: ChromaKeySettings
  setChromaKey: (v: ChromaKeySettings | ((prev: ChromaKeySettings) => ChromaKeySettings)) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const ChromakeyView: React.FC<ChromakeyViewProps> = ({ chromaKey, setChromaKey, showToast }) => {
  const { t } = useTranslation()
  const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

  const setPreset = (hex: string, nameKey: string) => {
    setChromaKey((prev) => ({ ...prev, color: hex }))
    showToast(t('chromaKey.colorSet', { color: t(nameKey) }), 'info')
  }

  const reset = () => {
    setChromaKey(DEFAULT_CHROMA)
    showToast(t('chromaKey.settingsReset'), 'info')
  }

  return (
    <div className="space-y-8 pb-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-12 text-center md:text-left pt-4">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-4 px-6 py-2 rounded-full bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-[0.4em] italic text-emerald-400 shadow-xl">
            <Sparkles className="w-4 h-4" />
            {t('chromaKey.badge')}
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-[var(--text-main)] italic tracking-tighter uppercase leading-none">
            {t('chromaKey.title')}
          </h1>
          <p className="text-slate-500 text-lg font-medium tracking-tight max-w-md">
            {t('chromaKey.intro')}
          </p>
        </div>
      </div>

      <div className={`relative p-8 rounded-[3rem] border transition-all duration-700 overflow-hidden ${glassStyle} ${chromaKey.enabled ? 'border-emerald-500/50 shadow-[0_0_60px_rgba(16,185,129,0.15)]' : 'border-white/10'}`}>
        <div className="flex items-center gap-6 mb-8 mt-4">
          <div className={`w-20 h-20 rounded-[1.8rem] shadow-[0_10px_30px_rgba(16,185,129,0.4)] flex items-center justify-center border transition-colors duration-500 ${chromaKey.enabled ? 'bg-gradient-to-br from-emerald-400 to-teal-600 border-white/20' : 'bg-black/50 border-white/5 grayscale'}`}>
            <Pipette className="w-10 h-10 text-white" />
          </div>
          <div>
            <h3 className="text-3xl font-black text-[var(--text-main)] italic tracking-tighter uppercase">{t('chromaKey.cardTitle')}</h3>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('chromaKey.cardSubtitle')}</p>
          </div>
        </div>

        <div className="space-y-10 relative z-10">
          <div className="p-6 bg-black/40 rounded-[2rem] border border-white/5 flex items-center justify-between">
            <div>
              <h4 className="text-[var(--text-main)] font-bold text-lg mb-1">{t('chromaKey.enableChromaKey')}</h4>
              <p className="text-xs text-slate-500">{t('chromaKey.enableHint')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer group" title={t('chromaKey.enableChromaKey')}>
              <input type="checkbox" className="sr-only peer" checked={chromaKey.enabled} onChange={(e) => setChromaKey((prev) => ({ ...prev, enabled: e.target.checked }))} title={t('chromaKey.enableChromaKey')} />
              <div className="w-14 h-7 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 border border-white/20 shadow-inner overflow-hidden">
                <div className={`absolute inset-0 bg-emerald-400/30 blur-md ${chromaKey.enabled ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
              </div>
            </label>
          </div>

          <div className={`transition-opacity duration-500 ${chromaKey.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4 ml-2">{t('chromaKey.colorToRemove')}</h4>
            <div className="flex flex-wrap items-center gap-4 mb-6">
              {PRESET_COLORS.map((p) => (
                <button type="button"
                  key={p.hex}
                  onClick={() => setPreset(p.hex, p.nameKey)}
                  className={`w-14 h-14 rounded-2xl border-2 transition-all shadow-xl hover:scale-110 ${chromaKey.color.toLowerCase() === p.hex.toLowerCase() ? 'border-white scale-110 shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'border-white/10 hover:border-white/30'}`}
                  style={{ backgroundColor: p.hex }}
                  title={t(p.nameKey)}
                />
              ))}
              <div className="w-px h-10 bg-white/10 mx-2" />
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="color"
                    value={chromaKey.color}
                    onChange={(e) => { const v = e.target.value; setChromaKey((prev) => ({ ...prev, color: v })) }}
                    title={t('chromaKey.customColor')}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className={`w-14 h-14 rounded-2xl border-2 transition-all shadow-xl ${!PRESET_COLORS.some(p => p.hex.toLowerCase() === chromaKey.color.toLowerCase()) ? 'border-white scale-110 shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'border-white/10'}`} style={{ backgroundColor: chromaKey.color }} />
                </div>
                <input
                  type="text"
                  value={chromaKey.color}
                  onChange={(e) => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) { setChromaKey((prev) => ({ ...prev, color: v })) } }}
                  title={t('chromaKey.hexColor')}
                  className="w-28 px-4 py-3 rounded-xl border border-white/5 bg-black/40 text-white text-sm font-mono tracking-wider focus:outline-none focus:border-emerald-500/50"
                  placeholder="#00ff00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: t('chromaKey.tolerance'), prop: 'tolerance' as keyof ChromaKeySettings, desc: t('chromaKey.toleranceHint') },
                { label: t('chromaKey.spill'), prop: 'spill' as keyof ChromaKeySettings, desc: t('chromaKey.spillHint') },
                { label: t('chromaKey.edgeSoftness'), prop: 'edge' as keyof ChromaKeySettings, desc: t('chromaKey.edgeSoftnessHint') }
              ].map((slider) => (
                <div key={slider.prop} className="bg-black/40 p-5 rounded-[1.5rem] border border-white/5 group hover:border-emerald-500/30 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{slider.label}</span>
                      <span className="block text-[9px] text-slate-600 uppercase tracking-wider">{slider.desc}</span>
                    </div>
                    <span className="text-white font-mono text-xs bg-white/5 px-2 py-1 rounded">{(chromaKey[slider.prop] as number).toFixed(2)}</span>
                  </div>
                   <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={chromaKey[slider.prop] as number}
                    onChange={(e) => setChromaKey((prev) => ({ ...prev, [slider.prop]: Number(e.target.value) }))}
                    title={t('chromaKey.adjust', { label: slider.label })}
                    aria-label={t('chromaKey.adjust', { label: slider.label })}
                    className="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all outline-none"
                    style={{ background: `linear-gradient(to right, #10b981 ${(chromaKey[slider.prop] as number) * 100}%, rgba(255,255,255,0.05) ${(chromaKey[slider.prop] as number) * 100}%)` }}
                  />
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
                <button
                 type="button"
                  onClick={reset}
                  title={t('chromaKey.resetSettings')}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('chromaKey.resetSettings')}
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChromakeyView
