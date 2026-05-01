'use client'

import ComplianceDashboard from '../../../components/ComplianceDashboard'
import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'

export default function CompliancePage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="p-4 md:p-8"
    >
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-[var(--tint-indigo-bg)] border border-[var(--tint-indigo-edge)] text-[var(--tint-indigo-fg)]">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Compliance & Safety</h1>
            <p className="text-slate-400 font-medium">Protect your brand and ensure platform policy adherence</p>
          </div>
        </div>
      </div>

      <ComplianceDashboard />
    </motion.div>
  )
}
