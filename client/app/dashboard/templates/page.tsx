'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import EmptyState from '../../../components/EmptyState'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import TemplateMarketplace from '../../../components/TemplateMarketplace'
import { 
  Box, Layout, FileText, Layers, Cpu, Zap, 
  Target, Shield, Activity, Plus, Search, 
  Building, Briefcase, Code, Type, Image, 
  Youtube, Globe, ArrowUpRight, Star, 
  MoreHorizontal, Play, CheckCircle, ChevronDown, 
  Filter, Terminal, HardDrive, Radio, Hexagon,
  ArrowLeft, Network, Compass
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

// ── Interfaces ──────────────────────────────────────────────────────────────

interface Template {
  _id: string
  name: string
  description: string
  category: string
  niche: string
  preview?: {
    thumbnail?: string
    description?: string
  }
  usageCount: number
  rating: {
    average: number
    count: number
  }
  tags: string[]
  isPublic: boolean
}

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border-2 border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-1000'

export default function HeuristicBlueprintNodePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSector, setSelectedSector] = useState<string>('all')
  const [selectedDomain, setSelectedDomain] = useState<string>('all')
  const [showTerminal, setShowTerminal] = useState(false)

  const loadBlueprints = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (selectedSector !== 'all') params.append('category', selectedSector)
      if (selectedDomain !== 'all') params.append('niche', selectedDomain)

      const response = await axios.get(`${API_URL}/templates?${params.toString()}`)
      const templatesData: any = extractApiData<any[]>(response)
      setTemplates(Array.isArray(templatesData) ? templatesData : [])
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'SYNC_ERR: BLUEPRINT_OFFLINE', type: 'error' } }))
    } finally {
      setLoading(false)
    }
  }, [selectedSector, selectedDomain])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    loadBlueprints()
  }, [user, router, loadBlueprints])

  const handleInjectLogic = async (templateId: string) => {
    try {
      const [useRes, templateRes] = await Promise.all([
        axios.post(`${API_URL}/templates/${templateId}/use`, {}),
        axios.get(`${API_URL}/templates/${templateId}`)
      ])

      const templateData: any = extractApiData(templateRes)
      
      if (templateData) {
        if (templateData.category === 'social') {
          router.push(`/dashboard/content?template=${templateId}`)
        } else if (templateData.category === 'script') {
          router.push(`/dashboard/scripts?template=${templateId}`)
        } else {
          router.push(`/dashboard/content?template=${templateId}`)
        }
        window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'LOGIC_INJECTION_COMPLETE', type: 'success' } }))
      }
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'INJECTION_FAIL', type: 'error' } }))
    }
  }

  if (loading) {
    return (
       <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen gap-12 backdrop-blur-3xl">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
            <Layers size={80} className="text-indigo-500 animate-spin relative z-10" />
          </div>
          <div className="space-y-4 text-center">
            <p className="text-[14px] font-black text-indigo-400 uppercase tracking-[0.8em] animate-pulse italic leading-none">Deciphering Heuristic Blueprints...</p>
            <p className="text-[10px] font-black text-slate-1000 uppercase tracking-[0.4em] leading-none">HIGH_BANDWIDTH_SYG_ACTIVE</p>
          </div>
       </div>
    )
  }

  const sectors = ['all', 'social', 'video', 'blog', 'email', 'script', 'quote']
  const domains = ['all', 'health', 'finance', 'education', 'technology', 'lifestyle', 'business', 'entertainment']

  return (
    <div className="min-h-screen relative z-10 pb-24 px-8 pt-12 max-w-[1600px] mx-auto space-y-20">
      <div className="fixed inset-0 pointer-events-none opacity-5">
          <Network size={600} className="text-white" />
       </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-16 relative z-50">
        <div className="flex items-center gap-12">
          <button 
            onClick={() => router.push('/dashboard')} 
            title="Abort Blueprint Session"
            className="w-20 h-20 rounded-[2rem] bg-white/[0.02] border-2 border-white/10 flex items-center justify-center text-slate-900 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-3xl hover:border-rose-500/50">
            <ArrowLeft size={40} />
          </button>
          <div className="w-24 h-24 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-3xl relative group overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-80" />
             <Layers size={48} className="text-indigo-400 relative z-10 group-hover:scale-125 transition-transform duration-1000" />
          </div>
          <div>
            <div className="flex items-center gap-6 mb-4">
              <Compass className="text-indigo-400 animate-pulse" size={16} />
              <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Heuristic Scaffolding HUD v14.2</span>
            </div>
            <h1 className="text-9xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">BLUEPRINTS</h1>
            <p className="text-slate-1000 text-[14px] uppercase font-black tracking-[0.4em] mt-6 italic leading-none">Architectural pattern orchestration and structural scaffold surveillance.</p>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            title={showTerminal ? 'Abort Terminal' : 'Blueprint Terminal'}
            className={`px-16 py-8 rounded-[3rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-3xl transition-all duration-1000 flex items-center gap-8 italic group overflow-hidden relative ${showTerminal ? 'bg-indigo-500 text-white' : 'bg-white text-black'}`}
          >
            <div className={`absolute inset-0 bg-indigo-600 origin-left transition-transform duration-1000 ${showTerminal ? 'scale-x-0' : 'scale-x-100 group-hover:scale-x-0'}`} />
            <div className="relative z-10 flex items-center gap-6">
              <Globe size={32} className={showTerminal ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-1000'} /> 
              {showTerminal ? 'ABORT_TERMINAL' : 'BLUEPRINT_TERMINAL'}
            </div>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showTerminal && (
          <motion.div initial={{ opacity: 0, y: 50, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.95 }} className="relative z-20">
            <TemplateMarketplace />
          </motion.div>
        )}
      </AnimatePresence>

      {!showTerminal && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-16 relative z-10">
          {/* Blueprint Scaffolding Grid Filters */}
          <div className="lg:col-span-1 space-y-16 relative z-10">
            <div className={`${glassStyle} p-12 rounded-[5rem] flex flex-col gap-16 border-white/5 shadow-[0_100px_300px_rgba(0,0,0,0.8)]`}>
                <div className="space-y-10 px-4">
                  <div className="flex items-center justify-between px-6 pt-6">
                     <h3 className="text-[14px] font-black text-slate-1000 uppercase tracking-[0.6em] italic leading-none">Synthesis Modality</h3>
                     <Terminal size={18} className="text-slate-1000" />
                  </div>
                  <div className="space-y-4">
                    {sectors.map((sector) => (
                      <button
                        key={sector}
                        onClick={() => setSelectedSector(sector)}
                        title={`Select ${sector} modality`}
                        className={`w-full text-left px-10 py-6 rounded-[3rem] text-[14px] font-black uppercase tracking-[0.4em] transition-all duration-1000 italic flex items-center justify-between group/s overflow-hidden relative ${selectedSector === sector ? 'bg-white text-black shadow-3xl' : 'text-slate-900 hover:text-white hover:bg-white/[0.05]'}`}
                      >
                        <span className="relative z-10">{sector === 'all' ? 'SYST_GLOBAL' : sector.toUpperCase()}</span>
                        {selectedSector === sector ? (
                          <CheckCircle size={24} className="text-black relative z-10" />
                        ) : (
                          <ChevronDown size={20} className="text-slate-1000 group-hover/s:rotate-90 transition-transform duration-1000" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-10 pt-12 border-t-2 border-white/5 px-4 pb-6">
                  <div className="flex items-center justify-between px-6">
                     <h3 className="text-[14px] font-black text-slate-1000 uppercase tracking-[0.6em] italic leading-none">Knowledge Domain</h3>
                     <Target size={18} className="text-slate-1000" />
                  </div>
                  <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-6">
                    {domains.map((domain) => (
                      <button
                        key={domain}
                        onClick={() => setSelectedDomain(domain)}
                        title={`Select ${domain} domain`}
                        className={`w-full text-left px-10 py-6 rounded-[3rem] text-[14px] font-black uppercase tracking-[0.4em] transition-all duration-1000 italic flex items-center justify-between group/d ${selectedDomain === domain ? 'bg-indigo-500/10 text-indigo-400 border-2 border-indigo-500/50 shadow-[0_0_80px_rgba(99,102,241,0.2)]' : 'text-slate-1000 hover:text-white hover:bg-white/[0.05]'}`}
                      >
                        {domain.toUpperCase()}
                        {selectedDomain === domain && <div className="w-4 h-4 rounded-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,1)] animate-ping" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-8 border-t-2 border-white/5">
                   <div className="p-10 bg-indigo-500/5 rounded-[4rem] border-2 border-indigo-500/10 shadow-inner group/status overflow-hidden relative">
                      <div className="absolute inset-0 bg-indigo-500/5 scale-x-0 group-hover/status:scale-x-100 origin-left transition-transform duration-1000" />
                      <div className="relative z-10">
                        <div className="flex items-center gap-6 mb-6">
                           <Shield size={28} className="text-indigo-400 group-hover/status:scale-110 transition-transform duration-1000" />
                           <p className="text-[14px] font-black text-white uppercase tracking-[0.4em] italic">Protocol Status</p>
                        </div>
                        <p className="text-[12px] font-black text-slate-1000 leading-tight italic uppercase tracking-widest opacity-60">All blueprints are cryptographically secured and ready for neural injection into operational clusters.</p>
                      </div>
                   </div>
                </div>
            </div>
          </div>

          {/* Blueprint Telemetry Matrix Area */}
          <div className="lg:col-span-3 h-full">
            <div className={`${glassStyle} p-16 rounded-[6rem] h-full border-white/5 flex flex-col shadow-[0_100px_300px_rgba(0,0,0,1)]`}>
              <div className="flex flex-col md:flex-row items-center justify-between mb-20 gap-10">
                 <div className="flex items-center gap-10">
                    <div className="w-20 h-20 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-[2.5rem] flex items-center justify-center shadow-3xl group-hover:rotate-12 transition-transform duration-1000"><Terminal size={40} className="text-indigo-400" /></div>
                    <div>
                       <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Blueprint Telemetry Matrix</h2>
                       <p className="text-[14px] text-slate-1000 font-black uppercase tracking-[0.6em] italic opacity-40">Surveillance of structural scaffolds and logic patterns</p>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-8">
                    <div className="px-10 py-4 rounded-full bg-white/[0.02] border-2 border-white/10 text-[12px] font-black text-indigo-400 uppercase tracking-[0.4em] italic flex items-center gap-5 shadow-inner">
                       <Radio size={16} className="text-indigo-500 animate-pulse" /> {templates.length} SCHEMATICS_ONLINE
                    </div>
                 </div>
              </div>

              {templates.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-32 opacity-10 group/void">
                   <div className="w-48 h-48 bg-white/5 rounded-[6rem] border-2 border-white/5 flex items-center justify-center shadow-inner group-hover/void:scale-110 transition-transform duration-1000">
                      <HardDrive size={80} className="text-white group-hover/void:rotate-12 transition-transform duration-1000" />
                   </div>
                   <div className="space-y-6 mt-16">
                      <p className="text-[28px] font-black text-white uppercase tracking-[0.6em] italic leading-tight">Schematic Void Occupied</p>
                      <p className="text-[14px] font-black text-slate-1000 uppercase tracking-[0.4em] italic leading-none">No matching architectural patterns identified within current neural domain.</p>
                   </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-16">
                  {templates.map((template, idx) => (
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05, duration: 1 }}
                      whileHover={{ y: -20, scale: 1.02 }}
                      layout
                      key={template._id}
                      className="group bg-white/[0.02] border-2 border-white/5 rounded-[5rem] p-12 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all duration-1000 shadow-[0_50px_100px_rgba(0,0,0,0.8)] flex flex-col min-h-[580px] relative overflow-hidden h-full"
                    >
                      <div className="absolute top-0 right-0 p-12 opacity-0 group-hover:opacity-10 transition-opacity duration-1000 pointer-events-none -z-10"><Hexagon size={240} className="text-white" /></div>
                      
                      {template.preview?.thumbnail && (
                        <div className="relative mb-10 rounded-[3rem] overflow-hidden aspect-video border-2 border-white/10 shadow-3xl group-hover:border-indigo-500/30 transition-all duration-1000 group-hover:shadow-[0_0_100px_rgba(99,102,241,0.2)]">
                          <img
                            src={template.preview.thumbnail}
                            alt={template.name}
                            className="w-full h-full object-cover grayscale-[0.8] group-hover:grayscale-0 transition-all duration-[2s] group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#020205] via-transparent to-transparent opacity-80" />
                          <div className="absolute bottom-8 left-8 px-6 py-2 bg-indigo-500 text-black rounded-2xl border border-white/20 text-[10px] font-black uppercase tracking-widest italic translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-1000 shadow-3xl">
                             PREVIEW_HUD_ACTIVE
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-start mb-8 relative z-10 px-4">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.6em] italic">Blueprint_ID: {template._id.slice(-8).toUpperCase()}</p>
                          <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none group-hover:text-indigo-400 transition-colors duration-1000 line-clamp-1">{template.name.toUpperCase()}</h3>
                        </div>
                        {template.isPublic && (
                          <span className="shrink-0 px-5 py-2 bg-indigo-500 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest italic shadow-[0_0_30px_rgba(99,102,241,0.4)] animate-pulse">
                            SOVEREIGN
                          </span>
                        )}
                      </div>
                      
                      <div className="px-4 flex-1">
                         <p className="text-[14px] text-slate-1000 font-black uppercase tracking-widest mb-12 italic line-clamp-3 leading-tight opacity-40 group-hover:opacity-100 transition-opacity duration-1000">{template.description}</p>
                      </div>
                      
                      <div className="mt-auto space-y-10 relative z-10">
                        <div className="flex items-center gap-6 text-[11px] font-black text-slate-1000 uppercase tracking-widest italic border-t-2 border-white/5 pt-12 group-hover:text-indigo-400 transition-colors duration-1000 px-4">
                          <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border-2 border-white/5 group-hover:border-indigo-500/20">{template.category.toUpperCase()}</div>
                          <div className="w-2 h-2 rounded-full bg-slate-1000 opacity-20" />
                          <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border-2 border-white/5 group-hover:border-indigo-500/20">{template.niche.toUpperCase()}</div>
                          <div className="w-2 h-2 rounded-full bg-slate-1000 opacity-20" />
                          <span className="text-indigo-500/60 font-black tabular-nums">{template.usageCount} SYNCED</span>
                        </div>

                        {template.tags && template.tags.length > 0 && (
                          <div className="flex flex-wrap gap-5 px-4">
                            {template.tags.slice(0, 3).map((tag, index) => (
                              <span key={index} className="text-[11px] font-black text-slate-1000 uppercase italic group-hover:text-white transition-colors duration-1000 hover:text-indigo-400 cursor-default">
                                #{tag.toUpperCase()}
                              </span>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={() => handleInjectLogic(template._id)}
                          title="Initialize Heuristic Logic"
                          className="w-full bg-white text-black py-10 rounded-[3.5rem] text-[18px] font-black uppercase tracking-[0.5em] shadow-[0_50px_100px_rgba(255,255,255,0.05)] hover:bg-indigo-500 hover:text-white transition-all duration-1000 italic flex items-center justify-center gap-8 group/btn active:scale-95 translate-y-0 group-hover:-translate-y-4"
                        >
                          INITIALIZE_HEURISTIC_LOGIC <Zap size={32} className="group-hover/btn:animate-spin transition-all text-current" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
          background: #020205;
          color: white;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.4);
        }
      `}</style>
    </div>
  )
}
