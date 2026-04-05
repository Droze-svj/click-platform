'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ShoppingCart, 
  ExternalLink, 
  QrCode, 
  TrendingUp, 
  DollarSign, 
  Package, 
  AlertCircle, 
  Sparkles, 
  RefreshCw,
  ShoppingBag,
  Store
} from 'lucide-react'

interface Product {
  id: string;
  name: string;
  price: number | string;
  currency: string;
  checkout_url: string;
  image?: string;
  activeCampaigns?: number;
}

interface MonetizationHubProps {
  contentId: string;
  initialProducts: Product[];
  transcript?: string;
  onClose: () => void;
  onPlanGenerated?: (plan: any) => void;
}

type Provider = 'whop' | 'shopify';

const MonetizationHub: React.FC<MonetizationHubProps> = ({ contentId, initialProducts, transcript, onClose, onPlanGenerated }) => {
  const [provider, setProvider] = React.useState<Provider>('whop')
  const [products, setProducts] = React.useState<Product[]>(initialProducts)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [currentPlan, setCurrentPlan] = React.useState<any>(null)

  // Fetch existing plan on mount
  React.useEffect(() => {
    const fetchExistingPlan = async () => {
      try {
        const response = await fetch(`/api/monetization/plan/content/${contentId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        const result = await response.json()
        if (result.success && result.data) {
          setCurrentPlan(result.data)
          if (result.data.provider) setProvider(result.data.provider)
        }
      } catch (err) {
        console.error('Failed to fetch existing monetization plan', err)
      }
    }
    if (contentId) fetchExistingPlan()
  }, [contentId])

  // Fetch products when provider changes
  React.useEffect(() => {
    const fetchProducts = async () => {
      setIsLoadingProducts(true)
      setError(null)
      try {
        const response = await fetch(`/api/video/advanced/monetization/products?provider=${provider}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        const result = await response.json()
        if (result.success) {
          setProducts(result.data)
        } else {
          setError(result.message || 'Failed to fetch SKUs')
        }
      } catch (err) {
        setError('Connection to Monetization Bridge failed')
      } finally {
        setIsLoadingProducts(false)
      }
    }
    fetchProducts()
  }, [provider])

  const handleGeneratePlan = async () => {
    if (!transcript) {
      setError('No transcript available for analysis')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/video/advanced/monetization-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          transcript, 
          videoId: contentId, // Point to persistence
          provider 
        })
      })

      const result = await response.json()
      if (result.success) {
        setCurrentPlan(result.data)
      } else {
        setError(result.message || 'Failed to generate plan')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during plan generation')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUpdateTrigger = async (triggerIndex: number, startTime: number) => {
    if (!currentPlan?._id) return

    setIsSaving(true)
    try {
      const updatedTriggers = [...currentPlan.triggers]
      updatedTriggers[triggerIndex] = { ...updatedTriggers[triggerIndex], startTime }

      const response = await fetch(`/api/monetization/plan/${currentPlan._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ triggers: updatedTriggers })
      })

      const result = await response.json()
      if (result.success) {
        setCurrentPlan(result.data)
      }
    } catch (err) {
      console.error('Failed to update trigger', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleFinalizePlan = async () => {
    if (!currentPlan?._id) return

    setIsSaving(true)
    try {
       const response = await fetch(`/api/monetization/plan/${currentPlan._id}/finalize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      const result = await response.json()
      if (result.success) {
        setCurrentPlan(result.data)
        if (onPlanGenerated) onPlanGenerated(result.data)
      }
    } catch (err) {
      console.error('Failed to finalize plan', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleApplyToTimeline = () => {
    if (currentPlan && onPlanGenerated) {
      onPlanGenerated(currentPlan)
      onClose()
    }
  }

  const providerStyles = {
    whop: {
      color: 'text-emerald-400',
      bg: 'bg-emerald-500',
      border: 'border-emerald-500/20',
      shadow: 'shadow-[0_10px_20px_rgba(16,185,129,0.2)]',
      label: 'Whop Verified'
    },
    shopify: {
      color: 'text-indigo-400',
      bg: 'bg-indigo-500',
      border: 'border-indigo-500/20',
      shadow: 'shadow-[0_10px_20px_rgba(99,102,241,0.2)]',
      label: 'Shopify Secure'
    }
  }

  const activeStyle = providerStyles[provider]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col gap-8 h-full"
    >
      <div className="flex items-center justify-between px-2">
        <div>
          <div className="flex items-center gap-4">
             <h2 className={`text-2xl font-black uppercase tracking-[0.2em] italic ${activeStyle.color} flex items-center gap-4`}>
                {provider === 'whop' ? <ShoppingCart className="w-6 h-6" /> : <ShoppingBag className="w-6 h-6" />}
                Monetization Bridge
             </h2>
             <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 ml-4">
                <button 
                  onClick={() => setProvider('whop')}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${provider === 'whop' ? 'bg-emerald-500 text-black' : 'text-slate-500 hover:text-white'}`}
                >
                  Whop
                </button>
                <button 
                  onClick={() => setProvider('shopify')}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${provider === 'shopify' ? 'bg-indigo-500 text-black' : 'text-slate-500 hover:text-white'}`}
                >
                  Shopify
                </button>
             </div>
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">
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
        <div className="col-span-4 flex flex-col gap-6">
           <div className="bg-white/[0.02] border border-white/5 rounded-[3rem] p-8 flex flex-col justify-between h-56 group overflow-hidden relative">
              <div className={`absolute top-0 right-0 w-48 h-48 ${activeStyle.bg}/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2`} />
              <div className="relative z-10 flex justify-between items-start">
                 <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Total Ad-Assisted Revenue</span>
                    <span className="text-4xl font-black italic mt-2 text-white">$42,892.12</span>
                 </div>
                 <div className={`p-2 rounded-xl bg-white/5 border border-white/10 ${activeStyle.color}`}>
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
                       <motion.div initial={{ width: 0 }} animate={{ width: '42%' }} className={`h-full ${activeStyle.bg}`} />
                    </div>
                 </div>
                 <div className="text-right">
                    <span className={`text-[8px] font-black ${activeStyle.color} uppercase tracking-widest`}>+12% vs last 7d</span>
                 </div>
              </div>
           </div>

           <div className="bg-white/[0.02] border border-white/5 rounded-[3rem] p-8 flex-1 flex flex-col gap-6">
              <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                 <Store className="w-4 h-4 text-violet-400" />
                 Bridge Health Node
              </h3>

              <div className="space-y-4 flex-1">
                 {[
                   { label: 'Latency', value: '42ms' },
                   { label: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Webhooks`, value: 'Active' },
                   { label: 'Relay Engine', value: 'Hot' },
                 ].map((stat, i) => (
                   <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-mono text-white">{stat.value}</span>
                         <div className={`w-1 h-1 rounded-full ${activeStyle.bg} animate-pulse`} />
                      </div>
                   </div>
                 ))}
              </div>

              <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 flex gap-4">
                 <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0" />
                 <div>
                    <p className="text-[9px] font-black text-orange-400 uppercase">Optimization Alert</p>
                    <p className="text-[8px] text-slate-400 uppercase italic mt-1 leading-relaxed">AI suggests prioritizing {provider === 'whop' ? 'digital access' : 'physical variants'} for these segment types.</p>
                 </div>
              </div>
           </div>
        </div>

        <div className="col-span-8 bg-white/[0.02] border border-white/5 rounded-[3rem] p-8 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-[11px] font-black text-white uppercase tracking-widest">{provider === 'whop' ? 'Whop Storefront' : 'Shopify Catalog'} SKUs</h3>
               <div className="flex items-center gap-4">
                  {error && <span className="text-[10px] text-rose-500 font-black uppercase animate-pulse">{error}</span>}
                  <button
                    onClick={handleGeneratePlan}
                    disabled={isGenerating || !transcript}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                      isGenerating 
                        ? 'bg-white/5 text-slate-500 cursor-wait' 
                        : `${activeStyle.bg} text-black hover:bg-white ${activeStyle.shadow}`
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Analyzing Transcript...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        Generate AI Monetization Plan
                      </>
                    )}
                  </button>

                  {currentPlan && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-4"
                    >
                      <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${currentPlan.status === 'finalized' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${currentPlan.status === 'finalized' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                        <span className="text-[9px] font-black uppercase tracking-widest leading-none">
                          {currentPlan.status.toUpperCase()}
                        </span>
                      </div>

                      <button
                        onClick={handleFinalizePlan}
                        disabled={isSaving || currentPlan.status === 'finalized'}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                          currentPlan.status === 'finalized'
                            ? 'bg-white/5 text-slate-500'
                            : 'bg-white text-black hover:bg-emerald-500 hover:text-white'
                        }`}
                      >
                        {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                        {currentPlan.status === 'finalized' ? 'Plan Released' : 'Finalize Strategy'}
                      </button>
                    </motion.div>
                  )}

                  <div className={`flex items-center gap-2 px-3 py-1 ${activeStyle.bg}/10 border ${activeStyle.border} rounded-full`}>
                     <span className={`text-[8px] font-black ${activeStyle.color} uppercase`}>{activeStyle.label}</span>
                  </div>
               </div>
            </div>

           <div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={provider}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="contents"
                >
                  {currentPlan?.triggers?.map((step: any, idx: number) => (
                    <motion.div
                      key={idx}
                      whileHover={{ y: -5 }}
                      className="p-6 rounded-[2rem] bg-white/[0.04] border border-white/10 group transition-all space-y-4"
                    >
                      <div className="flex justify-between items-start">
                        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10`}>
                           <span className="text-[10px] font-black text-white italic">#{idx + 1}</span>
                        </div>
                        <div className="text-right">
                           <div className="flex items-center gap-1 justify-end">
                              <TrendingUp className="w-3 h-3 text-emerald-400" />
                              <span className="text-[9px] font-black text-emerald-400 uppercase">{(step.intentScore * 100).toFixed(0)}% Intent</span>
                           </div>
                           <p className="text-[8px] text-slate-500 uppercase tracking-widest mt-1">AI Recommendation</p>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[12px] font-black text-white uppercase tracking-wider mb-1 truncate">{step.productName}</h4>
                        <p className="text-[9px] text-slate-500 italic line-clamp-2 leading-relaxed">"{step.reason}"</p>
                      </div>

                      <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                         <div className="flex-1">
                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Trigger Time (s)</span>
                            <div className="flex items-center gap-2 mt-1">
                               <input 
                                 type="number" 
                                 value={step.startTime}
                                 onChange={(e) => handleUpdateTrigger(idx, parseFloat(e.target.value))}
                                 disabled={currentPlan.status === 'finalized'}
                                 title="Adjust Trigger Time (seconds)"
                                 aria-label="Adjust Trigger Time (seconds)"
                                 className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white font-mono outline-none focus:border-indigo-500"
                               />
                               <span className="text-[9px] text-slate-600">sec</span>
                            </div>
                         </div>
                         <div className="text-right">
                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Pricing</span>
                            <p className="text-[11px] font-black text-white mt-1">${step.productPrice}</p>
                         </div>
                      </div>
                    </motion.div>
                  )) || products.map((product) => (
                    <motion.div
                      key={product.id}
                      whileHover={{ y: -5, backgroundColor: 'rgba(255,255,255,0.04)' }}
                      className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/10 group cursor-pointer transition-all"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:${activeStyle.bg} transition-colors`}>
                           {provider === 'whop' ? <DollarSign className={`w-6 h-6 ${activeStyle.color} group-hover:text-white transition-colors`} /> : <ShoppingBag className={`w-6 h-6 ${activeStyle.color} group-hover:text-white transition-colors`} />}
                        </div>
                        <div className="flex gap-2">
                           <button
                             title="View SKU"
                             aria-label="View SKU"
                             className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-all"
                           >
                              <ExternalLink className="w-3.5 h-3.5" />
                           </button>
                        </div>
                      </div>

                      <h4 className="text-[14px] font-black text-white uppercase tracking-wider mb-1 truncate">{product.name}</h4>
                      <p className={`text-[10px] font-mono ${activeStyle.color} flex items-center gap-1 mb-6`}>
                        {product.currency.toUpperCase()} ${product.price}
                        <span className="text-[8px] text-slate-600 uppercase ml-2">Per Interaction</span>
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
                </motion.div>
              </AnimatePresence>
           </div>
        </div>
      </div>
    </motion.div>
  )
}

export default MonetizationHub
