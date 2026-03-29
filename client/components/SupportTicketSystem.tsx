'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Plus, Send, Clock, CheckCircle2, XCircle, ShieldAlert, Sparkles, Activity, Search, AlertTriangle, Fingerprint } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface SupportTicket {
  _id: string
  subject: string
  description: string
  status: string
  priority: string
  category: string
  messages: Array<{
    message: string
    userId: string
    createdAt: string
  }>
  createdAt: string
}

const glassStyle = "backdrop-blur-3xl bg-black/40 border border-white/10 shadow-2xl shadow-black/40"

export default function SupportTicketSystem() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    loadTickets()
  }, [])

  const loadTickets = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/help/tickets', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setTickets(data.data.tickets || [])
      }
    } catch (error) {
      console.error('Failed to load tickets:', error)
    }
  }

  const createTicket = async (ticketData: {
    subject: string
    description: string
    category: string
    priority: string
  }) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/help/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(ticketData)
      })

      if (response.ok) {
        await loadTickets()
        setIsCreating(false)
        showToast('Secure Ticket Uplink Established', 'success')
      }
    } catch (error) {
      console.error('Failed to create ticket:', error)
      showToast('Uplink Failed', 'error')
    }
  }

  const sendMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/help/tickets/${selectedTicket._id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ message: newMessage })
      })

      if (response.ok) {
        setNewMessage('')
        await loadTickets()
        const updated = tickets.find(t => t._id === selectedTicket._id)
        if (updated) setSelectedTicket(updated)
        showToast('Encrypted Packet Sent', 'success')
        setIsTyping(true)
        setTimeout(() => setIsTyping(false), 3000)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      showToast('Transmission Failed', 'error')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      case 'open':
        return <Activity className="w-4 h-4 text-amber-400 animate-pulse" />
      default:
        return <Clock className="w-4 h-4 text-slate-400" />
    }
  }

  return (
    <div className="h-full bg-[#050510] text-white p-8 overflow-y-auto custom-scrollbar relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-black to-black pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header - Support Nexus Command */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-8">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <ShieldAlert className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">
                  Support Nexus
                </h1>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em] block italic">
                  Elite Customer Operations Protocol
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className={`hidden lg:flex items-center gap-4 px-6 py-3 rounded-2xl ${glassStyle}`}>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">All Systems Nominal</span>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest italic">AI Agent Ready</span>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCreating(true)}
              className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest italic flex items-center gap-3 shadow-[0_0_30px_rgba(79,70,229,0.3)] border border-indigo-400/30 hover:bg-indigo-500 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Establish Uplink
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {isCreating && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <CreateTicketForm
                onSubmit={createTicket}
                onCancel={() => setIsCreating(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Active Uplinks (Ticket List) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] italic">Active Strands</span>
              <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                <Search className="w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div className="space-y-3">
              {tickets.length === 0 ? (
                <div className={`p-10 text-center rounded-[2rem] ${glassStyle}`}>
                  <Fingerprint className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">No Active Uplinks</p>
                </div>
              ) : (
                tickets.map((ticket) => (
                  <motion.button
                    whileHover={{ scale: 1.02, x: 5 }}
                    key={ticket._id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`w-full p-6 text-left rounded-[2rem] border transition-all ${selectedTicket?._id === ticket._id
                      ? 'border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_30px_rgba(79,70,229,0.1)]'
                      : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                      }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className={`font-black uppercase tracking-tight text-sm italic ${selectedTicket?._id === ticket._id ? 'text-indigo-400' : 'text-slate-300'}`}>
                        {ticket.subject}
                      </h3>
                      {getStatusIcon(ticket.status)}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-4 italic">
                      {ticket.description}
                    </p>
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                      <div className="flex items-center gap-3 border border-white/10 rounded-full px-3 py-1 bg-black/40">
                        <span className={ticket.status === 'open' ? 'text-amber-400' : 'text-slate-400'}>{ticket.status}</span>
                        <div className="w-1 h-1 rounded-full bg-white/20" />
                        <span className={ticket.priority === 'high' || ticket.priority === 'urgent' ? 'text-rose-400' : 'text-indigo-400'}>{ticket.priority}</span>
                      </div>
                      <span className="text-slate-600">ID: {ticket._id.slice(-6)}</span>
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </div>

          {/* Secure Transmissions (Ticket Details) */}
          <div className="lg:col-span-8">
            {selectedTicket ? (
              <motion.div
                key={selectedTicket._id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex flex-col h-[700px] rounded-[3rem] border border-white/10 overflow-hidden ${glassStyle}`}
              >
                {/* Header */}
                <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">
                      {selectedTicket.subject}
                    </h2>
                    <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <span className="flex items-center gap-2"><Clock className="w-3 h-3" /> Initiated: {new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-2"><Fingerprint className="w-3 h-3" /> Kernel: {selectedTicket.category}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex flex-col items-end">
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic mb-1">Status</span>
                    <span className="text-sm font-black text-white uppercase italic">{selectedTicket.status}</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                  {/* Initial Description */}
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex flex-shrink-0 items-center justify-center">
                      <span className="text-xs font-black">U</span>
                    </div>
                    <div className="flex-1 bg-white/5 border border-white/10 p-6 rounded-3xl rounded-tl-none">
                      <p className="text-sm text-slate-300 leading-relaxed font-mono">
                        {selectedTicket.description}
                      </p>
                    </div>
                  </div>

                  {selectedTicket.messages.map((msg, index) => {
                    const isSystem = msg.userId === 'system' || msg.userId.includes('agent');
                    return (
                      <div key={index} className={`flex gap-4 ${isSystem ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-10 h-10 rounded-xl border flex flex-shrink-0 items-center justify-center ${isSystem ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400' : 'bg-white/10 border-white/20'}`}>
                          {isSystem ? <Sparkles className="w-5 h-5" /> : <span className="text-xs font-black">U</span>}
                        </div>
                        <div className={`flex-1 p-6 rounded-3xl ${isSystem ? 'bg-indigo-600/10 border border-indigo-500/20 rounded-tr-none' : 'bg-white/5 border border-white/10 rounded-tl-none'}`}>
                          <p className={`text-sm leading-relaxed ${isSystem ? 'text-indigo-100' : 'text-slate-300'}`}>
                            {msg.message}
                          </p>
                          <p className="text-[9px] font-black text-slate-500 mt-4 uppercase tracking-widest italic text-right">
                            {new Date(msg.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )
                  })}

                  {isTyping && (
                    <motion.div
                      key="typing-indicator"
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="flex gap-4 flex-row-reverse"
                    >
                      <div className="w-10 h-10 rounded-xl border flex flex-shrink-0 items-center justify-center bg-indigo-600/20 border-indigo-500/50 text-indigo-400">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="p-4 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 rounded-tr-none flex items-center justify-center gap-3">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic">Nexus Routing</span>
                        <span className="flex gap-1.5">
                          <motion.span animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0 }} className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <motion.span animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <motion.span animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-6 border-t border-white/5 bg-white/[0.01] flex flex-col gap-4">
                  {/* Quick Actions / AI Suggestions */}
                  <div className="flex flex-wrap items-center gap-3 px-2">
                    <span className="text-[8px] font-black text-amber-500 uppercase tracking-[0.2em] italic flex items-center gap-1"><Sparkles className="w-3 h-3" /> Neural Drafts:</span>
                    {['Status Update?', 'Escalate Priority', 'Send Diagnostics', 'Close Uplink'].map((draft, i) => (
                      <button
                        key={i}
                        onClick={() => setNewMessage(draft)}
                        className="px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-[9px] font-black text-indigo-300 uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-colors italic shadow-[0_0_10px_rgba(79,70,229,0.1)]"
                      >
                        {draft}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-4 items-end relative">
                    <div className="flex-1 relative">
                      <div className="absolute top-4 left-4">
                        <AlertTriangle className="w-5 h-5 text-slate-500" />
                      </div>
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        placeholder="TRANSMIT SUPPORT KERNEL..."
                        className="w-full bg-black/50 border border-white/10 rounded-3xl pl-12 pr-6 py-4 text-sm font-black text-white italic placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors custom-scrollbar resize-none h-[60px]"
                      />
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={sendMessage}
                      className="h-[60px] px-8 bg-indigo-600 text-white rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(79,70,229,0.3)] border border-indigo-400/30 hover:bg-indigo-500 transition-colors group"
                    >
                      <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className={`h-[700px] rounded-[3rem] border border-white/5 flex flex-col items-center justify-center ${glassStyle}`}>
                <div className="p-8 rounded-full bg-white/[0.02] border border-white/5 shadow-[0_0_100px_rgba(255,255,255,0.02)] mb-8">
                  <ShieldAlert className="w-20 h-20 text-slate-700" />
                </div>
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">No Uplink Selected</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Select an active strand from the index to begin transmission</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateTicketForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: any) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    category: 'other',
    priority: 'medium',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className={`mb-12 p-10 rounded-[3rem] border border-indigo-500/30 shadow-[0_0_50px_rgba(79,70,229,0.1)] relative overflow-hidden ${glassStyle}`}>
      <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none text-indigo-500 mix-blend-screen">
        <Activity className="w-64 h-64" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row gap-12">
        <div className="w-full md:w-1/3 space-y-6">
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl w-max">
            <Plus className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">
              New Uplink
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic leading-relaxed">
              Establish a secure connection with the Click support entity. Detail your request for optimal neural routing.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-6">
          <div>
            <input
              id="ticket-subject"
              type="text"
              placeholder="UPLINK DESIGNATION (SUBJECT)..."
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
              className="w-full px-6 py-5 border border-white/10 rounded-2xl bg-black/40 text-sm font-black text-white italic uppercase tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
          <div>
            <textarea
              id="ticket-description"
              placeholder="TRANSMISSION PAYLOAD (DESCRIPTION)..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              rows={4}
              className="w-full px-6 py-5 border border-white/10 rounded-2xl bg-black/40 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors custom-scrollbar resize-none"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="ticket-category" className="block text-[9px] font-black text-slate-500 uppercase tracking-widest italic mb-3">
                Routing Kernel
              </label>
              <select
                id="ticket-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-6 py-4 border border-white/10 rounded-2xl bg-black/40 text-[10px] font-black uppercase tracking-widest text-white focus:outline-none focus:border-indigo-500/50 appearance-none italic"
              >
                <option value="technical">Technical Matrix</option>
                <option value="billing">Commercial Sector</option>
                <option value="feature-request">Neural Request</option>
                <option value="bug-report">Anomaly Report</option>
                <option value="other">Uncategorized</option>
              </select>
            </div>
            <div>
              <label htmlFor="ticket-priority" className="block text-[9px] font-black text-slate-500 uppercase tracking-widest italic mb-3">
                Uplink Priority
              </label>
              <select
                id="ticket-priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-6 py-4 border border-white/10 rounded-2xl bg-black/40 text-[10px] font-black uppercase tracking-widest text-white focus:outline-none focus:border-indigo-500/50 appearance-none italic"
              >
                <option value="low">Low (Standard Routing)</option>
                <option value="medium">Medium (Elevated)</option>
                <option value="high">High (Priority)</option>
                <option value="urgent">Urgent (Bypass All)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onCancel}
              className="px-8 py-4 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/5 hover:text-white transition-all italic"
            >
              Abort
            </button>
            <button
              type="submit"
              className="px-10 py-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest italic shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:bg-indigo-500 transition-all"
            >
              Transmit Uplink
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}






