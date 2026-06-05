'use client'

import { useState } from 'react'
import { apiPost, handleApiError } from '../lib/api'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

export default function ChangePasswordForm() {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return t('changePasswordForm.errorMinLength')
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return t('changePasswordForm.errorLowercase')
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return t('changePasswordForm.errorUppercase')
    }
    if (!/(?=.*\d)/.test(password)) {
      return t('changePasswordForm.errorNumber')
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    // Validation
    if (formData.newPassword !== formData.confirmPassword) {
      setError(t('changePasswordForm.errorPasswordsDoNotMatch'))
      return
    }

    const validationError = validatePassword(formData.newPassword)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    try {
      // The server endpoint is POST /api/auth/change-password — the previous
      // PUT /api/user/change-password 404'd silently because no such route
      // existed. apiPost auto-attaches the Bearer token from localStorage.
      await apiPost('/auth/change-password', {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      })

      setSuccess(true)
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })

      setTimeout(() => setSuccess(false), 3000)
    } catch (error: any) {
      setError(handleApiError(error) || t('changePasswordForm.errorFailedToChange'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-600 dark:text-green-400">
          {t('changePasswordForm.successMessage')}
        </div>
      )}

      <div>
        <label htmlFor="currentPassword" className="text-sm font-medium mb-2 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          {t('changePasswordForm.currentPassword')}
        </label>
        <div className="relative">
          <input
            id="currentPassword"
            type={showPasswords.current ? 'text' : 'password'}
            value={formData.currentPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
            required
            placeholder={t('changePasswordForm.currentPasswordPlaceholder')}
            className="w-full px-4 py-2 pr-10 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
          />
          <button
           type="button"
            onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium mb-2">{t('changePasswordForm.newPassword')}</label>
        <div className="relative">
          <input
            id="newPassword"
            type={showPasswords.new ? 'text' : 'password'}
            value={formData.newPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
            required
            placeholder={t('changePasswordForm.newPasswordPlaceholder')}
            className="w-full px-4 py-2 pr-10 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
          />
          <button
           type="button"
            onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {t('changePasswordForm.passwordHint')}
        </p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">{t('changePasswordForm.confirmNewPassword')}</label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showPasswords.confirm ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            required
            placeholder={t('changePasswordForm.confirmPasswordPlaceholder')}
            className="w-full px-4 py-2 pr-10 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
          />
          <button
           type="button"
            onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <button        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
      >
        {saving ? t('changePasswordForm.changing') : t('changePasswordForm.changePassword')}
      </button>
    </form>
  )
}



