'use client'

/**
 * FacebookPagesPicker — lists the Facebook Pages Click can post to and which
 * one is the default. Meta only lets apps publish to Pages, so a creator needs
 * to see (and choose) where their videos go. Reads GET /oauth/facebook/pages,
 * writes PUT /oauth/facebook/default-page.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { CheckCircle, Instagram } from 'lucide-react'
import { apiGet, apiPut } from '@/lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { Button } from '@/components/ui'

interface FbPage { id: string; name: string | null; hasInstagram: boolean }
interface PagesResponse { connected: boolean; pages: FbPage[]; defaultPageId: string | null }

const unwrap = <T,>(res: any): T => (res?.data ?? res) as T

export function FacebookPagesPicker({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useTranslation()
  const [data, setData] = useState<PagesResponse | null>(null)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(false)
      setData(unwrap<PagesResponse>(await apiGet('/oauth/facebook/pages')))
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  const makeDefault = async (pageId: string) => {
    setSaving(pageId)
    try {
      await apiPut('/oauth/facebook/default-page', { pageId })
      setData((d) => (d ? { ...d, defaultPageId: pageId } : d))
    } catch {
      setError(true)
    } finally {
      setSaving(null)
    }
  }

  if (error) return <p className="ds-text-caption text-rose-500">{t('socialPage.fbPages.loadFailed')}</p>
  if (!data || !data.connected) return null

  return (
    <div className="ds-surface-subtle p-3 space-y-2">
      <div>
        <p className="ds-text-label text-theme-primary">{t('socialPage.fbPages.title')}</p>
        <p className="ds-text-caption">{t('socialPage.fbPages.hint')}</p>
      </div>
      {data.pages.length === 0 ? (
        <p className="ds-text-caption text-amber-600 dark:text-amber-400">{t('socialPage.fbPages.noPages')}</p>
      ) : (
        <ul className="space-y-1.5">
          {data.pages.map((p) => {
            const isDefault = p.id === data.defaultPageId
            return (
              <li key={p.id} className="flex items-center gap-2 min-w-0">
                <span className="flex-1 min-w-0">
                  <span className="ds-text-label text-theme-primary truncate block">{p.name || p.id}</span>
                  {p.hasInstagram && (
                    <span className="ds-text-caption inline-flex items-center gap-1">
                      <Instagram size={11} aria-hidden />{t('socialPage.fbPages.hasInstagram')}
                    </span>
                  )}
                </span>
                {isDefault ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                    <CheckCircle size={12} aria-hidden />{t('socialPage.fbPages.postsGoHere')}
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    loading={saving === p.id}
                    onClick={() => makeDefault(p.id)}
                    aria-label={t('socialPage.fbPages.makeDefaultFor', { page: p.name || p.id })}
                  >
                    {t('socialPage.fbPages.makeDefault')}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default FacebookPagesPicker
