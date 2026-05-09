'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Edit3, Check, X, Shield, Sparkles, Fingerprint } from 'lucide-react'
import { apiPost } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

const ProfileHUD = () => {
  const { user, refresh } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(user?.name || '')
  const [niche, setNiche] = useState(user?.niche || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiPost('/user/profile', { name, niche })
      await refresh(true)
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to update profile', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative">
      <AnimatePresence>
        {!isEditing ? (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-2 sm:py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group min-w-[140px] sm:min-w-[180px]"
          >
            <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30 group-hover:scale-110 transition-transform">
              <User size={18} />
            </div>
            <div className="text-left">
              <p className="text-[9px] sm:text-[10px] font-black text-[var(--text-dim)] uppercase tracking-[0.2em] mb-0.5">Profile Hub</p>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs sm:text-sm font-black text-[var(--text-main)] italic uppercase">{user?.name || 'Creator'}</span>
                <Edit3 size={10} className="text-[var(--text-dim)] opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
              </div>
            </div>
          </motion.button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 top-full mt-4 p-5 sm:p-6 rounded-[2rem] bg-[var(--page-bg)] backdrop-blur-3xl border border-white/20 shadow-[0_30px_100px_rgba(0,0,0,0.4)] w-[calc(100vw-3rem)] sm:w-[350px] max-w-sm text-left z-[100]"
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
              <Shield size={16} className="text-indigo-400" />
              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em] italic">Identity Matrix</h4>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest block ml-1">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="Your Name"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest block ml-1">Content Niche</label>
                <input
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="e.g. Finance, Gaming, Tech"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 shadow-glow-primary"
                >
                  {saving ? <Sparkles size={14} className="animate-spin" /> : <Check size={14} />}
                  Synchronize
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all flex-shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2">
               <Fingerprint size={12} className="text-white/20" />
               <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] text-center">Identity Synchronization Active</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ProfileHUD
