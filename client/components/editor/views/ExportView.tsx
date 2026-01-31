
import React, { useState, useEffect } from 'react'
import { Download, Share2, Youtube, Instagram, Smartphone, Send, CheckCircle2, Loader2, Globe } from 'lucide-react'
import { apiGet } from '../../../lib/api'
import { motion, AnimatePresence } from 'framer-motion'

interface ExportViewProps {
    videoId: string
    videoUrl: string
    textOverlays: any[]
    videoFilters: any
    showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const ExportView: React.FC<ExportViewProps> = ({ videoId, videoUrl, textOverlays, videoFilters, showToast }) => {
    const [connectedAccounts, setConnectedAccounts] = useState<any>({})
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
    const [isPublishing, setIsPublishing] = useState(false)

    useEffect(() => {
        fetchConnectedAccounts()
    }, [])

    const fetchConnectedAccounts = async () => {
        try {
            setIsLoadingAccounts(true)
            const data = await apiGet<{ success?: boolean; accounts?: any }>('/oauth/accounts')
            if (data?.success && data.accounts) {
                setConnectedAccounts(data.accounts)
            }
        } catch (error) {
            console.error('Failed to fetch accounts', error)
        } finally {
            setIsLoadingAccounts(false)
        }
    }

    const togglePlatform = (platform: string) => {
        setSelectedPlatforms(prev =>
            prev.includes(platform)
                ? prev.filter(p => p !== platform)
                : [...prev, platform]
        )
    }

    const handlePublish = async () => {
        if (selectedPlatforms.length === 0) {
            showToast('Please select at least one platform', 'error')
            return
        }

        try {
            setIsPublishing(true)
            showToast(`Publishing to ${selectedPlatforms.length} platform(s)...`, 'info')

            // Mock publish call - in production this would trigger actual publishing
            await new Promise(resolve => setTimeout(resolve, 2000))

            showToast('Content published successfully!', 'success')
            setSelectedPlatforms([])
        } catch (error) {
            console.error('Publishing failed', error)
            showToast('Publishing failed', 'error')
        } finally {
            setIsPublishing(false)
        }
    }

    const PLATFORMS = [
        { id: 'tiktok', label: 'TikTok', icon: Smartphone, color: 'from-pink-500 to-rose-600', connected: !!connectedAccounts.tiktok },
        { id: 'youtube', label: 'YouTube Shorts', icon: Youtube, color: 'from-red-600 to-red-700', connected: !!connectedAccounts.youtube },
        { id: 'instagram', label: 'Instagram Reels', icon: Instagram, color: 'from-purple-500 to-pink-500', connected: !!connectedAccounts.instagram },
    ]

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-10 text-center relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" />
                <div className="w-20 h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-blue-600">
                    <Download className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black uppercase text-gray-900 dark:text-white mb-2 tracking-tight">Final Mastery</h3>
                <p className="text-sm text-gray-500 mb-8 italic">Render your production with Elite-tier variety engine optimization.</p>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    {[
                        { id: 'shorts', label: 'YT Shorts', icon: Youtube, color: 'text-red-500' },
                        { id: 'reels', label: 'IG Reels', icon: Instagram, color: 'text-pink-500' },
                        { id: 'tiktok', label: 'TikTok', icon: Smartphone, color: 'text-black dark:text-white' },
                        { id: 'master', label: '4K Master', icon: Share2, color: 'text-blue-500' }
                    ].map(p => (
                        <button key={p.id} className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl flex flex-col items-center gap-2 hover:border-blue-500 transition-all font-black text-[10px] uppercase">
                            <p.icon className={`w-5 h-5 ${p.color}`} />
                            {p.label}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => showToast('Export engine initialized', 'success')}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 hover:scale-[1.02] transition-all uppercase tracking-widest text-xs"
                >START PRODUCTION RENDER</button>
            </div>

            {/* Unified Distribution Sidebar */}
            <div className="bg-gradient-to-br from-emerald-500/5 to-blue-500/5 dark:from-emerald-500/10 dark:to-blue-500/10 rounded-3xl shadow-2xl border border-emerald-500/20 p-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tighter text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                            <Globe className="w-5 h-5" />
                            Unified Distribution Hub
                        </h3>
                        <p className="text-[10px] text-gray-500 font-medium mt-1">One-click publishing to all linked social accounts</p>
                    </div>
                    <div className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[8px] font-black uppercase tracking-widest">
                        {PLATFORMS.filter(p => p.connected).length}/{PLATFORMS.length} Connected
                    </div>
                </div>

                {isLoadingAccounts ? (
                    <div className="text-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-2" />
                        <p className="text-xs text-gray-500">Loading connected accounts...</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {PLATFORMS.map(platform => (
                                <button
                                    key={platform.id}
                                    onClick={() => platform.connected && togglePlatform(platform.id)}
                                    disabled={!platform.connected}
                                    className={`relative p-6 rounded-2xl border-2 transition-all ${!platform.connected
                                            ? 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800 opacity-50 cursor-not-allowed'
                                            : selectedPlatforms.includes(platform.id)
                                                ? 'bg-gradient-to-br ' + platform.color + ' border-transparent text-white shadow-lg'
                                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-emerald-500'
                                        }`}
                                >
                                    <div className="flex flex-col items-center gap-3">
                                        <platform.icon className={`w-6 h-6 ${selectedPlatforms.includes(platform.id) ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                                        <div className="text-center">
                                            <p className={`text-xs font-black uppercase ${selectedPlatforms.includes(platform.id) ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                                {platform.label}
                                            </p>
                                            <p className={`text-[8px] font-medium mt-1 ${selectedPlatforms.includes(platform.id) ? 'text-white/80' : 'text-gray-500'}`}>
                                                {platform.connected ? 'Ready' : 'Not Connected'}
                                            </p>
                                        </div>
                                    </div>
                                    {selectedPlatforms.includes(platform.id) && (
                                        <div className="absolute top-2 right-2">
                                            <CheckCircle2 className="w-4 h-4 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        <AnimatePresence>
                            {selectedPlatforms.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-emerald-500/20"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-black text-gray-900 dark:text-white mb-1">
                                                Ready to publish to {selectedPlatforms.length} platform{selectedPlatforms.length > 1 ? 's' : ''}
                                            </p>
                                            <p className="text-[10px] text-gray-500">
                                                {selectedPlatforms.map(p => PLATFORMS.find(pl => pl.id === p)?.label).join(', ')}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handlePublish}
                                            disabled={isPublishing}
                                            className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                        >
                                            {isPublishing ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    PUBLISHING...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-4 h-4" />
                                                    PUBLISH NOW
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {PLATFORMS.filter(p => !p.connected).length > 0 && (
                            <div className="mt-6 p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                                    <span className="font-black">Tip:</span> Connect more accounts in the Social Vault to unlock cross-platform distribution.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default ExportView
