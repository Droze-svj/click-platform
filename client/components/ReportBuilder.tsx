'use client'

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { API_URL } from '@/lib/api'
import { useTranslation } from '@/hooks/useTranslation'

interface Metric {
  id: string
  type: string
  label: string
  position: { x: number; y: number; width: number; height: number }
  format: string
  chartType: string | null
}

interface ReportTemplate {
  _id: string
  name: string
  metrics: Metric[]
  branding: any
  layout: any
}

interface ReportBuilderProps {
  clientWorkspaceId: string
  agencyWorkspaceId: string
  templateId?: string
  onSave?: (template: ReportTemplate) => void
}

export default function ReportBuilder({
  clientWorkspaceId,
  agencyWorkspaceId,
  templateId,
  onSave
}: ReportBuilderProps) {
  const { t } = useTranslation()
  const [template, setTemplate] = useState<ReportTemplate | null>(null)
  const [draggedMetric, setDraggedMetric] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null)

  const availableMetrics = [
    { type: 'reach', label: 'Reach', format: 'number' },
    { type: 'impressions', label: 'Impressions', format: 'number' },
    { type: 'engagement_rate', label: 'Engagement Rate', format: 'percentage' },
    { type: 'ctr', label: 'Click-Through Rate', format: 'percentage' },
    { type: 'conversions', label: 'Conversions', format: 'number' },
    { type: 'roi', label: 'ROI', format: 'currency' },
    { type: 'roas', label: 'ROAS', format: 'currency' },
    { type: 'brand_awareness', label: 'Brand Awareness', format: 'number' },
    { type: 'sentiment', label: 'Sentiment', format: 'percentage' },
    { type: 'health_score', label: 'Health Score', format: 'number' },
    { type: 'audience_growth', label: 'Audience Growth', format: 'percentage' }
  ]

  const loadTemplate = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${API_URL}/reports/templates/${templateId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setTemplate(res.data.data)
      }
    } catch (error) {
      console.error('Error loading template', error)
    }
  }, [templateId])

  useEffect(() => {
    if (templateId) {
      loadTemplate()
    } else {
      // Create new template
      setTemplate({
        _id: '',
        name: t('reportBuilder.newTemplateName'),
        metrics: [],
        branding: {},
        layout: {}
      })
    }
  }, [templateId, loadTemplate])

  const handleDragStart = (metricType: string) => {
    setDraggedMetric(metricType)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedMetric || !template) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const metric = availableMetrics.find(m => m.type === draggedMetric)
    if (!metric) return

    const newMetric: Metric = {
      id: `metric_${Date.now()}`,
      type: metric.type,
      label: metric.label,
      position: { x, y, width: 200, height: 100 },
      format: metric.format,
      chartType: null
    }

    setTemplate({
      ...template,
      metrics: [...template.metrics, newMetric]
    })

    setDraggedMetric(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleMetricClick = (metric: Metric) => {
    setSelectedMetric(metric)
  }

  const handleSave = async () => {
    if (!template) return

    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${API_URL}/reports/templates`,
        {
          templateId: template._id || undefined,
          name: template.name,
          clientWorkspaceId,
          agencyWorkspaceId,
          metrics: template.metrics,
          branding: template.branding,
          layout: template.layout
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.data.success) {
        setTemplate(res.data.data)
        if (onSave) onSave(res.data.data)
      }
    } catch (error) {
      console.error('Error saving template', error)
    }
  }

  const handleDeleteMetric = (metricId: string) => {
    if (!template) return
    setTemplate({
      ...template,
      metrics: template.metrics.filter(m => m.id !== metricId)
    })
  }

  if (!template) {
    return <div className="p-8 text-center">{t('reportBuilder.loading')}</div>
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar - Available Metrics */}
      <div className="w-64 bg-gray-100 p-4 border-r">
        <h3 className="font-semibold mb-4">{t('reportBuilder.availableMetrics')}</h3>
        <div className="space-y-2">
          {availableMetrics.map(metric => (
            <div
              key={metric.type}
              draggable
              onDragStart={() => handleDragStart(metric.type)}
              className="p-3 bg-white rounded-lg shadow cursor-move hover:shadow-md transition-shadow"
            >
              <div className="font-medium text-sm">{t(`reportBuilder.metric.${metric.type}`)}</div>
              <div className="text-xs text-gray-500">{metric.type}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas - Report Builder */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 p-4">
          <div
            className="w-full h-full bg-white border-2 border-dashed border-gray-300 relative"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {template.metrics.map(metric => (
              <div
                key={metric.id}
                onClick={() => handleMetricClick(metric)}
                className={`absolute border-2 rounded p-2 cursor-pointer ${
                  selectedMetric?.id === metric.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
                style={{
                  left: `${metric.position.x}px`,
                  top: `${metric.position.y}px`,
                  width: `${metric.position.width}px`,
                  height: `${metric.position.height}px`
                }}
              >
                <div className="font-medium text-sm">{metric.label}</div>
                <div className="text-xs text-gray-500">{metric.format}</div>
                {selectedMetric?.id === metric.id && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteMetric(metric.id)
                    }}
                    className="absolute top-1 right-1 text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Properties Panel */}
      {selectedMetric && (
        <div className="w-64 bg-gray-100 p-4 border-l">
          <h3 className="font-semibold mb-4">{t('reportBuilder.metricProperties')}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('reportBuilder.label')}</label>
              <input
                type="text"
                value={selectedMetric.label}
                onChange={(e) => {
                  const updated = template.metrics.map(m =>
                    m.id === selectedMetric.id ? { ...m, label: e.target.value } : m
                  )
                  setTemplate({ ...template, metrics: updated })
                  setSelectedMetric({ ...selectedMetric, label: e.target.value })
                }}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('reportBuilder.format')}</label>
              <select
                value={selectedMetric.format}
                onChange={(e) => {
                  const updated = template.metrics.map(m =>
                    m.id === selectedMetric.id ? { ...m, format: e.target.value } : m
                  )
                  setTemplate({ ...template, metrics: updated })
                  setSelectedMetric({ ...selectedMetric, format: e.target.value })
                }}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="number">{t('reportBuilder.formatOption.number')}</option>
                <option value="percentage">{t('reportBuilder.formatOption.percentage')}</option>
                <option value="currency">{t('reportBuilder.formatOption.currency')}</option>
                <option value="chart">{t('reportBuilder.formatOption.chart')}</option>
                <option value="table">{t('reportBuilder.formatOption.table')}</option>
              </select>
            </div>
            {selectedMetric.format === 'chart' && (
              <div>
                <label className="block text-sm font-medium mb-1">{t('reportBuilder.chartType')}</label>
                <select
                  value={selectedMetric.chartType || ''}
                  onChange={(e) => {
                    const updated = template.metrics.map(m =>
                      m.id === selectedMetric.id ? { ...m, chartType: e.target.value } : m
                    )
                    setTemplate({ ...template, metrics: updated })
                    setSelectedMetric({ ...selectedMetric, chartType: e.target.value })
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">{t('reportBuilder.chartOption.none')}</option>
                  <option value="line">{t('reportBuilder.chartOption.line')}</option>
                  <option value="bar">{t('reportBuilder.chartOption.bar')}</option>
                  <option value="pie">{t('reportBuilder.chartOption.pie')}</option>
                  <option value="area">{t('reportBuilder.chartOption.area')}</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-white border-b p-4 flex justify-between items-center z-10">
        <input
          type="text"
          value={template.name}
          onChange={(e) => setTemplate({ ...template, name: e.target.value })}
          className="text-xl font-semibold border-none focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {t('reportBuilder.saveTemplate')}
        </button>
      </div>
    </div>
  )
}


