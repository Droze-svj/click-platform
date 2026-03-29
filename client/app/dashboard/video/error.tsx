'use client'

import { useEffect } from 'react'
import { Video, RotateCcw, Home, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

export default function VideoError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Detect Chrome extension errors (like Trust Wallet) to avoid crashing the whole UI for non-app issues
    const isExtension = error.message?.toLowerCase().includes('extension') || 
                       error.stack?.includes('chrome-extension://') ||
                       error.message?.includes('inpage.js') ||
                       (error.message?.includes('toLowerCase') && error.stack?.includes('inpage.js'));

    if (isExtension) {
      console.warn('[Video Route] Ignoring extension error:', error.message);
      
      // If we've reset recently, maybe don't reset again immediately to avoid loops
      const now = Date.now();
      const lastReset = (window as any)._lastVideoErrorReset || 0;
      if (now - lastReset < 2000) {
        console.error('[Video Route] Persistent extension error detected, suppression active.');
        return;
      }
      (window as any)._lastVideoErrorReset = now;

      reset(); // Attempt immediate recovery for extension-induced crashes
      return;
    }

    console.error('[Video Route Error]', error.message)
    const isChunk = /chunk|loading/i.test(error.message)
    if (isChunk) {
      const retryCount = (window as any)._chunkRetryCount || 0;
      if (retryCount < 3) {
        (window as any)._chunkRetryCount = retryCount + 1;
        const t = setTimeout(reset, 4000);
        return () => clearTimeout(t);
      } else {
        console.error('[Video Route] Chunk error persists after 3 retries. Stopping auto-reload.');
      }
    }
  }, [error, reset])

  const isChunk = /chunk|loading/i.test(error.message)

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8 text-white">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full text-center bg-white/[0.02] border border-white/[0.06] rounded-[2.5rem] p-10">
        <div className="w-14 h-14 bg-violet-500/10 border border-violet-500/20 rounded-[1.25rem] flex items-center justify-center mx-auto mb-5">
          <Video className="w-7 h-7 text-violet-400" />
        </div>
        <h2 className="text-2xl font-black italic mb-3">Video Studio <span className="text-rose-400">Error</span></h2>
        <p className="text-slate-500 text-sm mb-7">{isChunk ? 'The video editor module failed to load. Clearing cache and retrying should fix this.' : 'An unexpected error occurred in the video studio.'}</p>
        <div className="flex gap-3">
          <button onClick={isChunk ? async () => { if ('caches' in window) { const n = await caches.keys(); await Promise.all(n.map(k => caches.delete(k))) }; reset() } : reset}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-violet-600/20 border border-violet-500/30 text-violet-300 font-black text-[10px] uppercase tracking-widest hover:bg-violet-600/30 transition-all">
            {isChunk ? <Trash2 className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
            {isChunk ? 'Clear & Retry' : 'Try Again'}
          </button>
          <a href="/dashboard" title="Go to Dashboard" className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-white/[0.08] transition-all">
            <Home className="w-3.5 h-3.5" />
          </a>
        </div>
      </motion.div>
    </div>
  )
}
