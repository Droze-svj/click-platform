'use client'

import { useState, useEffect } from 'react'
import {
    Folder,
    FileVideo,
    Search,
    Grid,
    List as ListIcon,
    MoreVertical,
    ExternalLink,
    ChevronRight,
    Clock,
    Layout
} from 'lucide-react'
import { apiGet } from '../lib/api'

interface Project {
    _id: string
    name: string
    lastSaved: string
    videoId: string
    videoUrl?: string
    status: string
}

export default function ProjectBrowser({ onSelectProject }: { onSelectProject: (projectId: string) => void }) {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await apiGet('/projects')
                if (res.success) {
                    setProjects(res.data)
                }
            } catch (err) {
                console.error('Failed to load projects:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchProjects()
    }, [])

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-black p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Layout className="w-6 h-6 text-blue-500" />
                        Project Dashboard
                    </h2>
                    <p className="text-sm text-gray-500">Manage and organize your video creations</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                        />
                    </div>
                    <div className="flex bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1 shadow-sm">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-400'}`}
                        >
                            <Grid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-400'}`}
                        >
                            <ListIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-48 bg-gray-100 dark:bg-gray-900 animate-pulse rounded-2xl"></div>
                        ))}
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500 italic bg-white dark:bg-gray-900/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                        <Folder className="w-12 h-12 mb-4 opacity-20" />
                        <p>No projects found. Create your first video to see it here!</p>
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6" : "space-y-3"}>
                        {filteredProjects.map(project => (
                            <div
                                key={project._id}
                                onClick={() => onSelectProject(project._id)}
                                className={`group relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl transition-all hover:shadow-xl hover:border-blue-500/30 cursor-pointer overflow-hidden ${viewMode === 'list' ? 'flex items-center p-4 gap-6' : 'p-0 flex flex-col'
                                    }`}
                            >
                                {/* Preview Thumbnail */}
                                <div className={`${viewMode === 'list' ? 'w-24 h-16' : 'aspect-video w-full'} bg-slate-100 dark:bg-gray-850 relative flex items-center justify-center overflow-hidden`}>
                                    {project.videoUrl ? (
                                        <video src={project.videoUrl} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" />
                                    ) : (
                                        <FileVideo className="w-10 h-10 text-gray-300" />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute bottom-2 right-2 p-1.5 bg-blue-600 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </div>
                                </div>

                                <div className={`p-4 ${viewMode === 'list' ? 'flex-1 flex items-center justify-between p-0' : ''}`}>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white truncate mb-1 group-hover:text-blue-500 transition-colors">{project.name}</h3>
                                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                            <Clock className="w-3 h-3" />
                                            <span>{new Date(project.lastSaved).toLocaleDateString()}</span>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                            <span className="uppercase">{project.status}</span>
                                        </div>
                                    </div>
                                    {viewMode === 'grid' && (
                                        <div className="mt-4 flex items-center justify-between pt-3 border-t border-gray-50 dark:border-gray-800/50">
                                            <span className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded cursor-default uppercase tracking-widest">Project</span>
                                            <MoreVertical className="w-4 h-4 text-gray-400 hover:text-gray-900 dark:hover:text-white" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
