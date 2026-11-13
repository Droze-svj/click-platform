'use client'

import { useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { apiGet, apiDelete, handleApiError } from '../../lib/api'
import { useTranslation } from '../../hooks/useTranslation'
import { Button } from '../ui/button'
import { Modal } from '../ui/modal'
import { FormField, Input } from '../ui/form-field'

function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  window.dispatchEvent(new CustomEvent('toast', { detail: { message, type } }))
}

/**
 * Download everything Click stores about you, or delete the account and all of
 * it. The delete component that existed (PrivacySettings) was never mounted, so
 * the only in-app option was deactivation, which keeps every byte.
 */
export default function PrivacyDataPanel({ onDeleted }: { onDeleted: () => void }) {
  const { t } = useTranslation()
  const [exporting, setExporting] = useState(false)
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const word = t('privacyData.confirmWord')

  const download = async () => {
    setExporting(true)
    try {
      const data = await apiGet<any>('/privacy/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `click-data-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast(t('privacyData.exportReady'), 'success')
    } catch (err) {
      toast(handleApiError(err) || t('privacyData.exportFailed'), 'error')
    } finally {
      setExporting(false)
    }
  }

  const erase = async () => {
    setDeleting(true)
    setError('')
    try {
      await apiDelete('/privacy/delete', { data: { confirm: 'DELETE', password } })
      toast(t('privacyData.deleted'), 'success')
      setOpen(false)
      onDeleted()
    } catch (err: any) {
      const code = err?.response?.data?.code
      setError(code === 'SUBSCRIPTION_ACTIVE'
        ? t('privacyData.cancelFirst')
        : err?.response?.status === 403 ? t('privacyData.wrongPassword') : (handleApiError(err) || t('privacyData.deleteFailed')))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-theme-primary">{t('privacyData.exportTitle')}</p>
          <p className="ds-text-caption mt-1">{t('privacyData.exportBody')}</p>
          <Button className="mt-3" variant="secondary" onClick={download} disabled={exporting} leftIcon={<Download size={16} aria-hidden />}>
            {exporting ? t('privacyData.exporting') : t('privacyData.exportButton')}
          </Button>
        </div>
        <div className="border-t border-[var(--border-subtle)] pt-4">
          <p className="text-sm font-medium text-theme-primary">{t('privacyData.deleteTitle')}</p>
          <p className="ds-text-caption mt-1">{t('privacyData.deleteBody')}</p>
          <Button className="mt-3" variant="destructive" onClick={() => { setOpen(true); setError(''); setTyped(''); setPassword('') }} leftIcon={<Trash2 size={16} aria-hidden />}>
            {t('privacyData.deleteButton')}
          </Button>
        </div>
      </div>

      <Modal open={open} onClose={() => !deleting && setOpen(false)} title={t('privacyData.dialogTitle')} description={t('privacyData.dialogBody')}>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (typed.trim() === word && password) erase() }}
        >
          <FormField label={t('privacyData.passwordLabel')} htmlFor="erase-password">
            <Input id="erase-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormField>
          <FormField label={t('privacyData.typeToConfirm', { word })} htmlFor="erase-confirm">
            <Input id="erase-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </FormField>
          {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={deleting}>{t('privacyData.keepAccount')}</Button>
            <Button type="submit" variant="destructive" disabled={deleting || !password || typed.trim() !== word}>
              {deleting ? t('privacyData.deleting') : t('privacyData.deleteForever')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
