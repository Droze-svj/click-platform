'use client';

import React from 'react';
import BrandKit from '../../../components/BrandKit';
import { motion } from 'framer-motion';
import { Orbit, Shield, Sparkles } from 'lucide-react';

export default function BrandKitPage() {
  return (
    <div className="min-h-screen p-8 lg:p-12 relative overflow-hidden bg-[#020205]">
      {/* Background decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[50%] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-4"
          >
            <div className="p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30">
              <Orbit className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none mb-2">
                Identity DNA
              </h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Secure_Lattice</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Multi_Profile_v3</span>
                </div>
              </div>
            </div>
          </motion.div>
          <p className="text-slate-400 text-sm max-w-2xl font-medium leading-relaxed">
            Mange your brand's visual essence across the network. Synchronize colors, typography, logos, and AI-generated style profiles to ensure every piece of content remains perfectly aligned with your strategic identity.
          </p>
        </header>

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
