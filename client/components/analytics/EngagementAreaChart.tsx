'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

/**
 * The engagement-over-time area chart for a single post.
 *
 * Split into its own module so the route can pull it in with `next/dynamic`.
 * recharts drags the whole d3 family behind it, and importing it at the top of
 * the page put ~100kB of charting into the FIRST LOAD of
 * /dashboard/analytics/posts/[id] — which was the heaviest route in the app at
 * 312kB — even for a post with no data to plot.
 */

export interface EngagementPoint {
  name: string
  val: number
}

export interface EngagementAreaChartProps {
  data: EngagementPoint[]
  /** Label for the metric in the tooltip, e.g. "engagements". */
  metricLabel: string
}

export default function EngagementAreaChart({ data, metricLabel }: EngagementAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
            {/* Brand indigo — matches --primary / primary-500. */}
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} axisLine={false} tickLine={false} dy={8} />
        <YAxis stroke="var(--text-muted)" fontSize={12} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="ds-surface-elevated p-3">
                  <p className="ds-text-caption mb-1">{payload[0].payload.name}</p>
                  <div className="ds-text-h3 text-theme-primary">
                    {payload[0].value} <span className="ds-text-caption">{metricLabel}</span>
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Area type="monotone" dataKey="val" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorEngagement)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
