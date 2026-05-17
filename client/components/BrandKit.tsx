'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Palette, Type, Image as ImageIcon, Save, CheckCircle2, Sparkles,
  Upload, Trash2, Eye, EyeOff, ChevronDown
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface BrandKitData {
  primaryColor: string
  accentColor: string
  backgroundColor: string
  fontFamily: string
  captionFontSize: number
  logoUrl?: string
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  logoOpacity: number
  watermarkText?: string
  autoApplyToClips: boolean
}

const BRAND_KIT_KEY = 'click-brand-kit-v1'

const BRAND_FONTS = [
  'Inter', 'Roboto', 'Montserrat', 'Bebas Neue', 'Anton', 'Oswald',
  'Raleway', 'Poppins', 'Playfair Display', 'Space Grotesk'
]

const DEFAULT_BRAND: BrandKitData = {
  primaryColor: '#6366F1',
  accentColor: '#8B5CF6',
  backgroundColor: '#000000',
  fontFamily: 'Inter',
  captionFontSize: 36,
  logoPosition: 'top-right',
  logoOpacity: 85,
  watermarkText: '',
  autoApplyToClips: true,
}

interface BrandKitProps {
  onApply?: (kit: BrandKitData) => void
  onSave?: (kit: BrandKitData) => void
  showToast?: (m: string, t: 'success' | 'info' | 'error') => void
}

