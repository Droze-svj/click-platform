'use client'

import { useEffect, useState } from 'react'
import { apiGet, apiPost, handleApiError, setTokens } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { FormField, Input } from '@/components/ui/form-field'

interface TwoFactorStatus { enabled: boolean; setupPending: boolean; backupCodesRemaining: number; available?: boolean }
interface SetupData { qrCodeDataUrl: string; secret: string }

const unwrap = <T,>(res: any): T => (res?.data ?? res) as T

/** Group a base32 secret as "ABCD EFGH …" so it can be typed by hand. */
const groupSecret = (s: string) => s.replace(/(.{4})/g, '$1 ').trim()

/**
 * Settings → Account & Security: two-step sign-in (authenticator app + one-time
 * backup codes) and "sign out of all other devices".
 */
export default function AccountSecurityPanel() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null)
  const [setup, setSetup] = useState<SetupData | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [code, setCode] = useState('')
  const [disabling, setDisabling] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function loadStatus() {
    try {
      setStatus(unwrap<TwoFactorStatus>(await apiGet('/auth/2fa/status')))
    } catch (e) {
      setError(handleApiError(e) || 'Could not load your security settings')
    }
  }

  useEffect(() => { loadStatus() }, [])

  async function act(fn: () => Promise<void>) {
    setBusy(true); setError(null); setMessage(null)
    try { await fn() } catch (e) { setError(handleApiError(e) || 'Something went wrong') } finally { setBusy(false) }
  }

  const startSetup = () => act(async () => {
    setSetup(unwrap<SetupData>(await apiPost('/auth/2fa/setup', {})))
    setCode('')
  })

  const confirmSetup = (e: React.FormEvent) => {
    e.preventDefault()
    act(async () => {
      const res = unwrap<{ backupCodes: string[] }>(await apiPost('/auth/2fa/enable', { token: code.trim() }))
      setBackupCodes(res.backupCodes)
      setSetup(null)
      setCode('')
      await loadStatus()
    })
  }

  const turnOff = (e: React.FormEvent) => {
    e.preventDefault()
    act(async () => {
      await apiPost('/auth/2fa/disable', { password, token: code.trim() })
      setDisabling(false); setPassword(''); setCode('')
      setMessage('Two-step sign-in is off.')
      await loadStatus()
    })
  }

  const signOutOthers = () => act(async () => {
    const res = unwrap<{ token?: string; refreshToken?: string }>(await apiPost('/auth/revoke-sessions', {}))
    if (res?.token) setTokens(res.token, res.refreshToken)
    setMessage('Signed out of all other devices.')
  })

  function downloadCodes() {
    if (!backupCodes || typeof URL.createObjectURL !== 'function') return
    const text = `Click backup codes — each works once.\n\n${backupCodes.join('\n')}\n`
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'click-backup-codes.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6" data-testid="account-security">
      <section className="space-y-3" aria-labelledby="twofa-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 id="twofa-heading" className="text-sm font-medium text-theme-primary">Two-step sign-in</h3>
            <p className="ds-text-caption mt-0.5">
              After your password, Click asks for a code from an authenticator app (Google Authenticator, 1Password, Authy…).
            </p>
          </div>
          {status && (
            <span
              data-testid="twofa-state"
              className={status.enabled
                ? 'rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400'
                : 'rounded-full bg-[var(--surface-subtle,rgba(127,127,127,0.12))] px-2.5 py-1 text-xs font-medium text-theme-muted'}
            >
              {status.enabled ? `On · ${status.backupCodesRemaining} backup codes left` : 'Off'}
            </span>
          )}
        </div>

        {status && status.available === false && !status.enabled && (
          <p data-testid="twofa-unavailable" className="ds-text-caption text-amber-600 dark:text-amber-400">
            Two-step sign-in isn&apos;t available on this server yet.
          </p>
        )}

        {status && !status.enabled && status.available !== false && !setup && !backupCodes && (
          <Button data-testid="twofa-start" variant="primary" onClick={startSetup} loading={busy}>Turn on two-step sign-in</Button>
        )}

        {setup && (
          <form onSubmit={confirmSetup} className="space-y-4 rounded-lg border border-[var(--border-subtle)] p-4" data-testid="twofa-setup">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-theme-secondary">
              <li>Open your authenticator app and scan this code.</li>
              <li>Enter the 6-digit code it shows.</li>
            </ol>
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL QR from the server */}
            <img src={setup.qrCodeDataUrl} alt="QR code for your authenticator app" width={176} height={176} className="rounded-lg bg-white p-2" />
            <p className="ds-text-caption">
              Can&apos;t scan? Enter this key instead:{' '}
              <code data-testid="twofa-secret" className="select-all break-all font-mono text-theme-primary">{groupSecret(setup.secret)}</code>
            </p>
            <FormField label="6-digit code" htmlFor="twofa-code">
              <Input
                id="twofa-code" data-testid="twofa-code" value={code} onChange={(e) => setCode(e.target.value)}
                inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456" className="max-w-[12rem] tracking-[0.25em]"
              />
            </FormField>
            <div className="flex gap-2">
              <Button data-testid="twofa-confirm" type="submit" variant="primary" loading={busy}>Turn on</Button>
              <Button type="button" variant="secondary" onClick={() => { setSetup(null); setCode('') }}>Cancel</Button>
            </div>
          </form>
        )}

        {backupCodes && (
          <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4" data-testid="twofa-backup-codes">
            <p className="text-sm font-medium text-theme-primary">Save your backup codes</p>
            <p className="ds-text-caption">
              If you lose your phone, each of these signs you in once. This is the only time they&apos;re shown.
            </p>
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm text-theme-primary">
              {backupCodes.map((c) => <li key={c} className="select-all">{c}</li>)}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={downloadCodes}>Download as a file</Button>
              <Button data-testid="twofa-codes-done" type="button" variant="primary" onClick={() => setBackupCodes(null)}>I&apos;ve saved them</Button>
            </div>
          </div>
        )}

        {status?.enabled && !backupCodes && (
          disabling ? (
            <form onSubmit={turnOff} className="space-y-4 rounded-lg border border-[var(--border-subtle)] p-4" data-testid="twofa-disable">
              <FormField label="Your password" htmlFor="twofa-password">
                <Input id="twofa-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </FormField>
              <FormField label="Code from your app (or a backup code)" htmlFor="twofa-off-code">
                <Input id="twofa-off-code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" maxLength={16} />
              </FormField>
              <div className="flex gap-2">
                <Button type="submit" variant="destructive" loading={busy}>Turn off</Button>
                <Button type="button" variant="secondary" onClick={() => { setDisabling(false); setPassword(''); setCode('') }}>Cancel</Button>
              </div>
            </form>
          ) : (
            <Button data-testid="twofa-off" variant="secondary" onClick={() => { setDisabling(true); setError(null); setMessage(null) }}>
              Turn off two-step sign-in
            </Button>
          )
        )}
      </section>

      <section className="space-y-3 border-t border-[var(--border-subtle)] pt-5" aria-labelledby="sessions-heading">
        <h3 id="sessions-heading" className="text-sm font-medium text-theme-primary">Signed-in devices</h3>
        <p className="ds-text-caption">
          Lost a laptop or signed in somewhere public? End every other session right away. You stay signed in here.
        </p>
        <Button data-testid="sign-out-others" variant="secondary" onClick={signOutOthers} loading={busy}>
          Sign out of all other devices
        </Button>
      </section>

      {error && <p role="alert" data-testid="security-error" className="text-sm text-rose-500">{error}</p>}
      {message && <p role="status" data-testid="security-message" className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
    </div>
  )
}
