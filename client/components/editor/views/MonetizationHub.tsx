'use client'

import React from 'react'
import { m, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart,
  ExternalLink,
  TrendingUp,
  DollarSign,
  Package,
  Sparkles,
  RefreshCw,
  ShoppingBag,
  Store,
  QrCode,
  Download,
} from 'lucide-react'
import { apiGet, apiPost, apiPatch, handleApiError } from '../../../lib/api'
import { useTranslation } from '../../../hooks/useTranslation'

interface Product {
  id: string;
  name: string;
  price: number | string;
  currency: string;
  checkout_url: string;
  image?: string;
}

interface MonetizationHubProps {
  contentId: string;
  initialProducts: Product[];
  transcript?: string;
  onClose: () => void;
  onPlanGenerated?: (plan: any) => void;
}

type Provider = 'whop' | 'shopify';

const unwrap = (res: any) => (res && typeof res === 'object' && 'data' in res ? res.data : res)

/**
 * Products from the creator's connected store (GET /api/monetization/products)
 * plus an AI plan of moments in this video to show them
 * (POST /api/video/advanced/monetization-plan).
 *
 * Removed: a hard-coded "$42,892.12 ad-assisted revenue / 4.2% conversion /
 * +12% vs last 7d" card, a fake "bridge health" panel (42ms latency, webhooks
 * "Active"), a canned "optimization alert", and "Get QR" / "View SKU" buttons
 * with no handlers. "View" now opens the product's real checkout link.
 */
