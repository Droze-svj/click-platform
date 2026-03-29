'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import axios from 'axios'
import { ArrowLeft, Edit3, Save, X, Download, FileText, Code, Clock, Hash, Key, Layout, Layers, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import LoadingSpinner from '../../../../components/LoadingSpinner'
import ErrorAlert from '../../../../components/ErrorAlert'
import { useAuth } from '../../../../hooks/useAuth'
import { useToast } from '../../../../contexts/ToastContext'
import ToastContainer from '../../../../components/ToastContainer'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface Script {
  _id: string
  title: string
  type: string
  topic: string
  wordCount: number
  duration?: number
  script: string
  structure: {
    introduction: string
    mainPoints: Array<{ title: string; content: string; duration: number }>
    conclusion: string
    callToAction: string
  }
  metadata: {
    keywords: string[]
    hashtags: string[]
    timestamps: Array<{ time: string; section: string }>
  }
}

export default function ScriptDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [script, setScript] = useState<Script | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editedScript, setEditedScript] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadScript()
  }, [user, router, params.id])

  const loadScript = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/scripts/${params.id}`, {
      })
      if (response.data.success) {
        setScript(response.data.data)
        setEditedScript(response.data.data.script)
      }
    } catch (error: any) {
      showToast('Failed to load script', 'error')
      router.push('/dashboard/scripts')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!script) return

    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.put(
        `${API_URL}/scripts/${script._id}`,
        { script: editedScript },
        {
        }
      )
      if (response.data.success) {
        setScript(response.data.data)
        setEditing(false)
        showToast('Script saved successfully!', 'success')
      }
    } catch (error: any) {
      showToast('Failed to save script', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async (format: string) => {
    if (!script) return

    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/scripts/${script._id}/export?format=${format}`,
        {
          responseType: 'blob'
        }
      )

      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${script.title.replace(/\s+/g, '-')}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      showToast('Script exported successfully!', 'success')
    } catch (error: any) {
      showToast('Failed to export script', 'error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#020205] gap-8">
        <div className="relative">
           <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
           <RefreshCw size={80} className="text-indigo-500 animate-spin relative z-10" />
        </div>
        <p className="text-[14px] font-black text-indigo-400 uppercase tracking-[0.8em] animate-pulse italic leading-none">Calibrating Narrative Node...</p>
      </div>
    )
  }

  if (!script) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#020205] p-12 text-center">
        <div className="w-48 h-48 rounded-[3rem] bg-white/[0.02] border-2 border-white/5 flex items-center justify-center mb-10 shadow-3xl">
           <X size={80} className="text-rose-500/40" />
        </div>
        <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter mb-6">NARRATIVE_NODE_ABSENT</h2>
        <p className="text-slate-1000 text-[14px] font-black uppercase tracking-[0.4em] mb-12 italic">The requested logic cluster does not exist in the current lattice.</p>
        <button onClick={() => router.push('/dashboard/scripts')} className="px-10 py-5 bg-white text-black rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.6em] hover:bg-indigo-500 hover:text-white transition-all italic">ABORT_TO_MATRIX</button>
      </div>
    )
  }

  const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border-2 border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-1000'

  return (
    <div className="min-h-screen bg-[#020205] text-white selection:bg-indigo-500 selection:text-white relative overflow-hidden pb-48">
      <ToastContainer />
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
         <Layout size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
      </div>

      <div className="max-w-[1400px] mx-auto px-10 py-24 space-y-20 relative z-10">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-12 border-b-2 border-white/5 pb-16">
          <div className="flex items-center gap-12">
            <button
              onClick={() => router.push('/dashboard/scripts')}
              title="Abort to Matrix"
              className="w-20 h-20 rounded-[2rem] bg-white/[0.02] border-2 border-white/10 flex items-center justify-center text-slate-1000 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-3xl"
            >
              <ArrowLeft size={32} />
            </button>
            <div>
               <div className="flex items-center gap-6 mb-4">
                  <div className="flex items-center gap-3">
                     <Layers size={16} className="text-indigo-400" />
                     <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Narrative Node v8.9</span>
                  </div>
                  <div className="px-4 py-1.5 rounded-full bg-black/40 border border-white/5 text-[9px] font-black text-slate-1000 tracking-widest uppercase italic leading-none">{script.type.toUpperCase()}_PROTOCOL</div>
               </div>
               <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">{script.title.toUpperCase()}</h1>
               <div className="flex items-center gap-10 text-[12px] font-black text-slate-1000 uppercase tracking-[0.4em] italic leading-none opacity-60">
                 <span className="flex items-center gap-3"><FileText size={16} className="text-indigo-400" /> {script.wordCount} PARTICLES</span>
                 {script.duration && <span className="flex items-center gap-3"><Clock size={16} className="text-indigo-400" /> {script.duration} MIN_SYNC</span>}
               </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            {!editing ? (
              <>
                <button
                  onClick={() => setEditing(true)}
                  title="Initialize Logic Modification"
                  className="px-10 py-5 bg-white text-black hover:bg-indigo-500 hover:text-white rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.4em] transition-all flex items-center gap-5 italic active:scale-95 shadow-2xl"
                >
                  <Edit3 size={20} /> MODIFY_LOGIC
                </button>
                <div className="flex gap-4">
                  <button
                    onClick={() => handleExport('txt')}
                    title="Export as RAW_TXT"
                    className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-1000 hover:text-white transition-all hover:border-indigo-500/50"
                  >
                    <Download size={24} />
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    title="Export as NEURAL_JSON"
                    className="w-16 h-16 rounded-[1.8rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all"
                  >
                    <Code size={24} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex gap-6">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  title="Seal Node Parameters"
                  className="px-10 py-5 bg-emerald-500 text-white rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.4em] transition-all flex items-center gap-5 italic active:scale-95 shadow-[0_20px_60px_rgba(16,185,129,0.3)] disabled:opacity-50"
                >
                  {saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />} SEAL_LOGIC
                </button>
                <button
                  onClick={() => {
                    setEditing(false)
                    setEditedScript(script.script)
                  }}
                  title="Abort Modification"
                  className="w-16 h-16 rounded-[1.8rem] bg-rose-500/5 border-2 border-rose-500/20 flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                >
                  <X size={24} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={`${glassStyle} rounded-[6rem] p-16 shadow-[0_100px_300px_rgba(0,0,0,0.8)] relative group overflow-hidden`}>
           <div className="absolute top-0 right-0 p-20 opacity-[0.02] pointer-events-none group-hover:rotate-45 transition-transform duration-[4s]"><FileText size={500} /></div>
          {editing ? (
            <textarea
              value={editedScript}
              onChange={(e) => setEditedScript(e.target.value)}
              className="w-full h-[600px] bg-black/60 border-2 border-white/5 rounded-[4rem] p-16 text-xl font-black text-slate-300 italic uppercase focus:border-indigo-500/50 transition-all shadow-inner leading-relaxed custom-scrollbar placeholder:text-slate-950"
              placeholder="Edit your narrative logic cluster..."
              aria-label="Edit Script"
            />
          ) : (
            <div className="space-y-24">
              <div className="relative">
                 <div className="bg-black/60 border-2 border-white/5 rounded-[4rem] p-16 text-xl font-black text-indigo-200 italic uppercase leading-relaxed shadow-inner selection:bg-indigo-500 selection:text-white whitespace-pre-wrap font-mono">
                   {script.script}
                 </div>
                 <div className="absolute top-8 right-8 flex items-center gap-3 px-6 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase tracking-widest italic animate-pulse">RAW_NARRATIVE_LATTICE</div>
              </div>

              {script.structure.mainPoints && script.structure.mainPoints.length > 0 && (
                <div className="space-y-12">
                   <div className="flex items-center gap-6"><div className="h-px bg-white/5 flex-1" /><span className="text-[14px] font-black text-white uppercase tracking-[0.8em] italic leading-none">STRUCTURAL_HIERARCHY</span><div className="h-px bg-white/5 flex-1" /></div>
                   <div className="grid grid-cols-1 gap-10">
                    {script.structure.introduction && (
                      <div className="p-12 rounded-[3.5rem] bg-indigo-500/[0.03] border-2 border-indigo-500/20 shadow-2xl group/item">
                        <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.5em] mb-6 italic leading-none">00_INTRODUCTION</h4>
                        <p className="text-[16px] font-black text-slate-300 uppercase tracking-widest leading-relaxed italic">{script.structure.introduction}</p>
                      </div>
                    )}
                    {script.structure.mainPoints.map((point, index) => (
                      <div key={index} className="p-12 rounded-[3.5rem] bg-white/[0.02] border-2 border-white/10 hover:border-indigo-500/30 transition-all duration-700 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                           <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.5em] italic leading-none">0{index + 1}_{point.title.replace(/\s+/g, '_').toUpperCase()}</h4>
                           {point.duration && <span className="text-[10px] font-black text-slate-1000 uppercase tracking-widest italic opacity-40">{point.duration} MIN_SEGMENT</span>}
                        </div>
                        <p className="text-[18px] font-black text-white uppercase tracking-widest leading-relaxed italic">{point.content}</p>
                      </div>
                    ))}
                    {script.structure.conclusion && (
                      <div className="p-12 rounded-[3.5rem] bg-indigo-500/[0.03] border-2 border-indigo-500/20 shadow-2xl">
                        <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.5em] mb-6 italic leading-none">XX_CONCLUSION</h4>
                        <p className="text-[16px] font-black text-slate-300 uppercase tracking-widest leading-relaxed italic">{script.structure.conclusion}</p>
                      </div>
                    )}
                    {script.structure.callToAction && (
                      <div className="p-12 rounded-[3.5rem] bg-emerald-500/[0.03] border-2 border-emerald-500/20 shadow-2xl">
                        <h4 className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.5em] mb-6 italic leading-none">FINAL_CONVERSION_HITCH</h4>
                        <p className="text-[16px] font-black text-emerald-100 uppercase tracking-widest leading-relaxed italic">{script.structure.callToAction}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {script.metadata.timestamps && script.metadata.timestamps.length > 0 && (
                  <div className="p-12 rounded-[4rem] bg-black/40 border-2 border-white/5 space-y-10 shadow-3xl">
                    <h3 className="text-[14px] font-black text-white uppercase tracking-[0.6em] mb-8 italic flex items-center gap-4 border-b border-white/5 pb-6"><Clock size={16} className="text-indigo-400" /> TIMESTAMPS</h3>
                    <div className="space-y-6">
                      {script.metadata.timestamps.map((ts, index) => (
                        <div key={index} className="flex gap-6 items-center p-4 rounded-2xl bg-white/[0.02] border border-white/5 group/ts transition-all duration-700 hover:bg-white/[0.05]">
                          <span className="font-mono font-black text-indigo-400 text-[14px] shadow-inner">{ts.time}</span>
                          <span className="text-[11px] font-black text-slate-1000 uppercase tracking-widest italic group-ts:text-white transition-colors">{ts.section}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {script.metadata.keywords && script.metadata.keywords.length > 0 && (
                  <div className="p-12 rounded-[4rem] bg-black/40 border-2 border-white/5 space-y-10 shadow-3xl">
                    <h3 className="text-[14px] font-black text-white uppercase tracking-[0.6em] mb-8 italic flex items-center gap-4 border-b border-white/5 pb-6"><Key size={16} className="text-indigo-400" /> LOGIC_KEYS</h3>
                    <div className="flex flex-wrap gap-4">
                      {script.metadata.keywords.map((keyword, index) => (
                        <span key={index} className="bg-indigo-500/10 border-2 border-indigo-500/20 text-indigo-400 px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest italic shadow-3xl hover:bg-indigo-500 hover:text-white transition-all cursor-default">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {script.metadata.hashtags && script.metadata.hashtags.length > 0 && (
                  <div className="p-12 rounded-[4rem] bg-black/40 border-2 border-white/5 space-y-10 shadow-3xl">
                    <h3 className="text-[14px] font-black text-white uppercase tracking-[0.6em] mb-8 italic flex items-center gap-4 border-b border-white/5 pb-6"><Hash size={16} className="text-indigo-400" /> SIGNAL_TAGS</h3>
                    <div className="flex flex-wrap gap-4">
                      {script.metadata.hashtags.map((hashtag, index) => (
                        <span key={index} className="bg-rose-500/10 border-2 border-rose-500/20 text-rose-400 px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest italic shadow-3xl hover:bg-rose-500 hover:text-white transition-all cursor-default">
                          #{hashtag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;400;700;900&display=swap');
        body { font-family: 'Outfit', sans-serif; background: #020205; color: white; overflow-x: hidden; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.4); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 20px; border: 2px solid rgba(0,0,0,0.5); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.6); }
      `}</style>
    </div>
  )
}







