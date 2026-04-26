'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Shield,
  Activity,
  Zap,
  Target,
  Globe,
  Radio
} from 'lucide-react'

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'

interface EnhancedCalendarProps {
  onDateSelect?: (date: Date) => void
}

export default function EnhancedCalendar({ onDateSelect }: EnhancedCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [hoveredDate, setHoveredDate] = useState<number | null>(null)

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i)

  const MONTH_NAMES = [
    'JAN_CYCLE', 'FEB_CYCLE', 'MAR_CYCLE', 'APR_CYCLE', 'MAY_CYCLE', 'JUN_CYCLE',
    'JUL_CYCLE', 'AUG_CYCLE', 'SEP_CYCLE', 'OCT_CYCLE', 'NOV_CYCLE', 'DEC_CYCLE'
  ]

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  return (
    <div className={`${glassStyle} rounded-[3rem] p-10 overflow-hidden relative group border-white/5 hover:border-indigo-500/30 transition-all`}>
      <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-300">
         <Radio size={120} className="text-white" />
      </div>

      <div className="flex items-center justify-between mb-10 relative z-10">
        <div className="flex items-center gap-4">
           <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-indigo-400" />
           </div>
           <div>
              <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mb-1 italic">Temporal Hub</h3>
              <p className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">
                {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
              </p>
           </div>
        </div>
        <div className="flex gap-4">
          <button onClick={prevMonth} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all border border-white/5">
            <ChevronLeft size={18} className="text-slate-400 hover:text-white" />
          </button>
          <button onClick={nextMonth} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all border border-white/5">
            <ChevronRight size={18} className="text-slate-400 hover:text-white" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-6 relative z-10">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest py-3 italic">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-3 relative z-10">
        {emptyDays.map((_, i) => (
          <div key={`empty-${i}`} className="h-14 opacity-0" />
        ))}
        {days.map((day) => {
          const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear()
          const isHovered = hoveredDate === day

          return (
            <motion.div
              key={day}
              onMouseEnter={() => setHoveredDate(day)}
              onMouseLeave={() => setHoveredDate(null)}
              onClick={() => onDateSelect?.(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
              className={`h-14 rounded-2xl flex items-center justify-center cursor-pointer transition-all relative border overflow-hidden ${
                isToday 
                  ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)]' 
                  : isHovered
                    ? 'bg-white/10 text-white border-white/20'
                    : 'bg-white/[0.01] text-slate-600 border-white/5 hover:border-white/10'
              }`}
            >
              <span className="text-[12px] font-black italic tabular-nums relative z-10">{day}</span>
              {isHovered && !isToday && (
                <motion.div layoutId="flare" className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent" />
              )}
              {isToday && (
                 <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-white animate-ping" />
              )}
            </motion.div>
          )
        })}
      </div>

      <div className="mt-10 pt-10 border-t border-white/5 flex items-center justify-between relative z-10">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
               <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest italic tracking-tighter">Active Sync</span>
            </div>
            <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
               <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest italic tracking-tighter">Synchronous</span>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <Activity size={12} className="text-indigo-500 animate-pulse" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Temporal Flux Normal</span>
         </div>
      </div>
    </div>
  )
}
