import { apiPost } from './api'
import type { BillingPeriod } from './plans'

/**
 * The checkout URL to send a signed-in user to. Asks the server for a Whop
 * checkout tied to this account (the user id travels in Whop's metadata, so
 * the payment is matched even if they pay with a different email); falls back
 * to the plan's plain checkout link when the server can't create one.
 */
export async function accountCheckoutUrl(planId: string, period: BillingPeriod, fallbackHref: string): Promise<string> {
  try {
    const res: any = await apiPost('/billing/checkout', { planId, period })
    const url = (res?.data ?? res)?.url
    if (typeof url === 'string' && /^https:\/\//i.test(url)) return url
  } catch { /* fall back to the plain link */ }
  return fallbackHref
}
