'use client'

import { useState, useEffect } from 'react'
import {
    Users,
    Heart,
    Share2,
    Copy,
    Play,
    Search,
    Filter,
    Flame,
    Award,
    Sparkles
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface PublicProject {
    id: string
    title: string
    author: string
    avatar: string
    previewUrl: string
    likes: number
    remixes: number
    tags: string[]
    level: 'Expert' | 'Intermediate' | 'Beginner'
}

export default function RemixHub({ onRemix }: { onRemix: (projectId: string) => void }) {
    const [searchQuery, setSearchQuery] = useState('')
    const { showToast } = useToast()

    const publicProjects: PublicProject[] = [
        {
            id: 'template-1',
            title: 'Neon Cyberpunk Hook',
            author: 'ViralCreator_99',
            avatar: '/avatars/1.jpg',
            previewUrl: '',
            likes: 1240,
            remixes: 450,
            tags: ['Cyberpunk', 'Hook', 'Gaming'],
            level: 'Expert'
        },
        {
            id: 'template-2',
            title: 'Minimalist Podcast Cut',
            author: 'AudioFlow',
            avatar: '/avatars/2.jpg',
            previewUrl: '',
            likes: 890,
            remixes: 120,
            tags: ['Podcast', 'Minimal', 'Interview'],
            level: 'Intermediate'
        },
        {
            id: 'template-3',
            title: 'Smooth B-Roll Sequence',
            author: 'CinemaMaster',
            avatar: '/avatars/3.jpg',
            previewUrl: '',
            likes: 3100,
            remixes: 1200,
            tags: ['Cinematic', 'B-Roll', 'Travel'],
            level: 'Expert'
        }
    ]

    const handleRemix = (project: PublicProject) => {
        showToast(`Cloning "${project.title}" into your workspace...`, 'success')
        onRemix(project.id)
    }

    return (
        <div className="h-full flex flex-col bg-white dark:bg-black overflow-hidden">
            {/* Header */}
            <div className="p-8 border-b border-gray-100 dark:border-gray-900 bg-gradient-to-r from-fuchsia-500/5 to-purple-500/5">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                            <Users className="w-8 h-8 text-fuchsia-500" />
                            Remix Hub
                        </h2>
                        <p className="text-sm text-gray-500 mt-1 font-medium italic">Discover and clone the community's most viral templates</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-fuchsia-500 text-white rounded-xl shadow-lg shadow-fuchsia-500/20">
                        <Flame className="w-4 h-4 fill-white" />
                        <span className="text-xs font-black uppercase tracking-widest">Trending Now</span>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search viral hooks, B-roll sequences..."
                        className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-fuchsia-500 outline-none transition-all text-sm font-bold"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {publicProjects.map(project => (
                        <div
                            key={project.id}
                            className="group relative bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-2xl hover:shadow-fuchsia-500/10 hover:-translate-y-1 transition-all duration-300"
                        >
                            {/* Preview Placeholder */}
                            <div className="aspect-video bg-gray-100 dark:bg-black flex items-center justify-center relative overflow-hidden">
                                <Play className="w-12 h-12 text-white/50 group-hover:text-fuchsia-500 transition-colors" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">{project.level}</span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <img src={project.avatar} alt={project.author} className="w-5 h-5 rounded-full border border-fuchsia-500/30" />
                                    <span className="text-[10px] font-bold text-gray-400 group-hover:text-fuchsia-500 transition-colors">@{project.author}</span>
                                </div>
                                <h4 className="font-black text-gray-900 dark:text-white mb-4 group-hover:translate-x-1 transition-transform">{project.title}</h4>

                                <div className="flex flex-wrap gap-1 mb-6">
                                    {project.tags.map(tag => (
                                        <span key={tag} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800/50 rounded text-[9px] font-black text-gray-500 uppercase tracking-tighter">#{tag}</span>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between border-t border-gray-50 dark:border-gray-800 pt-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5 text-gray-400">
                                            <Heart className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-bold">{project.likes}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-gray-400">
                                            <Copy className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-bold">{project.remixes}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemix(project)}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-fuchsia-500 dark:hover:bg-fuchsia-500 hover:text-white transition-all shadow-lg shadow-fuchsia-500/0 hover:shadow-fuchsia-500/20"
                                    >
                                        <Sparkles className="w-3 h-3" />
                                        Remix
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
