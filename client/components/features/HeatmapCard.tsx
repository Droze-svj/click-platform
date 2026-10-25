'use client'

import { Fragment } from 'react'
import type { Heatmap } from '@/lib/featuresApi'
import { heatmapMax, cellIntensity, cellLabel } from '@/lib/featureViewModels'
import { weekdayShortNames } from '../../utils/locale'
import { useTranslation } from '@/hooks/useTranslation'

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const DAYS = [0, 1, 2, 3, 4, 5, 6]

/**
 * Pure presentational 7×24 engagement heatmap. Cell shading is relative to the
 * grid's own max; the peak cell is ringed. A container supplies `heatmap` from
 * featuresApi.getHeatmap().
 */
export default function HeatmapCard({ heatmap }: { heatmap: Heatmap | null }) {
  const { t } = useTranslation()
  if (!heatmap || !heatmap.grid || heatmap.grid.length === 0) {
    return (
      <div className="rounded-xl bg-surface-card border border-default p-4" data-testid="heatmap-empty">
        <p className="text-sm text-theme-secondary">{t('creatorTools.heatmap.empty')}</p>
      </div>
    )
  }

  const max = heatmapMax(heatmap.grid)
  // index cells by day*24+hour for O(1) lookup while rendering the full grid.
  const byCell = new Map<number, number>()
  for (const c of heatmap.grid) byCell.set(c.day * 24 + c.hour, c.avgEngagement)
  const { peak } = heatmap
  const labels = heatmap.dayLabels || weekdayShortNames()

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4 space-y-2" data-testid="heatmap-card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-theme-primary">{t('creatorTools.heatmap.title')}</h2>
        {peak && (
          <span className="text-xs text-green-600 dark:text-green-400" data-testid="heatmap-peak">
            {t('creatorTools.heatmap.peak', { time: cellLabel(peak.day, peak.hour, labels) })}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="inline-grid" style={{ gridTemplateColumns: `2.5rem repeat(24, 0.6rem)` }}>
          <div />
          {HOURS.map((h) => (
            <div key={`h${h}`} className="text-[8px] text-theme-muted text-center">{h % 6 === 0 ? h : ''}</div>
          ))}
          {DAYS.map((d) => (
            <Fragment key={`d${d}`}>
              <div className="text-[10px] text-theme-muted pr-1 leading-[0.6rem]">{labels[d]}</div>
              {HOURS.map((h) => {
                const avg = byCell.get(d * 24 + h)
                const intensity = avg == null ? 0 : cellIntensity(avg, max)
                const isPeak = peak && peak.day === d && peak.hour === h
                return (
                  <div
                    key={`c${d}-${h}`}
                    data-testid="heatmap-cell"
                    title={avg == null ? cellLabel(d, h, labels) : t('creatorTools.heatmap.cellAverage', { time: cellLabel(d, h, labels), average: Math.round(avg) })}
                    className={`h-[0.6rem] w-[0.6rem] ${isPeak ? 'ring-1 ring-green-400' : ''}`}
                    style={{ backgroundColor: `rgba(57,255,20,${avg == null ? 0.04 : 0.1 + intensity * 0.9})` }}
                  />
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-theme-muted">{heatmap.totalPosts === 1
          ? t('creatorTools.heatmap.basedOnOne', { count: heatmap.totalPosts })
          : t('creatorTools.heatmap.basedOnOther', { count: heatmap.totalPosts })}</p>
    </div>
  )
}