const MonetizationHub: React.FC<MonetizationHubProps> = ({ contentId, initialProducts, transcript, onClose, onPlanGenerated }) => {
  const { t } = useTranslation()
  const [provider, setProvider] = React.useState<Provider>('whop')
  const [products, setProducts] = React.useState<Product[]>(initialProducts)
  // QR code for a product link (GET /api/monetization/qr), shown under the card.
  const [qr, setQr] = React.useState<{ id: string; dataUrl: string } | null>(null)
  const [qrLoadingId, setQrLoadingId] = React.useState<string | null>(null)
  const showQr = async (product: Product) => {
    if (qr?.id === product.id) { setQr(null); return }
    setQrLoadingId(product.id); setError(null)
    try {
      const data = unwrap(await apiGet<any>(`/monetization/qr?url=${encodeURIComponent(product.checkout_url || '')}`))
      if (data?.dataUrl) setQr({ id: product.id, dataUrl: data.dataUrl })
      else setError(t('monetizationHub.qrFailed'))
    } catch {
      setError(t('monetizationHub.qrFailed'))
    } finally {
      setQrLoadingId(null)
    }
  }
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [productsLoadFailed, setProductsLoadFailed] = React.useState(false)
  const [currentPlan, setCurrentPlan] = React.useState<any>(null)

  // Fetch existing plan on mount (404 = no plan yet, which is normal).
  React.useEffect(() => {
    let cancelled = false
    const fetchExistingPlan = async () => {
      try {
        const plan = unwrap(await apiGet<any>(`/monetization/plan/content/${encodeURIComponent(contentId)}`))
        if (!cancelled && plan && typeof plan === 'object' && Array.isArray(plan.triggers)) {
          setCurrentPlan(plan)
          if (plan.provider === 'whop' || plan.provider === 'shopify') setProvider(plan.provider)
        }
      } catch {
        /* no saved plan for this video yet */
      }
    }
    if (contentId) fetchExistingPlan()
    return () => { cancelled = true }
  }, [contentId])

  // Fetch products when provider changes. The route answers
  // { data: { products, provider } } — storing `data` itself as the list (as
  // this used to) put an object where an array was expected.
  React.useEffect(() => {
    let cancelled = false
    const fetchProducts = async () => {
      setIsLoadingProducts(true)
      setProductsLoadFailed(false)
      try {
        const data = unwrap(await apiGet<any>(`/monetization/products?provider=${provider}`))
        const list = Array.isArray(data) ? data : Array.isArray(data?.products) ? data.products : []
        if (!cancelled) setProducts(list)
      } catch (err) {
        if (!cancelled) {
          setProducts([])
          setProductsLoadFailed(true)
        }
      } finally {
        if (!cancelled) setIsLoadingProducts(false)
      }
    }
    fetchProducts()
    return () => { cancelled = true }
  }, [provider])

  const handleGeneratePlan = async () => {
    if (!transcript) {
      setError(t('monetizationHub.needsTranscript'))
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const plan = unwrap(await apiPost<any>('/video/advanced/monetization-plan', {
        transcript,
        videoId: contentId,
        provider,
      }))
      if (plan && typeof plan === 'object') {
        setCurrentPlan(plan)
      } else {
        setError(t('monetizationHub.planFailed'))
      }
    } catch (err) {
      setError(handleApiError(err) || t('monetizationHub.planFailed'))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUpdateTrigger = async (triggerIndex: number, startTime: number) => {
    if (!currentPlan?._id || !Number.isFinite(startTime) || startTime < 0) return

    setIsSaving(true)
    try {
      const updatedTriggers = [...currentPlan.triggers]
      updatedTriggers[triggerIndex] = { ...updatedTriggers[triggerIndex], startTime }
      const plan = unwrap(await apiPatch<any>(`/monetization/plan/${currentPlan._id}`, { triggers: updatedTriggers }))
      if (plan && typeof plan === 'object') setCurrentPlan(plan)
    } catch (err) {
      setError(handleApiError(err) || t('monetizationHub.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleFinalizePlan = async () => {
    if (!currentPlan?._id) return

    setIsSaving(true)
    try {
      const plan = unwrap(await apiPost<any>(`/monetization/plan/${currentPlan._id}/finalize`, {}))
      if (plan && typeof plan === 'object') {
        setCurrentPlan(plan)
        if (onPlanGenerated) onPlanGenerated(plan)
      }
    } catch (err) {
      setError(handleApiError(err) || t('monetizationHub.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  const providerStyles = {
    whop: {
      color: 'text-emerald-400',
      bg: 'bg-emerald-500',
      shadow: 'shadow-[0_10px_20px_rgba(16,185,129,0.2)]',
    },
    shopify: {
      color: 'text-indigo-400',
      bg: 'bg-indigo-500',
      shadow: 'shadow-[0_10px_20px_rgba(99,102,241,0.2)]',
    }
  }

  const activeStyle = providerStyles[provider]
  const triggers: any[] = Array.isArray(currentPlan?.triggers) ? currentPlan.triggers : []
  const showTriggers = triggers.length > 0
  const isFinalized = currentPlan?.status === 'finalized'

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col gap-8 h-full"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-2">
        <div>
          <div className="flex flex-wrap items-center gap-4">
             <h2 className={`text-2xl font-bold ${activeStyle.color} flex items-center gap-3`}>
                {provider === 'whop' ? <ShoppingCart className="w-6 h-6" /> : <ShoppingBag className="w-6 h-6" />}
                {t('monetizationHub.title')}
             </h2>
             <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setProvider('whop')}
                  className={`px-4 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${provider === 'whop' ? 'bg-emerald-500 text-black' : 'text-slate-500 hover:text-white'}`}
                >
                  Whop
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('shopify')}
                  className={`px-4 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${provider === 'shopify' ? 'bg-indigo-500 text-black' : 'text-slate-500 hover:text-white'}`}
                >
                  Shopify
                </button>
             </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {t('monetizationHub.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-500 hover:text-white transition-colors"
        >
          {t('monetizationHub.close')}
        </button>
      </div>

      <div className="bg-white/[0.02] border border-white/5 rounded-[3rem] p-8 flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
             <h3 className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
               <Store className="w-4 h-4 text-violet-400" aria-hidden />
               {showTriggers
                 ? t('monetizationHub.planHeading')
                 : provider === 'whop' ? t('monetizationHub.whopProducts') : t('monetizationHub.shopifyProducts')}
             </h3>
             <div className="flex flex-wrap items-center gap-4">
                {(error || productsLoadFailed) && (
                  <span className="text-xs text-rose-500 font-medium" role="alert">{error || t('monetizationHub.loadFailed')}</span>
                )}
                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={isGenerating || !transcript}
                  title={!transcript ? t('monetizationHub.needsTranscript') : undefined}
                  className={`px-6 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50 ${
                    isGenerating
                      ? 'bg-white/5 text-slate-500 cursor-wait'
                      : `${activeStyle.bg} text-black hover:bg-white ${activeStyle.shadow}`
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" aria-hidden />
                      {t('monetizationHub.generating')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" aria-hidden />
                      {t('monetizationHub.generate')}
                    </>
                  )}
                </button>

                {currentPlan?._id && (
                  <m.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4"
                  >
                    <button
                      type="button"
                      onClick={handleFinalizePlan}
                      disabled={isSaving || isFinalized || !showTriggers}
                      className={`px-6 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-60 ${
                        isFinalized
                          ? 'bg-white/5 text-slate-500'
                          : 'bg-white text-black hover:bg-emerald-500 hover:text-white'
                      }`}
                    >
                      {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" aria-hidden /> : <Package className="w-3.5 h-3.5" aria-hidden />}
                      {isFinalized ? t('monetizationHub.planFinalized') : t('monetizationHub.finalize')}
                    </button>
                  </m.div>
                )}
             </div>
          </div>

         {currentPlan && !showTriggers && (
           <p className="mb-6 text-xs text-slate-400">{t('monetizationHub.noTriggers')}</p>
         )}

         {!showTriggers && !isLoadingProducts && products.length === 0 ? (
           <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
             <Store className="w-8 h-8 text-slate-600" aria-hidden />
             <p className="text-sm font-semibold text-[var(--text-main)]">{t('monetizationHub.noProductsTitle')}</p>
             <p className="max-w-sm text-xs text-slate-500">
               {provider === 'whop' ? t('monetizationHub.noProductsWhop') : t('monetizationHub.noProductsShopify')}
             </p>
           </div>
         ) : (
         <div className="grid grid-cols-1 gap-4 flex-1 overflow-y-auto custom-scrollbar pr-2 md:grid-cols-2">
            <AnimatePresence mode="wait">
              <m.div
                key={showTriggers ? 'plan' : provider}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="contents"
              >
                {showTriggers ? triggers.map((step: any, idx: number) => (
                  <m.div
                    key={idx}
                    whileHover={{ y: -5 }}
                    className="p-6 rounded-[2rem] bg-white/[0.04] border border-white/10 group transition-all space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                         <span className="text-xs font-bold text-white">#{idx + 1}</span>
                      </div>
                      {typeof step.intentScore === 'number' && Number.isFinite(step.intentScore) && (
                        <div className="text-right">
                           <div className="flex items-center gap-1 justify-end">
                              <TrendingUp className="w-3 h-3 text-emerald-400" aria-hidden />
                              <span className="text-[11px] font-semibold text-emerald-400">
                                {t('monetizationHub.buyingIntent', { score: Math.round(step.intentScore * 100) })}
                              </span>
                           </div>
                           <p className="text-[10px] text-slate-500 mt-1">{t('monetizationHub.aiEstimate')}</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-main)] mb-1 truncate">{step.productName}</h4>
                      {step.reason && <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">&quot;{step.reason}&quot;</p>}
                    </div>

                    <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                       <div className="flex-1">
                          <span className="text-[10px] font-semibold text-slate-500">{t('monetizationHub.showAt')}</span>
                          <div className="flex items-center gap-2 mt-1">
                             <input
                               type="number"
                               min={0}
                               value={step.startTime}
                               onChange={(e) => handleUpdateTrigger(idx, parseFloat(e.target.value))}
                               disabled={isFinalized}
                               title={t('monetizationHub.showAt')}
                               aria-label={t('monetizationHub.showAt')}
                               className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none focus:border-indigo-500"
                             />
                             <span className="text-[10px] text-slate-600">{t('monetizationHub.seconds')}</span>
                          </div>
                       </div>
                       {step.productPrice != null && (
                         <div className="text-right">
                            <span className="text-[10px] font-semibold text-slate-500">{t('monetizationHub.price')}</span>
                            <p className="text-sm font-bold text-white mt-1">{step.productCurrency || ''} {step.productPrice}</p>
                         </div>
                       )}
                    </div>
                  </m.div>
                )) : products.map((product) => (
                  <m.div
                    key={product.id}
                    whileHover={{ y: -5, backgroundColor: 'rgba(255,255,255,0.04)' }}
                    className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/10 group transition-all"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                         {provider === 'whop' ? <DollarSign className={`w-6 h-6 ${activeStyle.color}`} aria-hidden /> : <ShoppingBag className={`w-6 h-6 ${activeStyle.color}`} aria-hidden />}
                      </div>
                      {/^https?:\/\//i.test(product.checkout_url || '') && (
                        <a
                          href={product.checkout_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={t('monetizationHub.viewProduct')}
                          aria-label={t('monetizationHub.viewProduct')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[11px] font-semibold text-slate-400 hover:text-white transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                          {t('monetizationHub.view')}
                        </a>
                      )}
                      {/^https?:\/\//i.test(product.checkout_url || '') && (
                        <button
                          type="button"
                          onClick={() => showQr(product)}
                          disabled={qrLoadingId === product.id}
                          aria-pressed={qr?.id === product.id}
                          title={t('monetizationHub.qrTitle')}
                          className="ml-2 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[11px] font-semibold text-slate-400 hover:text-white transition-all disabled:opacity-50"
                        >
                          <QrCode className="w-3.5 h-3.5" aria-hidden />
                          {t('monetizationHub.qr')}
                        </button>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-[var(--text-main)] mb-1 truncate">{product.name}</h4>
                    <p className={`text-xs font-mono ${activeStyle.color}`}>
                      {String(product.currency || '').toUpperCase()} {product.price}
                    </p>
                    {qr?.id === product.id && (
                      <div className="mt-4 flex flex-col items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- data URL from our API */}
                        <img src={qr.dataUrl} alt={t('monetizationHub.qrAlt', { name: product.name })} className="w-40 h-40 rounded-xl bg-white p-2" />
                        <a href={qr.dataUrl} download={`${String(product.name || 'product').replace(/[^\w-]+/g, '-').slice(0, 40)}-qr.png`} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 hover:text-white">
                          <Download className="w-3.5 h-3.5" aria-hidden /> {t('monetizationHub.qrDownload')}
                        </a>
                      </div>
                    )}
                  </m.div>
                ))}
              </m.div>
            </AnimatePresence>
         </div>
         )}
      </div>
    </m.div>
  )
}

export default MonetizationHub
