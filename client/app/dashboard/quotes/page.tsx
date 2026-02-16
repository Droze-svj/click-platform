'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { useRouter } from 'next/navigation'
import { apiPost } from '../../../lib/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { useToast } from '../../../contexts/ToastContext'
import { Sparkles, Download, RefreshCw } from 'lucide-react'

const STYLES = [
  { value: 'modern', label: 'Modern' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'bold', label: 'Bold' }
]

function getImageUrl(path: string): string {
  if (!path || !path.startsWith('/')) return path
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || ''
  const base = apiUrl ? apiUrl.replace(/\/api\/?$/, '') : ''
  if (base) return `${base}${path}`
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5001${path}`
  }
  return `http://localhost:5001${path}`
}

interface QuoteCard {
  imageUrl: string
  quote: string
  author: string
  style: string
}

export default function QuotesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    if (!user) router.push('/login')
  }, [user, router])
  const [quoteText, setQuoteText] = useState('')
  const [style, setStyle] = useState('modern')
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<QuoteCard[]>([])

  const handleGenerate = async () => {
    const text = quoteText.trim()
    if (!text) {
      showToast('Enter a quote to generate', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await apiPost<{ quoteCards: QuoteCard[] }>('/quote/generate', {
        quoteText: text,
        style
      })
      const list = res?.quoteCards || []
      setCards(list)
      showToast(list.length ? `Generated ${list.length} quote card(s)` : 'No cards generated', list.length ? 'success' : 'info')
    } catch (err: any) {
      showToast(err?.response?.data?.error || err?.message || 'Failed to generate', 'error')
      setCards([])
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (card: QuoteCard) => {
    const url = getImageUrl(card.imageUrl)
    const a = document.createElement('a')
    a.href = url
    a.download = `quote-card-${Date.now()}.png`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    showToast('Download started', 'success')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 bg-mesh relative">
      <div className="absolute inset-0 bg-dots" />
      <section className="relative section-padding">
        <div className="container-modern">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Quote Card Generator
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Transform your content into beautiful, shareable quote cards
            </p>
          </div>

          <div className="max-w-2xl mx-auto mb-12">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8 border border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quote text
              </label>
              <textarea
                value={quoteText}
                onChange={(e) => setQuoteText(e.target.value)}
                placeholder="Enter your quote here..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500"
                disabled={loading}
              />
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Style
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl mb-6 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={loading}
              >
                {STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button
                onClick={handleGenerate}
                disabled={loading || !quoteText.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? <LoadingSpinner size="sm" /> : <Sparkles className="w-5 h-5" />}
                {loading ? 'Generating...' : 'Generate Quote Cards'}
              </button>
            </div>
          </div>

          {cards.length > 0 && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
                Your Quote Cards
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cards.map((card, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                  >
                    <div className="aspect-square relative">
                      <img
                        src={getImageUrl(card.imageUrl)}
                        alt={card.quote}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                        &ldquo;{card.quote}&rdquo;
                      </p>
                      <button
                        onClick={() => handleDownload(card)}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cards.length > 0 && !loading && (
            <div className="text-center mt-8">
              <button
                onClick={() => { setQuoteText(''); setCards([]) }}
                className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
                Create another
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
