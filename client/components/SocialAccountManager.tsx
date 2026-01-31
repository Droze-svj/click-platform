'use client'

import { useState, useEffect } from 'react'
import {
    Link2,
    Unlink,
    Youtube,
    Instagram,
    Video,
    CheckCircle2,
    AlertCircle,
    ExternalLink,
    ShieldCheck,
    Zap
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface SocialAccount {
    id: string
    platform: 'tiktok' | 'youtube' | 'instagram'
    username: string
    status: 'active' | 'expired' | 'error'
    lastSync: string
}

export default function SocialAccountManager() {
    const { showToast } = useToast()
    const [accounts, setAccounts] = useState<SocialAccount[]>([
        { id: '1', platform: 'youtube', username: 'EliteCreator_HQ', status: 'active', lastSync: '2026-01-24' }
    ])

    const platforms = [
        { id: 'tiktok', name: 'TikTok', icon: Video, color: 'hover:bg-black hover:text-white border-black/10' },
        { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'hover:bg-red-600 hover:text-white border-red-600/10' },
        { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'hover:bg-gradient-to-tr hover:from-yellow-400 hover:via-red-500 hover:to-purple-600 hover:text-white border-purple-500/10' }
    ]

    const handleLink = (platformId: string) => {
        showToast(`Initiating OAuth secure handshake with ${platformId}...`, 'info')
        // Mock successful link
        setTimeout(() => {
            const newAcc: SocialAccount = {
                id: Math.random().toString(),
                platform: platformId as any,
                username: 'Creator_Master',
                status: 'active',
                lastSync: new Date().toISOString()
            }
            setAccounts(prev => [...prev, newAcc])
            showToast(`${platformId} account linked successfully!`, 'success')
        }, 2000)
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-500/20">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Social Vault</h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest opacity-60">Connected Account Intelligence</p>
                    </div>
                </div>
                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center gap-2 px-4 border border-emerald-500/20">
                    <Zap className="w-3 h-3 fill-emerald-500" />
                    <span className="text-[8px] font-black uppercase tracking-widest letter-spacing-2">Live Cloud Sync</span>
                </div>
            </div>

            {/* platform Selection */}
            <div className="grid grid-cols-3 gap-4 mb-10">
                {platforms.map(p => {
                    const isLinked = accounts.find(acc => acc.platform === p.id)
                    return (
                        <button
                            key={p.id}
                            onClick={() => !isLinked && handleLink(p.id)}
                            className={`p-6 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center gap-3 group ${isLinked ? 'bg-gray-50 dark:bg-gray-950 border-emerald-500/50 cursor-default' : `bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 ${p.color} hover:shadow-xl hover:-translate-y-1`}`}
                        >
                            <div className={`p-3 rounded-2xl transition-colors ${isLinked ? 'bg-emerald-500 text-white' : 'bg-gray-50 dark:bg-gray-800 group-hover:bg-transparent'}`}>
                                <p.icon className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-black uppercase mb-1">{p.name}</p>
                                {isLinked ? (
                                    <span className="text-[8px] font-bold text-emerald-500 flex items-center gap-1 justify-center">
                                        <CheckCircle2 className="w-2 h-2" /> LINKED
                                    </span>
                                ) : (
                                    <span className="text-[8px] font-bold text-gray-400 group-hover:text-inherit">NOT CONNECTED</span>
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Connected Accounts List */}
            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[3px] mb-6">Subscription Status</h3>
                {accounts.map(acc => (
                    <div key={acc.id} className="group relative bg-gray-50 dark:bg-gray-950 p-5 rounded-2xl border border-transparent hover:border-blue-500/30 transition-all flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-900 flex items-center justify-center border border-gray-100 dark:border-gray-800 shadow-sm">
                                {acc.platform === 'youtube' && <Youtube className="w-6 h-6 text-red-600" />}
                                {acc.platform === 'tiktok' && <Video className="w-6 h-6 text-black dark:text-white" />}
                                {acc.platform === 'instagram' && <Instagram className="w-6 h-6 text-purple-600" />}
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-gray-900 dark:text-white leading-none mb-2">{acc.username}</h4>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">API Refresh: {acc.lastSync}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-900 rounded-full border border-gray-100 dark:border-gray-800 shadow-sm">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Active</span>
                            </div>
                            <button className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all">
                                <Unlink className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 pt-8 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <p className="text-[10px] font-bold text-gray-500 italic">256-bit OAuth Encryption Active</p>
                </div>
                <button className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform">
                    View API Logs
                    <ExternalLink className="w-3 h-3" />
                </button>
            </div>
        </div>
    )
}
