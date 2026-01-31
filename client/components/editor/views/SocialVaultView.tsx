
import React, { useState, useEffect } from 'react'
import {
    Sparkles,
    Zap,
    Twitter,
    Video as TikTokIcon,
    Youtube,
    Instagram,
    Link as LinkIcon,
    X,
    RefreshCcw,
    CheckCircle2,
    AlertCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { api, apiGet } from '../../../lib/api'
import { EditorCategory } from '../../../types/editor'

interface SocialVaultViewProps {
    category: EditorCategory
    currentTime: number
    videoId: string
    setActiveCategory: (v: EditorCategory) => void
    showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const SocialVaultView: React.FC<SocialVaultViewProps> = ({
    category, currentTime, videoId, setActiveCategory, showToast
}) => {
    const [accounts, setAccounts] = useState<any>({
        twitter: null,
        tiktok: null,
        youtube: null,
        instagram: null
    })
    const [loading, setLoading] = useState(true)

    const fetchAccounts = async () => {
        try {
            setLoading(true)
            const data = await apiGet<{ success?: boolean; accounts?: any }>('/oauth/accounts')
            if (data?.success && data.accounts) {
                setAccounts(data.accounts)
            }
        } catch (error) {
            console.error('Failed to fetch accounts', error)
            showToast('Account sync failed', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAccounts()
    }, [])

    const handleConnect = async (platform: string) => {
        try {
            showToast(`Initiating ${platform} link...`, 'info')
            const res = await api.get(`/oauth/${platform}/connect`)
            const data = res.data as { success?: boolean; auth_url?: string }
            if (data?.success && data.auth_url) {
                window.location.href = data.auth_url
            }
        } catch (error: any) {
            showToast(error.response?.data?.error || 'Connection failed', 'error')
        }
    }

    const handleDisconnect = async (platform: string, platformUserId: string) => {
        try {
            if (!confirm(`Disconnect ${platform}?`)) return
            const res = await api.delete(`/oauth/${platform}/disconnect`, {
                data: { platform_user_id: platformUserId }
            })
            const data = res.data as { success?: boolean }
            if (data?.success) {
                showToast(`${platform} disconnected`, 'success')
                fetchAccounts()
            }
        } catch (error) {
            showToast('Disconnect failed', 'error')
        }
    }

    const PLATFORMS = [
        { id: 'tiktok', label: 'TikTok', icon: TikTokIcon, color: 'from-pink-500 to-rose-600', desc: 'Short-form viral engine' },
        { id: 'youtube', label: 'YouTube', icon: Youtube, color: 'from-red-600 to-red-700', desc: 'Long-form & Shorts hub' },
        { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'from-purple-500 via-pink-500 to-orange-500', desc: 'Visual storytelling' },
        { id: 'twitter', label: 'Twitter / X', icon: Twitter, color: 'from-slate-800 to-slate-900', desc: 'Real-time narrative' }
    ]

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Social Ecosystem Manager</h3>
                    <p className="text-xs text-gray-500 font-medium italic">Link your creator accounts for Elite-tier distribution.</p>
                </div>
                <button
                    onClick={fetchAccounts}
                    disabled={loading}
                    className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-gray-400 hover:text-white group"
                >
                    <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PLATFORMS.map(platform => {
                    const account = accounts[platform.id]
                    const isConnected = !!account

                    return (
                        <motion.div
                            key={platform.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`relative p-6 rounded-3xl border transition-all duration-500 group overflow-hidden ${isConnected ? 'bg-white/5 border-white/20' : 'bg-black/40 border-white/5 grayscale opacity-60 hover:grayscale-0 hover:opacity-100'}`}
                        >
                            {/* Background Glow */}
                            <div className={`absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br ${platform.color} opacity-0 group-hover:opacity-10 blur-[80px] transition-opacity duration-700`} />

                            <div className="relative flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className={`p-4 rounded-2xl bg-gradient-to-br ${platform.color} shadow-lg shadow-black/40`}>
                                        <platform.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-lg font-black text-white">{platform.label}</h4>
                                            {isConnected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">{platform.desc}</p>

                                        {isConnected ? (
                                            <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/5 mb-4">
                                                <div className="w-8 h-8 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                                    {account.avatar ? <img src={account.avatar} className="w-full h-full object-cover" /> : <platform.icon className="w-4 h-4 text-white/40" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-white truncate">{account.display_name || account.username}</p>
                                                    <p className="text-[10px] text-gray-500 font-mono">@{account.username}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-gray-500 mb-6">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Not Connected</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isConnected ? (
                                    <button
                                        onClick={() => handleDisconnect(platform.id, account.platform_user_id)}
                                        className="p-2 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                                        title="Disconnect Account"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleConnect(platform.id)}
                                        className="px-4 py-2 bg-white text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
                                    >
                                        Initialize Link
                                    </button>
                                )}
                            </div>

                            {isConnected && (
                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="text-center">
                                            <p className="text-[8px] font-black text-gray-500 uppercase">Subscribers</p>
                                            <p className="text-xs font-black text-white">{account.metadata?.subscriber_count || account.metadata?.followers_count || 'Syncing...'}</p>
                                        </div>
                                        <div className="w-[1px] h-6 bg-white/5" />
                                        <div className="text-center">
                                            <p className="text-[8px] font-black text-gray-500 uppercase">Viral Score</p>
                                            <p className="text-xs font-black text-white">Elite</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => showToast(`${platform.label} details coming soon`, 'info')}
                                        className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                                    >
                                        <LinkIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )
                })}
            </div>

            <div className="mt-12 p-12 bg-blue-600/5 rounded-[40px] border border-blue-500/10 text-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                    <Sparkles className="w-32 h-32 text-blue-500" />
                </div>
                <Zap className="w-12 h-12 text-blue-500 mx-auto mb-6 animate-pulse" />
                <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">Unified Distribution Active</h3>
                <p className="text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">Your accounts are bridged to Click's Neural Distribution engine. One-click publishing to all connected platforms is enabled for confirmed render tasks.</p>
                <div className="mt-8 flex justify-center gap-4">
                    <button
                        onClick={() => setActiveCategory('export')}
                        className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[2px] shadow-2xl shadow-blue-500/20 hover:scale-105 transition-all"
                    >
                        Start Viral Production
                    </button>
                </div>
            </div>
        </div>
    )
}

export default SocialVaultView
