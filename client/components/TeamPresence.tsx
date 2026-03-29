'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, UserPlus, Circle, Plus, X, Mail, TrendingUp } from 'lucide-react'
import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import { useToast } from '../contexts/ToastContext'

interface TeamMember {
  userId: { _id: string; name: string; email: string }
  role: string
  isOnline?: boolean
}

export default function TeamPresence() {
  const { user } = useAuth()
  const { socket, connected, on, off } = useSocket(user?.id)
  const { showToast } = useToast()

  const [members, setMembers] = useState<TeamMember[]>([])
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    loadTeamMembers()
  }, [])

  useEffect(() => {
    if (!socket || !connected) return

    const handlePresence = (users: string[]) => {
      setOnlineUsers(users)
    }

    on('presence-update', handlePresence)
    if (socket) socket.emit('get-presence')

    return () => {
      off('presence-update', handlePresence)
    }
  }, [socket, connected, on, off])

  const loadTeamMembers = async () => {
    try {
      const res = await apiGet('/teams')
      const teams = (res as any)?.data || []
      if (teams.length > 0) {
        setMembers(teams[0].members || [])
      }
    } catch (err) {
      console.error('Failed to load team members', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await apiGet('/teams')
      const teams = (res as any)?.data || []
      if (teams.length === 0) {
        showToast('Please create a team first', 'error')
        return
      }

      await apiPost(`/teams/${teams[0]._id}/invite-by-email`, {
        email: inviteEmail.trim(),
        role: 'editor'
      })

      showToast('Invitation sent successfully', 'success')
      setInviteEmail('')
      setShowInviteModal(false)
      loadTeamMembers()
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to send invite', 'error')
    } finally {
      setInviting(false)
    }
  }

  const activeMembers = members.map(m => ({
    ...m,
    isOnline: onlineUsers.includes((m.userId as any)?._id || (m.userId as any)?.id)
  })).sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0))

  return (
    <div className="flex items-center gap-4">
      <div className="flex -space-x-3 overflow-hidden">
        <AnimatePresence>
          {activeMembers.slice(0, 5).map((member, i) => (
            <motion.div
              key={(member.userId as any)?._id || i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative"
            >
              <div
                className={`w-10 h-10 rounded-full border-2 border-[#020202] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shadow-lg overflow-hidden group hover:z-10 transition-all duration-300 ring-2 ring-white/5`}
                title={member.userId?.name}
              >
                {member.userId?.name?.charAt(0).toUpperCase()}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-[8px] uppercase tracking-tighter">{member.role}</span>
                </div>
              </div>
              {member.isOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#020202] shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {activeMembers.length > 5 && (
          <div className="w-10 h-10 rounded-full border-2 border-[#020202] bg-slate-800 flex items-center justify-center text-white text-[10px] font-black z-0 font-mono">
            +{activeMembers.length - 5}
          </div>
        )}
      </div>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowInviteModal(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] transition-all text-slate-400 hover:text-white"
      >
        <UserPlus className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Invite</span>
      </motion.button>

      {/* Collective Strategy Signal (Phase 10) */}
      <div className="hidden lg:flex px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 items-center gap-3 shadow-lg shadow-indigo-500/5">
         <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
         <div className="flex flex-col">
            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest italic leading-none">Collective Strategy</span>
            <span className="text-[9px] font-bold text-white uppercase italic mt-0.5">Focus: AI Productivity (High velocity)</span>
         </div>
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-8 shadow-3xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />

              <button
                onClick={() => setShowInviteModal(false)}
                className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Collaborate</h3>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Scale your content ecosystem</p>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="teammate@click.ai"
                      className="w-full bg-white/[0.02] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-indigo-500 transition-all text-white placeholder:text-slate-700"
                    />
                  </div>

                  <button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail}
                    className="w-full bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    {inviting ? 'Encrypting Invite...' : 'Send Logic Access'}
                  </button>
                </div>

                <p className="text-[10px] text-center text-slate-600 uppercase font-bold tracking-widest">
                  External members will receive a secure portal link
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
