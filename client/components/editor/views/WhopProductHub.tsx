'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, ExternalLink, QrCode, TrendingUp, DollarSign, Package, AlertCircle } from 'lucide-react'

interface WhopProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  checkout_url: string;
  activeCampaigns?: number;
}

interface WhopProductHubProps {
  products: WhopProduct[];
  onClose: () => void;
}

const WhopProductHub: React.FC<WhopProductHubProps> = ({ products, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col gap-8 h-full"
    >
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-[0.2em] italic text-emerald-400 flex items-center gap-4">
            <ShoppingCart className="w-6 h-6" />
            Whop Monetization Bridge
          </h2>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
            Active storefront SKUs integrated into the autonomous distribution relay
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
        >
          [ Close Bridge ]
        </button>
      </div>

      <div className="grid grid-cols-12 gap-8 flex-1 min-h-0">
        {/* Left: Financial HUD */}
        <div className="col-span-4 flex flex-col gap-6">
           <div className="bg-white/[0.02] border border-white/5 rounded-[3rem] p-8 flex flex-col justify-between h-56 group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10 flex justify-between items-start">
                 <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Total Ad-Assisted Revenue</span>
                    <span className="text-4xl font-black italic mt-2 text-white">$42,892.12</span>
                 </div>
                 <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                 </div>
              </div>

              <div className="relative z-10 flex items-center gap-4 border-t border-white/5 pt-6">
                 <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-[8px] font-black uppercase text-slate-500">
                       <span>Conversion Rate</span>
                       <span className="text-white">4.2%</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                       <motion.div initial={{ width: 0 }} animate={{ width: '42%' }} className="h-full bg-emerald-500" />
                    </div>
                 </div>
                 <div className="text-right">
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">+12% vs last 7d</span>
                 </div>
              </div>
           </div>

           <div className="bg-white/[0.02] border border-white/5 rounded-[3rem] p-8 flex-1 flex flex-col gap-6">
              <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                 <Package className="w-4 h-4 text-violet-400" />
                 Bridge Health Node
              </h3>

              <div className="space-y-4 flex-1">
                 {[
                   { label: 'API Latency', value: '42ms', status: 'optimal' },
                   { label: 'Checkout Webhooks', value: 'Active', status: 'optimal' },
                   { label: 'Dynamic QR Engine', value: 'Hot', status: 'optimal' },
                 ].map((stat, i) => (
                   <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-mono text-white">{stat.value}</span>
                         <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                   </div>
                 ))}
              </div>

              <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 flex gap-4">
                 <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0" />
                 <div>
                    <p className="text-[9px] font-black text-orange-400 uppercase">Optimization Alert</p>
                    <p className="text-[8px] text-slate-400 uppercase italic mt-1 leading-relaxed">Consider increasing checkout duration on high-velocity clips to increase conversion by ~14%.</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Right: Product Grid */}
        <div className="col-span-8 bg-white/[0.02] border border-white/5 rounded-[3rem] p-8 flex flex-col overflow-hidden">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Storefront SKUs</h3>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                 <span className="text-[8px] font-black text-emerald-400 uppercase">Whop Verified</span>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
              {products.map((product) => (
                <motion.div
                  key={product.id}
                  whileHover={{ y: -5, backgroundColor: 'rgba(255,255,255,0.04)' }}
                  className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/10 group cursor-pointer transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-white/10 group-hover:bg-emerald-500 transition-colors">
                       <DollarSign className="w-6 h-6 text-emerald-400 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex gap-2">
                       <button
                         title="View External Product"
                         aria-label="View External Product"
                         className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-all"
                       >
                          <ExternalLink className="w-3.5 h-3.5" />
                       </button>
                    </div>
                  </div>

                  <h4 className="text-[14px] font-black text-white uppercase tracking-wider mb-1 truncate">{product.name}</h4>
                  <p className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 mb-6">
                    {product.currency.toUpperCase()} ${product.price}
                    <span className="text-[8px] text-slate-600 uppercase ml-2">Per Checkout</span>
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                     <div className="flex flex-col">
                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Active Ads</span>
                        <span className="text-[11px] font-black text-white">{product.activeCampaigns || 0} Nodes</span>
                     </div>
                     <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[8px] font-black uppercase tracking-widest group-hover:bg-white group-hover:text-black transition-all">
                        <QrCode className="w-3 h-3" />
                        Get QR
                     </button>
                  </div>
                </motion.div>
              ))}
           </div>
        </div>
      </div>
    </motion.div>
  )
}

export default WhopProductHub
