'use client'

import { useState } from 'react'
import axios from 'axios'
import { API_URL } from '@/lib/api'
import { useTranslation } from '@/hooks/useTranslation'

interface SelfServeCancellationProps {
  onCancelled?: () => void
}

export default function SelfServeCancellation({ onCancelled }: SelfServeCancellationProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<'confirm' | 'reason' | 'refund' | 'complete'>('confirm')
  const [reason, setReason] = useState<string>('')
  const [reasonDetails, setReasonDetails] = useState('')
  const [requestRefund, setRequestRefund] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cancellation, setCancellation] = useState<any>(null)

  const handleCancel = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${API_URL}/pricing/cancel`,
        {
          reason,
          reasonDetails,
          requestRefund,
          effectiveDate: null // Immediate
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setCancellation(res.data.data)
        setStep('complete')
        if (onCancelled) {
          onCancelled()
        }
      }
    } catch (error: any) {
      console.error('Error cancelling', error)
      alert(error.response?.data?.error || t('selfServeCancellation.cancelFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (step === 'confirm') {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">{t('selfServeCancellation.cancelSubscription')}</h2>
        <p className="text-gray-600">{t('selfServeCancellation.confirmPrompt')}</p>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setStep('reason')}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            {t('selfServeCancellation.yesCancel')}
          </button>
          <button
            type="button"
            onClick={() => onCancelled?.()}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            {t('selfServeCancellation.keepSubscription')}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'reason') {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">{t('selfServeCancellation.whyCancelling')}</h2>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-label={t('selfServeCancellation.whyCancelling')}
          className="w-full px-4 py-2 border rounded-lg"
        >
          <option value="">{t('selfServeCancellation.selectReason')}</option>
          <option value="too_expensive">{t('selfServeCancellation.reasonTooExpensive')}</option>
          <option value="not_using">{t('selfServeCancellation.reasonNotUsing')}</option>
          <option value="missing_features">{t('selfServeCancellation.reasonMissingFeatures')}</option>
          <option value="found_alternative">{t('selfServeCancellation.reasonFoundAlternative')}</option>
          <option value="technical_issues">{t('selfServeCancellation.reasonTechnicalIssues')}</option>
          <option value="billing_issues">{t('selfServeCancellation.reasonBillingIssues')}</option>
          <option value="other">{t('selfServeCancellation.reasonOther')}</option>
        </select>
        <textarea
          value={reasonDetails}
          onChange={(e) => setReasonDetails(e.target.value)}
          placeholder={t('selfServeCancellation.additionalDetails')}
          className="w-full px-4 py-2 border rounded-lg"
          rows={3}
        />
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setStep('refund')}
            disabled={!reason}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {t('selfServeCancellation.continue')}
          </button>
          <button
            type="button"
            onClick={() => setStep('confirm')}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            {t('selfServeCancellation.back')}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'refund') {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">{t('selfServeCancellation.requestRefundTitle')}</h2>
        <p className="text-gray-600">{t('selfServeCancellation.requestRefundPrompt')}</p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={requestRefund}
            onChange={(e) => setRequestRefund(e.target.checked)}
            className="w-4 h-4"
          />
          <span>{t('selfServeCancellation.requestRefundCheckbox')}</span>
        </label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? t('selfServeCancellation.processing') : t('selfServeCancellation.cancelSubscription')}
          </button>
          <button
            type="button"
            onClick={() => setStep('reason')}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            {t('selfServeCancellation.back')}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'complete') {
    return (
      <div className="p-6 space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h2 className="text-xl font-semibold text-green-800 mb-2">{t('selfServeCancellation.subscriptionCancelled')}</h2>
          <p className="text-green-700">
            {requestRefund && cancellation?.refund?.requested
              ? t('selfServeCancellation.cancelledWithRefund')
              : t('selfServeCancellation.cancelledMessage')}
          </p>
          {cancellation?.refund && (
            <div className="mt-4">
              <p className="text-sm text-green-700">
                {t('selfServeCancellation.refundAmount', { amount: cancellation.refund.amount?.toFixed(2) || '0.00' })}
              </p>
              <p className="text-sm text-green-700">
                {t('selfServeCancellation.statusLabel', { status: cancellation.refund.status })}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}


