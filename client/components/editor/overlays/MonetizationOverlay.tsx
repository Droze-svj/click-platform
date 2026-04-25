"use client"

import React from 'react'
import { motion } from 'framer-motion'
import { QrCode, ShoppingCart, ArrowRight, DollarSign } from 'lucide-react'

interface MonetizationOverlayProps {
  id: string
  type: string
  text: string
  price?: number
  currency?: string
  qrUrl?: string
  checkoutUrl?: string
  style?: string
  position: { x: number; y: number }
}

export default function MonetizationOverlay({
  text,
  price,
  currency,
  qrUrl,
  style,
  position
}: MonetizationOverlayProps) {
  const isNeural = style === 'neural-glass'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className="absolute pointer-events-none"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <div className={`relative flex items-center gap-6 p-6 rounded-[2.5rem] border backdrop-blur-2xl transition-all duration-500 ${
        isNeural 
          ? 'bg-black/40 border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.6)]' 
          : 'bg-white/5 border-white/5'
      }`}>
        {/* Animated Background Glow */}
        {isNeural && (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-[2.5rem] -z-10 animate-pulse" />
        )}

        {/* QR Code Section */}
        {qrUrl && (
          <div className="relative group">
            <div className="p-2 bg-white rounded-3xl shadow-xl overflow-hidden">
              <img 
                src={qrUrl} 
                alt="Checkout QR" 
                className="w-24 h-24 object-contain"
              />
            </div>
            <div className="absolute -top-2 -right-2 p-2 bg-blue-600 rounded-full shadow-lg border-2 border-white/20">
              <QrCode className="w-4 h-4 text-white" />
            </div>
          </div>
        )}

        {/* Product Details */}
        <div className="flex flex-col gap-2 min-w-[140px]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
              <DollarSign className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">Verified SKU</span>
            </div>
          </div>
          
          <h4 className="text-lg font-black text-white leading-tight uppercase italic tracking-wider max-w-[200px]">
            {text}
          </h4>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Price Point</span>
              <span className="text-xl font-black text-white tracking-tighter">
                {currency === 'USD' ? '$' : ''}{price}{currency !== 'USD' ? ` ${currency}` : ''}
              </span>
            </div>
            
            <motion.div 
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="p-2 bg-white/10 rounded-xl"
            >
              <ArrowRight className="w-4 h-4 text-blue-400" />
            </motion.div>
          </div>
        </div>

        {/* Floating Tag */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-lg flex items-center gap-2 border border-white/20">
          <ShoppingCart className="w-3 h-3 text-white" />
          <span className="text-[8px] font-black text-white uppercase tracking-widest whitespace-nowrap">Instant Checkout</span>
        </div>
      </div>
    </motion.div>
  )
}
