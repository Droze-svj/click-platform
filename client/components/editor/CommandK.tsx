
import React, { useState, useEffect, useRef } from 'react'
import { Search, Command, Zap, Video, Cpu, Palette, Sliders, Type, Download, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface CommandKProps {
    isOpen: boolean
    onClose: () => void
    onExecute: (actionId: string) => void
}

const COMMANDS = [
    { id: 'ai-edit', label: 'Start AI Semantic Edit', icon: Cpu, category: 'AI', shortcut: 'A' },
    { id: 'transcribe', label: 'Analyze Audio & transcribe', icon: Zap, category: 'AI', shortcut: 'T' },
    { id: 'color', label: 'Apply Cinema Grade', icon: Palette, category: 'Visuals', shortcut: 'C' },
    { id: 'text', label: 'Add Motion Title', icon: Type, category: 'Visuals', shortcut: 'M' },
    { id: 'export', label: 'Initialize 4K Render', icon: Download, category: 'Production', shortcut: 'E' },
]

const CommandK: React.FC<CommandKProps> = ({ isOpen, onClose, onExecute }) => {
    const [query, setQuery] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 10)
            setQuery('')
            setSelectedIndex(0)
        }
    }, [isOpen])

    const filteredCommands = COMMANDS.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.category.toLowerCase().includes(query.toLowerCase())
    )

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredCommands.length))
            e.preventDefault()
        } else if (e.key === 'ArrowUp') {
            setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length))
            e.preventDefault()
        } else if (e.key === 'Enter') {
            if (filteredCommands[selectedIndex]) {
                onExecute(filteredCommands[selectedIndex].id)
                onClose()
            }
        } else if (e.key === 'Escape') {
            onClose()
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="w-full max-w-2xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden"
                    >
                        <div className="p-4 flex items-center gap-4 border-b border-white/5">
                            <Search className="w-5 h-5 text-gray-500" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Type a command or search..."
                                className="flex-1 bg-transparent border-none text-white text-lg focus:ring-0 placeholder:text-gray-600 font-medium"
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value)
                                    setSelectedIndex(0)
                                }}
                                onKeyDown={handleKeyDown}
                            />
                            <div className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded-lg border border-white/10">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ESC</span>
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto p-2 custom-scrollbar">
                            {filteredCommands.length > 0 ? (
                                <div className="space-y-1">
                                    {filteredCommands.map((cmd, idx) => (
                                        <button
                                            key={cmd.id}
                                            onClick={() => { onExecute(cmd.id); onClose() }}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${selectedIndex === idx ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${selectedIndex === idx ? 'bg-white/20' : 'bg-gray-800'}`}>
                                                    <cmd.icon className="w-4 h-4" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-bold">{cmd.label}</p>
                                                    <p className={`text-[10px] uppercase font-black tracking-widest opacity-60 ${selectedIndex === idx ? 'text-white' : 'text-gray-500'}`}>{cmd.category}</p>
                                                </div>
                                            </div>
                                            <kbd className={`px-2 py-1 rounded border text-[10px] font-black ${selectedIndex === idx ? 'bg-white/20 border-white/20 text-white' : 'bg-gray-800 border-white/5 text-gray-500'}`}>
                                                {cmd.shortcut}
                                            </kbd>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center">
                                    <p className="text-gray-500 text-sm font-medium italic">No commands found for "{query}"</p>
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-black/40 border-t border-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-[2px] text-gray-500">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5"><Sliders className="w-3 h-3" /> Select</div>
                                <div className="flex items-center gap-1.5"><Command className="w-3 h-3" /> Execute</div>
                            </div>
                            <div className="opacity-40">Click V3 Neural Interface</div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

export default CommandK
