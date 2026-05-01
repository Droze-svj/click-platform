'use client';

import React from 'react';
import BrandKit from '../../../components/BrandKit';
import { motion } from 'framer-motion';
import { Orbit, Shield, Sparkles } from 'lucide-react';
import SectionHeader from '../../../components/dashboard/SectionHeader';

export default function BrandKitPage() {
  return (
    <div className="min-h-screen p-8 lg:p-12 relative overflow-hidden bg-[#020205]">
      {/* Background decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[50%] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <SectionHeader
          tone="studio"
          icon={Orbit}
          kicker="Studio · Brand Kit"
          title="Brand Kit"
          subtitle="Your colors, fonts, logos and voice — saved once and applied everywhere Click generates content. Set it up here and every caption, thumbnail and short stays on-brand automatically."
          badges={
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--tint-emerald-bg)] border border-[var(--tint-emerald-edge)] text-[10px] font-bold text-[var(--tint-emerald-fg)] uppercase tracking-widest">
                <Shield className="w-3 h-3" />
                Encrypted
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--tint-indigo-bg)] border border-[var(--tint-indigo-edge)] text-[10px] font-bold text-[var(--tint-indigo-fg)] uppercase tracking-widest">
                <Sparkles className="w-3 h-3" />
                Multi-profile
              </span>
            </>
          }
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <BrandKit
            onApply={(kit) => {
              console.log('Brand applied globally:', kit.primaryColor);
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