const BrandKit: React.FC<BrandKitProps> = ({ onApply, onSave, showToast = () => {} }) => {
  const [kit, setKit] = useState<BrandKitData>(DEFAULT_BRAND)
  const [saved, setSaved] = useState(false)
  const [previewMode, setPreviewMode] = useState(true)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BRAND_KIT_KEY)
      if (raw) setKit({ ...DEFAULT_BRAND, ...JSON.parse(raw) })
    } catch { /* ignore */ }
  }, [])

  const updateKit = useCallback(<K extends keyof BrandKitData>(key: K, value: BrandKitData[K]) => {
    setKit(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }, [])

  const handleSave = useCallback(() => {
    try {
      localStorage.setItem(BRAND_KIT_KEY, JSON.stringify(kit))
      setSaved(true)
      onSave?.(kit)
      showToast('✓ LEDGER_UPDATED: BRAND_KIT_SAVED', 'success')
      setTimeout(() => setSaved(false), 3000)
    } catch {
      showToast('WRITE_ERR: SAVE_FAILURE', 'error')
    }
  }, [kit, onSave, showToast])

  const handleApply = useCallback(() => {
    onApply?.(kit)
    showToast('✓ SEQUENCE_SYNCED: BRAND_APPLIED', 'success')
  }, [kit, onApply, showToast])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      updateKit('logoUrl', ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleReset = () => {
    if (!confirm('RESET_BRAND_CORE: Confirm factory calibration?')) return
    setKit(DEFAULT_BRAND)
    localStorage.removeItem(BRAND_KIT_KEY)
    showToast('✓ FACTORY_RESET_COMPLETE', 'info')
  }

  return (
    <div className="space-y-10">
      {/* Header Controls */}
      <div className="flex items-center justify-between pb-6 border-b border-surface-100 dark:border-surface-800">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-500 shadow-sm">
             <Palette size={20} />
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.4em] italic text-surface-900 dark:text-white leading-none">V-Identity Protocol</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setPreviewMode(!previewMode)}
            className={`p-3 rounded-xl border-2 transition-all active:scale-90 ${previewMode ? 'bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/20' : 'bg-surface-page dark:bg-surface-950 text-surface-400 border-surface-100 dark:border-surface-800 hover:text-primary-500 shadow-inner'}`}>
            {previewMode ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          <button type="button" onClick={handleReset}
            aria-label="Reset brand kit"
            title="Reset brand kit"
            className="p-3 rounded-xl bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 text-surface-400 hover:text-rose-500 hover:border-rose-500/40 transition-all shadow-inner active:scale-90">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
         {/* Config Section */}
         <div className="space-y-10">
            {/* Colors */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.4em] italic pl-2 text-surface-400 dark:text-slate-500 leading-none">Chroma Lattice</label>
              <div className="grid grid-cols-3 gap-4 p-6 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-[2rem] shadow-inner">
                {[
                  { key: 'primaryColor' as const, label: 'Primary' },
                  { key: 'accentColor' as const,  label: 'Accent' },
                  { key: 'backgroundColor' as const, label: 'Canvas' },
                ].map(c => (
                  <div key={c.key} className="flex flex-col items-center gap-3 group">
                    <div className="relative w-full aspect-square rounded-2xl overflow-hidden border-2 border-surface-100 dark:border-surface-800 shadow-lg group-hover:scale-105 transition-transform duration-300">
                      <input type="color" value={kit[c.key] as string}
                        onChange={e => updateKit(c.key, e.target.value)}
                        aria-label={`${c.label} brand color`}
                        title={`${c.label} brand color`}
                        className="absolute inset-0 w-[120%] h-[120%] -translate-x-[10%] -translate-y-[10%] cursor-pointer bg-transparent"
                      />
                    </div>
                    <span className="text-[9px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-widest italic">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.4em] italic pl-2 text-surface-400 dark:text-slate-500 leading-none">Typographic Core</label>
              <div className="p-6 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-[2rem] shadow-inner space-y-8">
                 <div className="relative group">
                    <select value={kit.fontFamily} onChange={e => updateKit('fontFamily', e.target.value)}
                      aria-label="Brand font family"
                      title="Brand font family"
                      className="w-full bg-surface-card dark:bg-surface-900 border-2 border-surface-200 dark:border-surface-800 rounded-2xl px-6 py-4 text-sm font-black text-surface-900 dark:text-white uppercase italic tracking-widest focus:border-primary-500 outline-none appearance-none cursor-pointer shadow-md transition-all"
                    >
                      {BRAND_FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f.toUpperCase()}</option>)}
                    </select>
                    <ChevronDown size={20} className="absolute right-6 top-1/2 -translate-y-1/2 text-surface-400 group-hover:text-primary-500 pointer-events-none transition-colors" />
                 </div>
                 
                 <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                       <span className="text-[9px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-widest italic">Scale Factor</span>
                       <span className="text-[11px] font-black text-primary-500 italic">{kit.captionFontSize}PX</span>
                    </div>
                    <input type="range" min={20} max={60} step={2} value={kit.captionFontSize}
                      onChange={e => updateKit('captionFontSize', parseInt(e.target.value))}
                      aria-label={`Caption font scale: ${kit.captionFontSize}px`}
                      title={`Caption font scale: ${kit.captionFontSize}px`}
                      className="w-full accent-primary-500 h-1.5 bg-surface-card dark:bg-surface-800 rounded-full cursor-pointer shadow-inner"
                    />
                 </div>
              </div>
            </div>
         </div>

         {/* Visuals Section */}
         <div className="space-y-10">
            {/* Preview Area */}
            <AnimatePresence>
              {previewMode && (
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.4em] italic pl-2 text-surface-400 dark:text-slate-500 leading-none">Neural Preview</label>
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="relative rounded-[2.5rem] overflow-hidden aspect-video border-2 border-surface-100 dark:border-surface-800 shadow-[0_40px_100px_rgba(0,0,0,0.3)] transition-all duration-500"
                    style={{ background: kit.backgroundColor }}
                  >
                    <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
                    
                    {/* Caption preview */}
                    <div className="absolute inset-0 flex items-end justify-center pb-[18%] px-8 text-center"
                      style={{
                        '--brand-font': kit.fontFamily,
                        '--brand-size': `${Math.min(kit.captionFontSize, 24)}px`,
                        '--brand-color': kit.primaryColor,
                      } as any}
                    >
                      <span style={{
                        fontFamily: 'var(--brand-font)',
                        fontSize: 'var(--brand-size)',
                        color: 'var(--brand-color)',
                        textShadow: '0 4px 20px rgba(0,0,0,0.9)',
                        fontWeight: 900,
                        letterSpacing: '-1px',
                        lineHeight: 1,
                      }}
                        className="uppercase italic"
                      >
                        SAMPLE_SYNTHETIC_CAPTION
                      </span>
                    </div>

                    {/* Logo placeholder */}
                    {kit.logoUrl && (
                      <div className={`absolute p-4 transition-all duration-500 ${
                        kit.logoPosition === 'top-right' ? 'top-4 right-4' :
                        kit.logoPosition === 'top-left' ? 'top-4 left-4' :
                        kit.logoPosition === 'bottom-right' ? 'bottom-4 right-4' :
                        'bottom-4 left-4'
                      }`} style={{ opacity: kit.logoOpacity / 100 }}>
                        <img src={kit.logoUrl} alt="Logo preview" className="h-10 w-auto object-contain rounded-xl shadow-2xl" />
                      </div>
                    )}

                    {/* Accent stripe */}
                    <div className="absolute bottom-0 left-0 right-0 h-1.5"
                      style={{ background: `linear-gradient(90deg, ${kit.primaryColor}, ${kit.accentColor})` }} />
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Asset Injection */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.4em] italic pl-2 text-surface-400 dark:text-slate-500 leading-none">Asset Injection</label>
              <div className="p-6 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-[2rem] shadow-inner space-y-6">
                 <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} aria-label="Upload logo image" title="Upload logo image" />
                 
                 <div className="flex gap-4">
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl bg-surface-card dark:bg-surface-900 border-2 border-dashed border-surface-200 dark:border-surface-800 hover:border-primary-500/40 text-surface-400 hover:text-primary-500 transition-all text-[10px] font-black uppercase tracking-[0.2em] italic shadow-md">
                      <Upload size={18} />
                      {kit.logoUrl ? 'REPLACE_VECTOR' : 'INJECT_LOGO'}
                    </button>
                    {kit.logoUrl && (
                      <button type="button" onClick={() => updateKit('logoUrl', undefined)}
                        aria-label="Remove logo"
                        title="Remove logo"
                        className="w-14 h-14 rounded-2xl bg-rose-500/10 border-2 border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-lg active:scale-90">
                        <Trash2 size={20} />
                      </button>
                    )}
                 </div>

                 {kit.logoUrl && (
                   <div className="space-y-6 pt-4 border-t border-surface-100 dark:border-surface-800">
                      <div className="grid grid-cols-4 gap-2">
                        {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(pos => (
                          <button type="button" key={pos} onClick={() => updateKit('logoPosition', pos)}
                            className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm ${
                              kit.logoPosition === pos ? 'bg-primary-500 text-white shadow-primary-500/20' : 'bg-surface-card dark:bg-surface-900 text-surface-400 hover:text-primary-500 border border-surface-100 dark:border-surface-800'
                            }`}
                          >
                            {pos === 'top-left' ? '↖' : pos === 'top-right' ? '↗' : pos === 'bottom-left' ? '↙' : '↘'}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-3">
                         <div className="flex items-center justify-between px-2">
                           <span className="text-[9px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-widest italic">Vector Opacity</span>
                           <span className="text-[11px] font-black text-primary-500 italic">{kit.logoOpacity}%</span>
                         </div>
                         <input type="range" min={20} max={100} step={5} value={kit.logoOpacity}
                           onChange={e => updateKit('logoOpacity', parseInt(e.target.value))}
                           aria-label={`Logo opacity: ${kit.logoOpacity}%`}
                           title={`Logo opacity: ${kit.logoOpacity}%`}
                           className="w-full accent-primary-500 h-1.5 bg-surface-card dark:bg-surface-800 rounded-full cursor-pointer shadow-inner"
                         />
                      </div>
                   </div>
                 )}

                 <input value={kit.watermarkText ?? ''} onChange={e => updateKit('watermarkText', e.target.value)}
                   placeholder="INDEX_HANDLE (@yourhandle)"
                   aria-label="Watermark handle"
                   title="Watermark handle"
                   className="w-full bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 rounded-2xl px-6 py-4 text-[11px] font-black text-surface-900 dark:text-white uppercase italic tracking-widest placeholder:text-surface-200 dark:placeholder:text-slate-800 focus:border-primary-500 outline-none transition-all shadow-md"
                 />
              </div>
            </div>
         </div>
      </div>

      {/* Auto-apply toggle */}
      <div className="flex items-center justify-between px-6 py-5 rounded-[2rem] bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800">
        <div>
          <p className="text-[11px] font-black text-surface-900 dark:text-white uppercase italic tracking-tight leading-none mb-1">Auto-apply to all new clips</p>
          <p className="text-[10px] font-bold text-surface-400 dark:text-slate-600 uppercase tracking-widest italic">Brand kit applied automatically when Forge generates clips</p>
        </div>
        <label className="relative w-14 h-7 flex-shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={kit.autoApplyToClips}
            onChange={() => updateKit('autoApplyToClips', !kit.autoApplyToClips)}
            className="sr-only"
            aria-label={kit.autoApplyToClips ? 'Disable auto-apply to clips' : 'Enable auto-apply to clips'}
          />
          <span className={`block w-14 h-7 rounded-full border-2 transition-all duration-300 ${kit.autoApplyToClips ? 'bg-emerald-500 border-emerald-500' : 'bg-surface-card dark:bg-surface-900 border-surface-100 dark:border-surface-800'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-lg transition-all duration-300 ${kit.autoApplyToClips ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'}`} />
          </span>
        </label>
      </div>

      {/* Global Actions */}
      <footer className="flex flex-col sm:flex-row gap-6 pt-10 border-t-2 border-surface-100 dark:border-surface-800">
        <motion.button whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} onClick={handleApply}
          className="flex-1 py-6 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.6em] italic bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 text-surface-600 dark:text-slate-400 hover:bg-surface-card hover:border-primary-500/40 transition-all shadow-xl flex items-center justify-center gap-4 active:scale-95">
          <Sparkles size={20} className="text-primary-500" />
          Omni-Channel Apply
        </motion.button>
        <motion.button whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} onClick={handleSave}
          className={`flex-1 py-6 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.8em] italic transition-all duration-500 flex items-center justify-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.3)] active:scale-95 border-none ${
            saved
              ? 'bg-emerald-500 text-white shadow-emerald-500/20'
              : 'bg-surface-900 dark:bg-white text-white dark:text-black hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white'
          }`}>
          {saved ? <><CheckCircle2 size={22} />Commit Complete</> : <><Save size={22} />Commit Kit</>}
        </motion.button>
      </footer>

      {/* Footer Info */}
      <p className="text-[10px] font-black text-surface-300 dark:text-slate-800 text-center uppercase tracking-[0.8em] italic">
        ENCRYPTED_LOCAL_STORAGE · SYNC_PENDING
      </p>
    </div>
  )
}

export function useBrandKit(): BrandKitData {
  const [kit, setKit] = useState<BrandKitData>(DEFAULT_BRAND)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BRAND_KIT_KEY)
      if (raw) setKit({ ...DEFAULT_BRAND, ...JSON.parse(raw) })
    } catch { /* ignore */ }
  }, [])
  return kit
}

export { BRAND_KIT_KEY, DEFAULT_BRAND }
export default BrandKit
