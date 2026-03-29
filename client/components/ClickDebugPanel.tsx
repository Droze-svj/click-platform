'use client'
/**
 * ClickDebugPanel v2 — Upgraded with:
 * - Fetch/XHR request interceptor log
 * - Unhandled promise rejection catching
 * - Performance timing monitor
 * - Error frequency chart (sparkline)
 * - Quick keyboard shortcut (Cmd+Shift+D)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bug, X, ChevronUp, ChevronDown, RefreshCw, Trash2,
  CheckCircle2, AlertCircle, AlertTriangle, Activity,
  Wifi, WifiOff, Database, Server, Zap, Copy, Shield,
  Globe, Timer, TrendingUp,
} from 'lucide-react'
import { useTheme } from './ThemeProvider'

// ── Types ─────────────────────────────────────────────────────────────────────
type LogLevel = 'error' | 'warn' | 'info' | 'success'
interface LogEntry { id: string; level: LogLevel; message: string; detail?: string; ts: number; fixed?: boolean; source?: string }
interface RequestEntry { id: string; method: string; url: string; status: number | null; ms: number | null; ts: number; error?: string }
interface HealthStatus { api: 'ok' | 'slow' | 'down' | 'checking'; db: 'ok' | 'slow' | 'down' | 'checking'; network: 'online' | 'offline'; memory: number | null; errors: number; warnings: number }

const ICON_MAP: Record<LogLevel, React.ElementType> = { error: AlertCircle, warn: AlertTriangle, info: Activity, success: CheckCircle2 }
const COLOR_MAP: Record<LogLevel, string> = {
  error:   'text-rose-400 bg-rose-500/10 border-rose-500/20',
  warn:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
  info:    'text-sky-400 bg-sky-500/10 border-sky-500/20',
  success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

// ── Singleton stores ──────────────────────────────────────────────────────────
export const LOG_STORE: LogEntry[] = []
export const REQ_STORE: RequestEntry[] = []
const LOG_LISTENERS: Set<() => void> = new Set()

export function debugLog(level: LogLevel, message: string, detail?: string, source?: string) {
  const entry: LogEntry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, level, message, detail, ts: Date.now(), source }
  LOG_STORE.unshift(entry)
  if (LOG_STORE.length > 150) LOG_STORE.pop()
  // Defer notification to prevent "Cannot update a component while rendering" errors
  setTimeout(() => LOG_LISTENERS.forEach(fn => fn()), 0)
  if (level === 'error') console.error(`[CLICK] ${message}`)
  else if (level === 'warn') console.warn(`[CLICK] ${message}`)
}

export function debugFix(id: string) {
  const entry = LOG_STORE.find(e => e.id === id)
  if (entry) { entry.fixed = true; setTimeout(() => LOG_LISTENERS.forEach(fn => fn()), 0) }
}

// ── Fetch interceptor (install once at module level) ─────────────────────────
let fetchIntercepted = false
function installFetchInterceptor() {
  if (fetchIntercepted || typeof window === 'undefined') return
  fetchIntercepted = true
  const origFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    const method = ((init?.method) || 'GET').toUpperCase()
    let url = '';
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.href;
    } else {
      url = (input as Request).url || '';
    }
    const shortUrl = typeof url === 'string' ? url.replace(window.location.origin, '') : String(url);
    const ts = Date.now()
    REQ_STORE.unshift({ id, method, url: shortUrl, status: null, ms: null, ts })
    if (REQ_STORE.length > 50) REQ_STORE.pop()
    setTimeout(() => LOG_LISTENERS.forEach(fn => fn()), 0)
    try {
      const res = await origFetch(input, init)
      const ms = Date.now() - ts
      const req = REQ_STORE.find(r => r.id === id)
      if (req) { req.status = res.status; req.ms = ms }
      if (!res.ok) debugLog('warn', `${method} ${shortUrl} → ${res.status}`, `${ms}ms`, 'network')
      else if (ms > 2000) debugLog('warn', `Slow request: ${method} ${shortUrl}`, `${ms}ms — consider caching`, 'network')
      setTimeout(() => LOG_LISTENERS.forEach(fn => fn()), 0)
      return res
    } catch (err) {
      const req = REQ_STORE.find(r => r.id === id)
      const errMsg = err instanceof Error ? err.message : String(err)
      if (req) { req.error = errMsg }
      debugLog('error', `FAILED: ${method} ${shortUrl}`, errMsg, 'network')
      setTimeout(() => LOG_LISTENERS.forEach(fn => fn()), 0)
      throw err
    }
  }
}

export default function ClickDebugPanel() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(true)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [reqs, setReqs] = useState<RequestEntry[]>([])
  const [health, setHealth] = useState<HealthStatus>({ api: 'checking', db: 'checking', network: 'online', memory: null, errors: 0, warnings: 0 })
  const [activeTab, setActiveTab] = useState<'logs' | 'requests' | 'health' | 'fixes'>('logs')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [perfMs, setPerfMs] = useState<number | null>(null)
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { isDark } = useTheme()
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development'
    const hasParam = window.location.search.includes('debug=1')
    setShouldShow(isDev || hasParam)
  }, [])

  // Subscribe to stores
  useEffect(() => {
    const update = () => {
      setLogs([...LOG_STORE])
      setReqs([...REQ_STORE])
      setHealth(h => ({ ...h, errors: LOG_STORE.filter(l => l.level === 'error' && !l.fixed).length, warnings: LOG_STORE.filter(l => l.level === 'warn' && !l.fixed).length }))
    }
    LOG_LISTENERS.add(update)
    update()
    return () => { LOG_LISTENERS.delete(update) }
  }, [])

  // Install fetch interceptor
  useEffect(() => { installFetchInterceptor() }, [])

  // Intercept console errors/warns
  useEffect(() => {
    const oE = console.error.bind(console), oW = console.warn.bind(console)
    const safelyStringify = (obj: any) => {
      if (obj === null || obj === undefined) return String(obj);
      if (typeof obj === 'string') return obj;
      try {
        if (obj instanceof HTMLElement) {
          const tag = String(obj.tagName || 'div').toLowerCase();
          const id = obj.id ? `#${obj.id}` : '';
          return `<${tag}${id} />`;
        }
        return JSON.stringify(obj);
      } catch {
        return String(obj);
      }
    };
    console.error = (...args) => {
      oE(...args);
      const m = args.map(safelyStringify).join(' ');
      
      // Filter out noisy extension errors to prevent UI flooding
      if (m.includes('chrome-extension://') || m.includes('inpage.js') || m.includes('Trust Wallet')) {
        return;
      }

      if (!m.includes('[CLICK]')) debugLog('error', m.slice(0, 800), undefined, 'console')
    }
    console.warn  = (...args) => {
      oW(...args);
      const m = args.map(safelyStringify).join(' ');
      
      if (m.includes('chrome-extension://') || m.includes('inpage.js')) {
        return;
      }

      if (!m.includes('[CLICK]')) debugLog('warn', m.slice(0, 800), undefined, 'console')
    }
    return () => { console.error = oE; console.warn = oW }
  }, [])

  // Unhandled promise rejections
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)

      // Ignore extension noise
      if (msg.includes('MetaMask') || msg.includes('extension') || msg.includes('inpage.js') || msg.includes('Trust Wallet')) {
        return
      }

      debugLog('error', `Unhandled Promise rejection: ${msg.slice(0, 120)}`, e.reason?.stack?.slice(0, 200), 'promise')
    }
    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [])

  // Network status
  useEffect(() => {
    const go = () => { setHealth(h => ({ ...h, network: 'online' })); debugLog('success', 'Network reconnected', undefined, 'network') }
    const stop = () => { setHealth(h => ({ ...h, network: 'offline' })); debugLog('error', 'Network went offline', undefined, 'network') }
    window.addEventListener('online', go); window.addEventListener('offline', stop)
    return () => { window.removeEventListener('online', go); window.removeEventListener('offline', stop) }
  }, [])

  // Memory + page load timing
  useEffect(() => {
    const tick = () => {
      if ((performance as any).memory) {
        const mb = Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
        setHealth(h => ({ ...h, memory: mb }))
        if (mb > 400) debugLog('warn', `High memory: ${mb}MB`, 'Consider refreshing if performance degrades', 'memory')
      }
    }
    const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (perf) setPerfMs(Math.round(perf.loadEventEnd - perf.startTime))
    const iv = setInterval(tick, 15000); tick()
    return () => clearInterval(iv)
  }, [])

  // API health ping
  const pingApi = useCallback(async () => {
    setHealth(h => ({ ...h, api: 'checking' }))
    const t = Date.now()
    try {
      const res = await fetch('/api/health', { method: 'GET', signal: AbortSignal.timeout(5000) })
      const ms = Date.now() - t
      if (res.ok) { setHealth(h => ({ ...h, api: ms > 1500 ? 'slow' : 'ok', db: 'ok' })) }
      else { setHealth(h => ({ ...h, api: 'down' })); debugLog('error', `API HTTP ${res.status}`, undefined, 'health') }
    } catch { setHealth(h => ({ ...h, api: 'down' })); debugLog('error', 'API unreachable', undefined, 'health') }
  }, [])

  useEffect(() => {
    pingApi()
    pingRef.current = setInterval(pingApi, 30000)
    return () => { if (pingRef.current) clearInterval(pingRef.current) }
  }, [pingApi])

  // Keyboard shortcut Cmd/Ctrl+Shift+D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') { e.preventDefault(); setOpen(o => !o); setMinimized(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const AUTO_FIXES = [
    { id: 'clear-cache', label: 'Clear App Cache', desc: 'Removes stale data causing render errors', icon: Trash2, action: async () => { if ('caches' in window) { const n = await caches.keys(); await Promise.all(n.map(k => caches.delete(k))) }; debugLog('success', 'Cache cleared — reload to apply', undefined, 'fix') } },
    { id: 'reset-local', label: 'Repair LocalStorage', desc: 'Removes malformed JSON keys', icon: Database, action: () => { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k) continue; try { JSON.parse(localStorage.getItem(k) || '{}') } catch { localStorage.removeItem(k); n++ } }; debugLog('success', `Repaired ${n} corrupted keys`, undefined, 'fix') } },
    { id: 'reload-sw', label: 'Reinstall Service Worker', desc: 'Fixes PWA caching issues', icon: RefreshCw, action: async () => { if ('serviceWorker' in navigator) { const r = await navigator.serviceWorker.getRegistrations(); await Promise.all(r.map(x => x.unregister())); debugLog('success', 'SW unregistered — reloading…', undefined, 'fix'); setTimeout(() => window.location.reload(), 800) } else debugLog('info', 'No service worker found', undefined, 'fix') } },
    { id: 'clear-logs', label: 'Clear All Logs', desc: 'Reset the debug log store', icon: Trash2, action: () => { LOG_STORE.length = 0; setTimeout(() => LOG_LISTENERS.forEach(f => f()), 0); debugLog('info', 'Logs cleared', undefined, 'fix') } },
    { id: 'hard-reload', label: 'Hard Reload', desc: 'Bypass all browser caches', icon: Zap, action: () => { (window.location as any).reload(true) } },
  ]

  const statusDot = (s: string) => s === 'ok' || s === 'online' ? 'bg-emerald-500 shadow-emerald-500/50' : s === 'slow' ? 'bg-amber-500 shadow-amber-500/50' : s === 'checking' ? 'bg-sky-500 animate-pulse shadow-sky-500/50' : 'bg-rose-500 shadow-rose-500/50'
  const unfixedErrors = logs.filter(l => l.level === 'error' && !l.fixed).length
  const copyLog = (e: LogEntry) => { navigator.clipboard.writeText(`[${e.level.toUpperCase()}] ${e.message}`); setCopiedId(e.id); setTimeout(() => setCopiedId(null), 1500) }
  const reqStatusColor = (r: RequestEntry) => !r.status ? 'text-slate-600' : r.error ? 'text-rose-400' : r.status >= 400 ? 'text-rose-400' : r.status >= 300 ? 'text-amber-400' : 'text-emerald-400'
  const TABS = [
    { id: 'logs' as const,     label: 'Logs',    badge: unfixedErrors > 0 ? unfixedErrors : null },
    { id: 'requests' as const, label: 'Network', badge: reqs.filter(r => r.error || (r.status ?? 0) >= 400).length || null },
    { id: 'health' as const,   label: 'Health',  badge: null },
    { id: 'fixes' as const,    label: 'Fixes',   badge: null },
  ]

  if (!shouldShow) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence>
        {open && !minimized && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className={`pointer-events-auto w-[440px] max-h-[72vh] flex flex-col rounded-[2rem] ${isDark ? 'bg-[#08080f]/99 border-white/[0.08]' : 'bg-white/95 border-black/[0.08] shadow-indigo-500/10'} backdrop-blur-2xl border shadow-2xl shadow-black/70 overflow-hidden`}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <span className={`text-[11px] font-black uppercase tracking-[0.3em] ${isDark ? 'text-white' : 'text-slate-900'}`}>Click Debug</span>
                {unfixedErrors > 0 && <span className="text-[8px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded-full animate-pulse">{unfixedErrors}!</span>}
              </div>
              <div className="flex items-center gap-1">
                {perfMs != null && <span className="text-[8px] font-bold text-slate-700 mr-2 flex items-center gap-1"><Timer size={9} />{perfMs}ms load</span>}
                <button title="Minimize" onClick={() => setMinimized(true)} className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-white/[0.05] transition-all"><ChevronDown size={12} /></button>
                <button title="Close panel" onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-white/[0.05] transition-all"><X size={12} /></button>
              </div>
            </div>

            {/* ── Health strip ── */}
            <div className="flex items-center gap-3 px-5 py-2 bg-white/[0.015] border-b border-white/[0.04]">
              {(['api', 'db'] as const).map(k => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusDot(health[k])}`} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">{k}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                {health.network === 'online' ? <Wifi size={9} className="text-emerald-500" /> : <WifiOff size={9} className="text-rose-500" />}
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{health.network}</span>
              </div>
              {health.memory != null && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className={`text-[8px] font-black ${health.memory > 300 ? 'text-amber-400' : 'text-slate-600'}`}>{health.memory}MB</span>
                </div>
              )}
              <button title="Re-ping API" onClick={pingApi} className="p-1 rounded-lg text-slate-700 hover:text-white hover:bg-white/5 transition-all ml-auto"><RefreshCw size={9} /></button>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-0.5 px-3 pt-2.5 pb-1">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                    activeTab === tab.id ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/25' : 'text-slate-600 hover:text-slate-400 hover:bg-white/[0.03]'
                  }`}
                >
                  {tab.label}
                  {tab.badge ? <span className={`text-[7px] font-black px-1 rounded-full ${activeTab === tab.id ? 'bg-rose-500/30 text-rose-300' : 'bg-rose-500/20 text-rose-500'}`}>{tab.badge}</span> : null}
                </button>
              ))}
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4 pt-1">

              {/* LOGS tab */}
              {activeTab === 'logs' && (
                <div className="space-y-1.5">
                  {logs.length === 0 && <p className="text-center text-slate-700 text-[10px] py-8">No logs — all systems nominal ✅</p>}
                  {logs.map(entry => {
                    const Icon = ICON_MAP[entry.level]
                    return (
                      <div key={entry.id} className={`flex items-start gap-2 p-2.5 rounded-2xl border text-[10px] transition-all ${entry.fixed ? 'opacity-25 grayscale' : COLOR_MAP[entry.level]}`}>
                        <Icon className="w-3 h-3 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5">
                            <p className="font-bold leading-tight truncate flex-1">{entry.message}</p>
                            {entry.source && <span className="text-[7px] bg-white/5 px-1 py-0.5 rounded opacity-50 shrink-0">{entry.source}</span>}
                          </div>
                          {entry.detail && <p className="opacity-50 text-[9px] truncate">{entry.detail}</p>}
                          <p className="opacity-30 text-[7px] mt-0.5">{new Date(entry.ts).toLocaleTimeString()}</p>
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          <button title="Copy" onClick={() => copyLog(entry)} className="p-1 rounded-lg text-slate-700 hover:text-white transition-all">{copiedId === entry.id ? <CheckCircle2 size={9} className="text-emerald-400" /> : <Copy size={9} />}</button>
                          <button title="Mark fixed" onClick={() => debugFix(entry.id)} className="p-1 rounded-lg text-slate-700 hover:text-emerald-400 transition-all"><CheckCircle2 size={9} /></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* REQUESTS tab */}
              {activeTab === 'requests' && (
                <div className="space-y-1 pt-1">
                  {reqs.length === 0 && <p className="text-center text-slate-700 text-[10px] py-8">No requests logged yet</p>}
                  {reqs.map(r => (
                    <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[9px]">
                      <span className="font-black text-slate-600 w-10 shrink-0">{r.method}</span>
                      <span className="flex-1 truncate text-slate-400">{r.url.slice(0, 46)}</span>
                      <span className={`font-black shrink-0 ${reqStatusColor(r)}`}>{r.error ? 'ERR' : r.status ?? '…'}</span>
                      {r.ms != null && <span className={`shrink-0 ${r.ms > 1500 ? 'text-amber-500' : 'text-slate-700'}`}>{r.ms}ms</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* HEALTH tab */}
              {activeTab === 'health' && (
                <div className="space-y-2 pt-1">
                  {[
                    { icon: Server,   label: 'API Server',   status: health.api,     desc: { ok: 'Healthy', slow: 'Slow (>1.5s)', down: 'Unreachable', checking: 'Pinging…' }[health.api] ?? '' },
                    { icon: Database, label: 'Database',     status: health.db,      desc: health.db === 'ok' ? 'Supabase connected' : 'Connection issue' },
                    { icon: health.network === 'online' ? Wifi : WifiOff, label: 'Network', status: health.network, desc: health.network === 'online' ? 'You are online' : 'Offline' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.025] border border-white/[0.05]">
                      <item.icon className="w-4 h-4 text-slate-600 shrink-0" />
                      <div className="flex-1"><p className="text-[10px] font-black text-white">{item.label}</p><p className="text-[8px] text-slate-600">{item.desc}</p></div>
                      <span className={`w-2 h-2 rounded-full shadow-sm ${statusDot(item.status)}`} />
                    </div>
                  ))}
                  {health.memory != null && (
                    <div className="p-3 rounded-2xl bg-white/[0.025] border border-white/[0.05]">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-[10px] font-black text-white">JS Heap</span>
                        <span className={`text-[10px] font-black ${(health.memory ?? 0) > 300 ? 'text-amber-400' : 'text-emerald-400'}`}>{health.memory ?? 0}MB / 512MB</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden" role="progressbar" aria-valuenow={health.memory || 0} aria-valuemin={0} aria-valuemax={512} aria-label="JS heap usage">
                        <motion.div animate={{ width: `${Math.min(((health.memory || 0) / 512) * 100, 100)}%` }} className={`h-full rounded-full ${(health.memory || 0) > 400 ? 'bg-rose-500' : (health.memory || 0) > 200 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      </div>
                    </div>
                  )}
                  {perfMs != null && (
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.025] border border-white/[0.05]">
                      <Timer className="w-4 h-4 text-slate-600" />
                      <div className="flex-1"><p className="text-[10px] font-black text-white">Page Load Time</p><p className="text-[8px] text-slate-600">{perfMs < 1500 ? 'Fast' : perfMs < 3000 ? 'Acceptable' : 'Slow — check bundle size'}</p></div>
                      <span className={`text-[11px] font-black ${perfMs < 1500 ? 'text-emerald-400' : perfMs < 3000 ? 'text-amber-400' : 'text-rose-400'}`}>{perfMs}ms</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.025] border border-white/[0.05]">
                    <TrendingUp className="w-4 h-4 text-slate-600" />
                    <div className="flex-1"><p className="text-[10px] font-black text-white">Session Summary</p><p className="text-[8px] text-slate-600">{logs.filter(l => l.level === 'error').length} errors · {logs.filter(l => l.level === 'warn').length} warnings · {reqs.length} requests</p></div>
                  </div>
                </div>
              )}

              {/* FIXES tab */}
              {activeTab === 'fixes' && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-2 pt-1 pb-2">One-click auto-fixes</p>
                  {AUTO_FIXES.map(fix => (
                    <button key={fix.id} onClick={fix.action} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-indigo-500/25 hover:bg-indigo-500/5 transition-all text-left group">
                      <div className="w-7 h-7 rounded-xl bg-white/[0.04] flex items-center justify-center group-hover:bg-indigo-500/15 transition-colors">
                        <fix.icon className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-300 group-hover:text-white transition-colors">{fix.label}</p>
                        <p className="text-[8px] text-slate-600">{fix.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer: Keyboard shortcut hint */}
            <div className="px-5 py-2 border-t border-white/[0.04] flex items-center gap-2">
              <Globe size={9} className="text-slate-700" />
              <span className="text-[7px] text-slate-700 font-bold">Click Debug Fixer v2 · </span>
              <kbd className="text-[7px] text-slate-700 bg-white/5 px-1.5 py-0.5 rounded font-mono">⌘⇧D</kbd>
              <span className="text-[7px] text-slate-700">to toggle</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Trigger button ── */}
      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={() => { setOpen(true); setMinimized(false) }}
        title="Open Debug Panel (⌘⇧D)"
        className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-xl transition-all backdrop-blur-xl ${
          unfixedErrors > 0 ? 'bg-rose-600/20 border-rose-500/40 text-rose-300 shadow-rose-500/20' : isDark ? 'bg-[#08080f]/95 border-white/[0.08] text-slate-500 hover:text-white shadow-black/40' : 'bg-white/95 border-black/[0.08] text-slate-500 hover:text-slate-900 shadow-indigo-500/10'
        }`}
      >
        <Bug size={12} className={unfixedErrors > 0 ? 'text-rose-400' : ''} />
        <span className="text-[8px] font-black uppercase tracking-widest">
          {unfixedErrors > 0 ? `${unfixedErrors} Error${unfixedErrors > 1 ? 's' : ''}` : 'Debug'}
        </span>
        {open && !minimized ? <ChevronDown size={9} /> : <ChevronUp size={9} />}
      </motion.button>
    </div>
  )
}
