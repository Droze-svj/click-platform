'use client'

import { useState } from 'react'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function QuotesPage() {
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 bg-mesh relative">
      <div className="absolute inset-0 bg-dots"></div>
      <section className="relative section-padding">
        <div className="container-modern">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Quote Card Generator
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Transform your content into beautiful, shareable quote cards with AI-powered design
            </p>
          </div>

          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Coming Soon
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                The Quote Card Generator is currently being optimized for peak performance.
              </p>
              {loading && <LoadingSpinner size="sm" />}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
