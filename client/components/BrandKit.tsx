'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Palette, Type, Image as ImageIcon, Save, CheckCircle2, Sparkles,
  Upload, Trash2, Eye, EyeOff
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
}

interface BrandKitProps {
  onApply?: (kit: BrandKitData) => void
  onSave?: (kit: BrandKitData) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const BrandKit: React.FC<BrandKitProps> = ({ onApply, onSave, showToast }) => {
  const [kit, setKit] = useState<BrandKitData>(DEFAULT_BRAND)
  const [saved, setSaved] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Load from localStorage on mount
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
      showToast('✦ Brand Kit saved', 'success')
      setTimeout(() => setSaved(false), 3000)
    } catch {
      showToast('Failed to save Brand Kit', 'error')
    }
  }, [kit, onSave, showToast])

  const handleApply = useCallback(() => {
    onApply?.(kit)
    showToast('✦ Brand Kit applied to captions', 'success')
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
    setKit(DEFAULT_BRAND)
    localStorage.removeItem(BRAND_KIT_KEY)
    showToast('Brand Kit reset to defaults', 'info')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-indigo-400" />
          <span className="text-[11px] font-black uppercase tracking-widest text-white">Brand Kit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setPreviewMode(!previewMode)}
            title="Toggle preview mode"
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-500 hover:text-white transition-colors">
            {previewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleReset}
            title="Reset brand kit"
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Live preview banner */}
      <AnimatePresence>
        {previewMode && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
            className="relative rounded-2xl overflow-hidden aspect-video border border-white/10"
            style={{ background: kit.backgroundColor }}
          >
            {/* Caption preview */}
            <div className="absolute inset-0 flex items-end justify-center pb-[18%]">
              <span style={{
                fontFamily: kit.fontFamily,
                fontSize: Math.min(kit.captionFontSize, 24),
                color: kit.primaryColor,
                textShadow: '0 2px 12px rgba(0,0,0,0.9)',
                fontWeight: 900,
                letterSpacing: '-0.5px',
              }}
                className="uppercase"
              >
                SAMPLE CAPTION TEXT
              </span>
            </div>
            {/* Logo placeholder */}
            {kit.logoUrl && (
              <div className={`absolute p-2 ${
                kit.logoPosition === 'top-right' ? 'top-2 right-2' :
                kit.logoPosition === 'top-left' ? 'top-2 left-2' :
                kit.logoPosition === 'bottom-right' ? 'bottom-2 right-2' :
                'bottom-2 left-2'
              }`} style={{ opacity: kit.logoOpacity / 100 }}>
                <img src={kit.logoUrl} alt="Logo preview" className="h-8 w-auto object-contain rounded" />
              </div>
            )}
            {/* Accent stripe */}
            <div className="absolute bottom-0 left-0 right-0 h-[3px]"
              style={{ background: `linear-gradient(90deg, ${kit.primaryColor}, ${kit.accentColor})` }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Colors */}
      <div>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-2">Colours</span>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'primaryColor' as const, label: 'Primary' },
            { key: 'accentColor' as const,  label: 'Accent' },
            { key: 'backgroundColor' as const, label: 'BG' },
          ].map(c => (
            <div key={c.key} className="flex flex-col items-center gap-1.5">
              <input type="color" value={kit[c.key] as string}
                onChange={e => updateKit(c.key, e.target.value)}
                title={`${c.label} colour`}
                className="w-full h-10 rounded-xl cursor-pointer border border-white/10 bg-transparent p-1"
              />
              <span className="text-[8px] font-black text-slate-500 uppercase">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Font */}
      <div>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-2">Caption Font</span>
        <select value={kit.fontFamily} onChange={e => updateKit('fontFamily', e.target.value)}
          title="Caption font family"
          className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-white text-[11px] focus:outline-none focus:border-indigo-500/50 transition-all"
        >
          {BRAND_FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
        {/* Font size */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Size</span>
          <span className="text-[9px] font-black text-indigo-400">{kit.captionFontSize}px</span>
        </div>
        <input type="range" min={20} max={60} step={2} value={kit.captionFontSize}
          onChange={e => updateKit('captionFontSize', parseInt(e.target.value))}
          title="Caption font size"
          className="w-full accent-indigo-500 mt-1"
        />
      </div>

      {/* Logo */}
      <div>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-2">Logo / Watermark</span>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" title="Upload logo"
          onChange={handleLogoUpload} />
        <div className="flex gap-2">
          <button onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] border border-dashed border-white/10 hover:border-indigo-500/40 text-slate-500 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest">
            <Upload className="w-3.5 h-3.5" />
            {kit.logoUrl ? 'Replace Logo' : 'Upload Logo'}
          </button>
          {kit.logoUrl && (
            <button onClick={() => updateKit('logoUrl', undefined)}
              title="Remove logo"
              className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {kit.logoUrl && (
          <div className="mt-2 space-y-2">
            <div>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Position</span>
              <div className="grid grid-cols-4 gap-1 mt-1">
                {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(pos => (
                  <button key={pos} onClick={() => updateKit('logoPosition', pos)}
                    title={`Logo position: ${pos}`}
                    className={`py-1 rounded-lg text-[7px] font-black uppercase transition-all ${
                      kit.logoPosition === pos ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-white'
                    }`}
                  >
                    {pos === 'top-left' ? '↖' : pos === 'top-right' ? '↗' : pos === 'bottom-left' ? '↙' : '↘'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Opacity</span>
              <span className="text-[9px] font-black text-indigo-400">{kit.logoOpacity}%</span>
            </div>
            <input type="range" min={20} max={100} step={5} value={kit.logoOpacity}
              onChange={e => updateKit('logoOpacity', parseInt(e.target.value))}
              title="Logo opacity"
              className="w-full accent-indigo-500"
            />
          </div>
        )}
        {/* Text watermark */}
        <input value={kit.watermarkText ?? ''} onChange={e => updateKit('watermarkText', e.target.value)}
          placeholder="@yourhandle (optional text watermark)"
          title="Text watermark"
          className="w-full mt-2 px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-white text-[10px] placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleApply}
          className="flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest bg-white/[0.06] border border-white/10 text-white hover:bg-white/[0.1] transition-all flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Apply to Captions
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave}
          className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
            saved
              ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90 shadow-lg shadow-indigo-600/20'
          }`}>
          {saved ? <><CheckCircle2 className="w-3.5 h-3.5" />Saved!</> : <><Save className="w-3.5 h-3.5" />Save Kit</>}
        </motion.button>
      </div>

      {/* Helper text */}
      <p className="text-[8px] text-slate-600 text-center leading-relaxed">
        Brand Kit is saved locally and applied to all new caption generations.
      </p>
    </div>
  )
}

// Hook for consuming the saved brand kit anywhere
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
