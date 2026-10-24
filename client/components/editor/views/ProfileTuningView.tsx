'use client'

import React, { useState } from 'react'
import { m } from 'framer-motion'
import {
  Dna,
  Save,
  ChevronRight,
  Type,
  Palette,
  Volume2,
  Clock3,
  Zap
} from 'lucide-react'
import { StyleProfile } from '../../../types/editor'
import { resolveGrade } from '../../../lib/colorGrades'
import { useTranslation } from '../../../hooks/useTranslation'

interface ProfileTuningViewProps {
  profile: StyleProfile
  onSave: (updatedProfile: StyleProfile) => void
  onCancel: () => void
  onApply: (profile: StyleProfile) => void
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

export const ProfileTuningView: React.FC<ProfileTuningViewProps> = ({
  profile: initialProfile,
  onSave,
  onCancel,
  onApply
}) => {
  const { t } = useTranslation()
  const [profile, setProfile] = useState<StyleProfile>(initialProfile)
  const lutId = profile.visuals.lutId
  const grade = resolveGrade(lutId)
  const gradeLabel = grade?.label ?? lutId ?? null
  const [activeTab, setActiveTab] = useState<'pacing' | 'typography' | 'color' | 'audio'>('pacing')

  return (
    <div className="flex h-full gap-8 p-12 overflow-hidden relative">
      {/* Background Accents */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-600/5 blur-[150px] rounded-full pointer-events-none" />

      {/* LEFT: settings (accordion) */}
      <div className={`w-[500px] ${glassStyle} rounded-[3rem] p-8 flex flex-col overflow-hidden`}>
        <div className="space-y-6 mb-8">
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 w-fit text-indigo-400 text-[9px] font-black uppercase tracking-widest italic">
            <Dna className="w-3.5 h-3.5" />
            {t('profileTuning.badge')}
          </div>
          <h2 className="text-4xl font-black text-[var(--text-main)] italic tracking-tighter uppercase leading-none">
            {profile.name}<br />
            <span className="text-indigo-400">{t('profileTuning.subtitle')}</span>
          </h2>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
          {/* PACING TAB */}
          <div
            className={`p-6 rounded-3xl border transition-all text-left space-y-3 group cursor-pointer ${activeTab === 'pacing' ? 'bg-indigo-600/20 border-indigo-500/40' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
            onClick={() => setActiveTab('pacing')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock3 className={`w-5 h-5 ${activeTab === 'pacing' ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest italic ${activeTab === 'pacing' ? 'text-white' : 'text-slate-500'}`}>{t('profileTuning.pacingTab')}</span>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform ${activeTab === 'pacing' ? 'rotate-90 text-indigo-400' : 'text-slate-700'}`} />
            </div>

            {activeTab === 'pacing' && (
              <div className="pt-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-500" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">{t('profileTuning.medianCut')}</label>
                    <span className="text-sm font-black text-white italic">{profile.pacing.medianClipLength}s</span>
                  </div>
                  <input
                    type="range" min="1" max="15" step="0.5"
                    title={t('profileTuning.medianCut')}
                    value={profile.pacing.medianClipLength}
                    onChange={(e) => setProfile({ ...profile, pacing: { ...profile.pacing, medianClipLength: parseFloat(e.target.value) } })}
                    className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/5">
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">{t('profileTuning.cutOnSentence')}</span>
                   <button
                    type="button"
                    title={t('profileTuning.cutOnSentence')}
                    onClick={() => setProfile({ ...profile, pacing: { ...profile.pacing, cutOnSentence: !profile.pacing.cutOnSentence } })}
                    className={`w-10 h-5 rounded-full relative transition-colors ${profile.pacing.cutOnSentence ? 'bg-indigo-500' : 'bg-white/10'}`}
                   >
                     <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${profile.pacing.cutOnSentence ? 'left-6' : 'left-1'}`} />
                   </button>
                </div>
              </div>
            )}
          </div>

          {/* TYPOGRAPHY TAB */}
          <div
            className={`p-6 rounded-3xl border transition-all text-left space-y-3 group cursor-pointer ${activeTab === 'typography' ? 'bg-indigo-600/20 border-indigo-500/40' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
            onClick={() => setActiveTab('typography')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Type className={`w-5 h-5 ${activeTab === 'typography' ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest italic ${activeTab === 'typography' ? 'text-white' : 'text-slate-500'}`}>{t('profileTuning.typographyTab')}</span>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform ${activeTab === 'typography' ? 'rotate-90 text-indigo-400' : 'text-slate-700'}`} />
            </div>

            {activeTab === 'typography' && (
              <div className="pt-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-500" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">{t('profileTuning.font')}</label>
                  <div className="flex gap-2">
                    <input
                      title={t('profileTuning.font')}
                      className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-black uppercase tracking-widest italic flex-1"
                      value={profile.assets.fontFamily}
                      onChange={(e) => setProfile({...profile, assets: {...profile.assets, fontFamily: e.target.value}})}
                    />
                    <div className="w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center text-white font-black" style={{ background: profile.assets.fontHex }}>Ab</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="shadow-dna" className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{t('profileTuning.shadowColor')}</label>
                    <input
                      id="shadow-dna"
                      title={t('profileTuning.shadowColor')}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-[10px] font-black" value={profile.assets.dropShadowHex}
                      onChange={(e) => setProfile({...profile, assets: {...profile.assets, dropShadowHex: e.target.value}})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="bezier-logic" className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{t('profileTuning.easingCurve')}</label>
                    <input
                      id="bezier-logic"
                      title={t('profileTuning.easingCurve')}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-[10px] font-black" value={profile.assets.bezierCurve}
                      onChange={(e) => setProfile({...profile, assets: {...profile.assets, bezierCurve: e.target.value}})}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* COLOR TAB */}
          <div
            className={`p-6 rounded-3xl border transition-all text-left space-y-3 group cursor-pointer ${activeTab === 'color' ? 'bg-indigo-600/20 border-indigo-500/40' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
            onClick={() => setActiveTab('color')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Palette className={`w-5 h-5 ${activeTab === 'color' ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest italic ${activeTab === 'color' ? 'text-white' : 'text-slate-500'}`}>{t('profileTuning.colorTab')}</span>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform ${activeTab === 'color' ? 'rotate-90 text-indigo-400' : 'text-slate-700'}`} />
            </div>
            {activeTab === 'color' && (
              <div className="pt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-500" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                        <Palette className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-black text-white uppercase tracking-widest italic">{gradeLabel ?? t('profileTuning.noColorGrade')}</span>
                   </div>
                   <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{t('profileTuning.colorGrade')}</span>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">{t('profileTuning.punchIn')}</label>
                    <span className="text-sm font-black text-white italic">+{profile.visuals.punchInAmount}%</span>
                  </div>
                  <input
                    type="range" min="0" max="50" step="1"
                    title={t('profileTuning.punchIn')}
                    value={profile.visuals.punchInAmount}
                    onChange={(e) => setProfile({ ...profile, visuals: { ...profile.visuals, punchInAmount: parseFloat(e.target.value) } })}
                    className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* AUDIO TAB */}
          <div
            className={`p-6 rounded-3xl border transition-all text-left space-y-3 group cursor-pointer ${activeTab === 'audio' ? 'bg-indigo-600/20 border-indigo-500/40' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
            onClick={() => setActiveTab('audio')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Volume2 className={`w-5 h-5 ${activeTab === 'audio' ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest italic ${activeTab === 'audio' ? 'text-white' : 'text-slate-500'}`}>{t('profileTuning.audioTab')}</span>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform ${activeTab === 'audio' ? 'rotate-90 text-indigo-400' : 'text-slate-700'}`} />
            </div>
            {activeTab === 'audio' && (
              <div className="pt-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-500" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">{t('profileTuning.ducking')}</label>
                    <span className="text-sm font-black text-white italic">{profile.audio.duckingDb}dB</span>
                  </div>
                  <input
                    type="range" min="-40" max="0" step="1"
                    title={t('profileTuning.ducking')}
                    value={profile.audio.duckingDb}
                    onChange={(e) => setProfile({ ...profile, audio: { ...profile.audio, duckingDb: parseFloat(e.target.value) } })}
                    className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4 pt-8 border-t border-white/10">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-8 py-5 rounded-[1.5rem] bg-white/[0.03] border border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic hover:text-white hover:bg-white/[0.06] transition-all"
          >
            {t('profileTuning.discard')}
          </button>
          <button
            type="button"
            onClick={() => onApply(profile)}
            className="flex-1 px-8 py-5 rounded-[1.5rem] bg-blue-600/20 border border-blue-500/30 text-[10px] font-black text-white uppercase tracking-[0.3em] italic hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {t('profileTuning.applyToTimeline')}
          </button>
          <button
            type="button"
            onClick={() => onSave(profile)}
            className="flex-[2] px-8 py-5 rounded-[1.5rem] bg-indigo-600 border border-indigo-500/30 text-[10px] font-black text-white uppercase tracking-[0.3em] italic hover:bg-indigo-500 flex items-center justify-center gap-3 shadow-[0_0_50px_rgba(79,70,229,0.3)] transition-all"
          >
            <Save className="w-4 h-4" />
            {t('profileTuning.save')}
          </button>
        </div>
      </div>

      {/* RIGHT: text style preview (font, color and shadow from this profile) */}
      <div className="flex-1 flex flex-col gap-8">
        <div className={`flex-1 ${glassStyle} rounded-[3rem] overflow-hidden relative group`}>
          <div className="absolute inset-0 bg-slate-900 bg-gradient-to-br from-indigo-500/10 via-transparent to-blue-500/10 flex items-center justify-center p-20">
            <m.div
              animate={{ scale: [1, 1.15, 1], transition: { duration: profile.pacing.medianClipLength, repeat: Infinity } }}
              style={{ fontFamily: profile.assets.fontFamily, color: profile.assets.fontHex, textShadow: `4px 4px 0px ${profile.assets.dropShadowHex}` }}
              className="text-8xl font-black italic tracking-tighter uppercase text-center"
            >
              {t('profileTuning.sampleText')}
            </m.div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full bg-black/60 border border-white/10 text-white/50 text-[10px] font-black uppercase tracking-widest italic">
            {t('profileTuning.previewLabel')}
          </div>
        </div>
      </div>
    </div>
  )
}
