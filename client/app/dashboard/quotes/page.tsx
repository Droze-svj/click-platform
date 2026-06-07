'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { useRouter } from 'next/navigation'
import { apiPost } from '../../../lib/api'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useToast } from '../../../contexts/ToastContext'
import { useTranslation } from '../../../hooks/useTranslation'
import {
  Sparkles, Download, RefreshCw, Quote, ArrowUpRight, Image as ImageIcon,
} from 'lucide-react'
import { SwarmConsensusHUD } from '../../../components/editor/SwarmConsensusHUD'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  IconButton,
  FormField,
  Textarea,
  EmptyState,
  SectionHeader,
} from '../../../components/ui'

const QUOTE_STYLES = [
  { value: 'modern', label: 'modern' },
  { value: 'minimal', label: 'minimal' },
  { value: 'bold', label: 'bold' },
]

interface QuoteCard {
  imageUrl: string
  quote: string
  author: string
  style: string
}

function getImageUrl(path: string): string {
  if (!path || !path.startsWith('/')) return path
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || ''
  const base = apiUrl ? apiUrl.replace(/\/api\/?$/, '') : ''
  if (base) return `${base}${path}`
  // Use current page origin as fallback so this works in any deployment
  if (typeof window !== 'undefined') return `${window.location.origin}${path}`
  return path
}

export default function QuotesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()
  const { t } = useTranslation()

  useEffect(() => {
    if (!user) router.push('/login')
  }, [user, router])

  const [quoteText, setQuoteText] = useState('')
  const [style, setStyle] = useState('modern')
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<QuoteCard[]>([])
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')

  const handleGenerate = async () => {
    const text = quoteText.trim()
    if (!text) {
      showToast(t('quotesPage.toastDirectiveEmpty'), 'error')
      return
    }

    setLoading(true)
    setSwarmHUDTask(t('quotesPage.instantiatingMatrix'))
    setShowSwarmHUD(true)
    try {
      const res = await apiPost<{ quoteCards: QuoteCard[] }>('/quote/generate', {
        quoteText: text,
        style,
      })
      const list = res?.quoteCards || []
      setCards(list)
      showToast(list.length ? t('quotesPage.toastProposalsCollected', { count: list.length }) : t('quotesPage.toastSignalLost'), list.length ? 'success' : 'info')
    } catch (err: any) {
      showToast(t('quotesPage.toastFiscalOverload'), 'error')
      setCards([])
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (card: QuoteCard) => {
    const url = getImageUrl(card.imageUrl)
    const a = document.createElement('a')
    a.href = url
    a.download = `quote-${Date.now()}.png`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    showToast(t('quotesPage.toastDownloadingManifest'), 'success')
  }

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        <SwarmConsensusHUD
          isVisible={showSwarmHUD}
          taskName={swarmHUDTask}
          onComplete={() => setShowSwarmHUD(false)}
        />

        {/* Header (global DashboardHeader provides the breadcrumb) */}
        <SectionHeader
          as="h1"
          title={t('quotesPage.title')}
          description={t('quotesPage.subtitle')}
          className="mb-6"
        />

        {/* Generator */}
        <Panel variant="glass" className="max-w-3xl mx-auto space-y-6">
          <FormField label={t('quotesPage.directivePayloadLabel')} htmlFor="quote-input">
            <Textarea
              id="quote-input"
              value={quoteText}
              onChange={(e) => setQuoteText(e.target.value)}
              placeholder={t('quotesPage.directivePayloadPlaceholder')}
              rows={6}
              disabled={loading}
              title={t('quotesPage.directiveIngress')}
            />
          </FormField>

          <FormField label={t('quotesPage.fiscalResonanceBias')}>
            <div className="flex flex-wrap gap-2">
              {QUOTE_STYLES.map((s) => (
                <Button
                  key={s.value}
                  variant={style === s.value ? 'primary' : 'secondary'}
                  size="md"
                  onClick={() => setStyle(s.value)}
                  disabled={loading}
                >
                  {t(`quotesPage.polarity_${s.value}`)}
                </Button>
              ))}
            </div>
          </FormField>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleGenerate}
            loading={loading}
            disabled={loading || !quoteText.trim()}
            leftIcon={!loading ? <Sparkles size={18} aria-hidden /> : undefined}
          >
            {loading ? t('quotesPage.synthesizing') : t('quotesPage.instantiateProposal')}
          </Button>
        </Panel>

        {/* Results */}
        {cards.length > 0 && (
          <div className="mt-10">
            <SectionHeader
              as="h2"
              title={t('quotesPage.fiscalManifests')}
              description={t('quotesPage.fiscalManifestsSubtitle')}
              className="mb-6"
              actions={
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => { setQuoteText(''); setCards([]) }}
                  leftIcon={<RefreshCw size={16} aria-hidden />}
                >
                  {t('quotesPage.rebootFiscalForge')}
                </Button>
              }
            />

            <div className="ds-bento-grid">
              {cards.map((card, idx) => (
                <Panel key={idx} variant="bento" className="ds-bento-2x1 flex flex-col overflow-hidden p-0">
                  <div className="aspect-[4/5] relative overflow-hidden bg-accent">
                    <img
                      src={getImageUrl(card.imageUrl)}
                      alt={card.quote}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5 space-y-3 flex-1 flex flex-col">
                    <p className="ds-text-label text-primary">{t('quotesPage.econDirectiveAlpha')}</p>
                    <p className="ds-text-body text-theme-primary line-clamp-4">&ldquo;{card.quote}&rdquo;</p>
                    <p className="ds-text-caption pt-3 border-t border-[var(--border-subtle)] mt-auto">
                      {t('quotesPage.authId', { author: card.author || t('quotesPage.anonymousAgent') })}
                    </p>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="primary"
                        size="md"
                        className="flex-1"
                        onClick={() => handleDownload(card)}
                        leftIcon={<Download size={16} aria-hidden />}
                      >
                        {t('quotesPage.extractManifest')}
                      </Button>
                      <IconButton
                        variant="secondary"
                        size="md"
                        title={t('quotesPage.analyze')}
                        aria-label={t('quotesPage.analyze')}
                      >
                        <ArrowUpRight size={18} aria-hidden />
                      </IconButton>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          </div>
        )}

        {!cards.length && !loading && (
          <div className="mt-10">
            <EmptyState
              icon={Quote}
              title={t('quotesPage.fiscalVoid')}
              description={`${t('quotesPage.fiscalVoidLine1')} ${t('quotesPage.fiscalVoidLine2')}`}
              className="ds-surface-card"
            />
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
