
import React, { useState } from 'react'
import { Sparkles, MessageSquare, Zap, Cpu, History, ChevronRight, X, Send } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface AiAssistantProps {
    isOpen: boolean
    onClose: () => void
}

const AiAssistant: React.FC<AiAssistantProps> = ({ isOpen, onClose }) => {
    const [messages, setMessages] = useState([
        { role: 'assistant', text: 'Ready to optimize your production. How should we proceed?' }
    ])
    const [inputValue, setInputValue] = useState('')

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.aside
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed top-0 right-0 h-full w-80 bg-black/95 border-l border-white/10 z-[60] flex flex-col shadow-2xl backdrop-blur-xl"
                >
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-fuchsia-500 rounded-lg shadow-lg shadow-fuchsia-500/20">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-xs font-black uppercase text-white tracking-[2px]">Neural Oracle</span>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    </div>

                    <div className="p-4 border-b border-white/5 space-y-3">
                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Active Background Neural Cycles</p>
                        <div className="space-y-2">
                            {[
                                { l: 'Scene Detection', p: 85, c: 'text-blue-500' },
                                { l: 'Voice Sync', p: 40, c: 'text-orange-500' }
                            ].map(item => (
                                <div key={item.l} className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">{item.l}</span>
                                        <span className="text-[10px] font-black text-white">{item.p}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className={`h-full bg-current ${item.c}`} style={{ width: `${item.p}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-xs font-medium leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-gray-300 border border-white/5'}`}>
                                    {m.text}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-black/40 border-t border-white/10">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Tell Click what to edit..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && inputValue.trim()) {
                                        setMessages(prev => [...prev, { role: 'user', text: inputValue }])
                                        setInputValue('')
                                        // Mock response logic
                                        setTimeout(() => setMessages(prev => [...prev, { role: 'assistant', text: 'Executing neural optimization based on your request.' }]), 600)
                                    }
                                }}
                            />
                            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:scale-105 transition-all">
                                <Send className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    )
}

export default AiAssistant
