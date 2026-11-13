'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { apiPost, handleApiError } from '../../lib/api'
import { useTranslation } from '../../hooks/useTranslation'
import { Button } from '../ui/button'
import { FormField, Input, Textarea } from '../ui/form-field'

const TOPICS = ['support', 'billing', 'privacy', 'sales', 'other'] as const
type Topic = typeof TOPICS[number]

/**
 * The contact page used to offer three mailto links on clickapp.io, a domain
 * that doesn't exist — every message bounced. This stores the message
 * (POST /api/contact) and it shows up on the admin dashboard.
 */
export default function ContactForm() {
  const { t } = useTranslation()
  const params = useSearchParams()
  const initial = params?.get('topic') as Topic | null
  const [topic, setTopic] = useState<Topic>(initial && TOPICS.includes(initial) ? initial : 'support')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      await apiPost('/contact', { name, email, topic, message, website })
      setSent(true)
    } catch (err) {
      setError(handleApiError(err) || t('contactPage.sendFailed'))
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div role="status" className="ds-surface-card rounded-3xl p-8 flex items-start gap-4">
        <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="font-bold text-theme-primary">{t('contactPage.sentTitle')}</p>
          <p className="mt-1 text-sm text-theme-secondary">{t('contactPage.sentBody', { email })}</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="ds-surface-card rounded-3xl p-6 sm:p-8 space-y-5 max-w-2xl">
      <fieldset>
        <legend className="ds-text-label text-theme-secondary mb-2">{t('contactPage.topicLabel')}</legend>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((tp) => (
            <button
              key={tp}
              type="button"
              aria-pressed={topic === tp}
              onClick={() => setTopic(tp)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${topic === tp ? 'bg-primary text-primary-foreground border-transparent' : 'border-[var(--border-subtle)] text-theme-secondary hover:text-theme-primary'}`}
            >
              {t(`contactPage.topic.${tp}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid sm:grid-cols-2 gap-4">
        <FormField label={t('contactPage.nameLabel')} htmlFor="contact-name">
          <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />
        </FormField>
        <FormField label={t('contactPage.emailLabel')} htmlFor="contact-email" required>
          <Input id="contact-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </FormField>
      </div>
      <FormField label={t('contactPage.messageLabel')} htmlFor="contact-message" hint={t(`contactPage.hint.${topic}`)} required>
        <Textarea id="contact-message" required rows={6} minLength={10} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} />
      </FormField>
      {/* Honeypot: hidden from people and assistive tech. */}
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
      <Button type="submit" variant="primary" disabled={sending}>{sending ? t('contactPage.sending') : t('contactPage.send')}</Button>
    </form>
  )
}
