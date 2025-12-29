'use client'

import { useState } from 'react'
import axios from 'axios'
import { API_URL } from '@/lib/api'

interface SelfServeCancellationProps {
  onCancelled?: () => void
}

export default function SelfServeCancellation({ onCancelled }: SelfServeCancellationProps) {
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
      alert(error.response?.data?.error || 'Failed to cancel subscription')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'confirm') {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Cancel Subscription</h2>
        <p className="text-gray-600">Are you sure you want to cancel your subscription?</p>
        <div className="flex gap-4">
          <button
            onClick={() => setStep('reason')}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Yes, Cancel
          </button>
          <button
            onClick={() => onCancelled?.()}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Keep Subscription
          </button>
        </div>
      </div>
    )
  }

  if (step === 'reason') {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Why are you cancelling?</h2>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg"
        >
          <option value="">Select a reason...</option>
          <option value="too_expensive">Too expensive</option>
          <option value="not_using">Not using it enough</option>
          <option value="missing_features">Missing features</option>
          <option value="found_alternative">Found alternative</option>
          <option value="technical_issues">Technical issues</option>
          <option value="billing_issues">Billing issues</option>
          <option value="other">Other</option>
        </select>
        <textarea
          value={reasonDetails}
          onChange={(e) => setReasonDetails(e.target.value)}
          placeholder="Additional details (optional)"
          className="w-full px-4 py-2 border rounded-lg"
          rows={3}
        />
        <div className="flex gap-4">
          <button
            onClick={() => setStep('refund')}
            disabled={!reason}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Continue
          </button>
          <button
            onClick={() => setStep('confirm')}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  if (step === 'refund') {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Request Refund?</h2>
        <p className="text-gray-600">Would you like to request a pro-rated refund for unused time?</p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={requestRefund}
            onChange={(e) => setRequestRefund(e.target.checked)}
            className="w-4 h-4"
          />
          <span>Yes, request pro-rated refund</span>
        </label>
        <div className="flex gap-4">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Cancel Subscription'}
          </button>
          <button
            onClick={() => setStep('reason')}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  if (step === 'complete') {
    return (
      <div className="p-6 space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h2 className="text-xl font-semibold text-green-800 mb-2">Subscription Cancelled</h2>
          <p className="text-green-700">
            Your subscription has been cancelled{requestRefund && cancellation?.refund?.requested && '. Refund request submitted.'}
          </p>
          {cancellation?.refund && (
            <div className="mt-4">
              <p className="text-sm text-green-700">
                Refund Amount: ${cancellation.refund.amount?.toFixed(2) || '0.00'}
              </p>
              <p className="text-sm text-green-700">
                Status: {cancellation.refund.status}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}


