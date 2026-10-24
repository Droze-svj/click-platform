// Billing page: real invoices are listed (in dollars), choosing Free opens the
// cancel flow instead of a fake "Upgrade started", and a plan without a
// checkout link never reports success.
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import BillingPage from '../app/dashboard/billing/page'
import * as api from '../lib/api'

const mockToast = jest.fn()

// Stable hook values, as in the app: the page's load effect depends on them.
const mockRouter = { push: jest.fn(), replace: jest.fn() }
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) => <a href={typeof href === 'string' ? href : '#'} {...rest}>{children}</a>,
}))
jest.mock('../lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  api: { get: jest.fn() },
  handleApiError: (e: any) => String(e?.message ?? e),
}))
// A stable t, like the real hook's useCallback (a fresh one each render would
// re-run the page's load effect forever).
const mockT = (k: string) => k
jest.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT, language: 'en', setLanguage: jest.fn(), isLoading: false }),
}))
jest.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mockToast, toasts: [], removeToast: jest.fn() }),
}))
const mockAuth = { user: { _id: 'u1', email: 'me@example.com', subscription: { plan: 'pro', status: 'active' } }, loading: false }
jest.mock('../hooks/useAuth', () => ({ useAuth: () => mockAuth }))
jest.mock('../hooks/useEntitlements', () => ({
  useEntitlements: () => ({ tier: 'pro', isEarlyAccess: false, loading: false, has: () => true }),
}))
jest.mock('../components/SubscriptionStatus', () => () => null)
jest.mock('../components/ToastContainer', () => () => null)
jest.mock('../lib/plans', () => {
  const actual = jest.requireActual('../lib/plans')
  return {
    ...actual,
    fetchPublicCatalog: jest.fn().mockResolvedValue(null),
    // No Whop links configured in this environment.
    PLANS: actual.PLANS.map((p: any) => ({ ...p, checkoutUrl: { monthly: '', yearly: '' } })),
  }
})

const mGet = api.apiGet as jest.Mock
const mPost = api.apiPost as jest.Mock

describe('Billing page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mGet.mockImplementation(async (url: string) => {
      if (url === '/billing/history') {
        return {
          success: true,
          data: {
            invoices: [{ _id: 'b1', invoiceNumber: 'INV-1', status: 'paid', invoice: { date: '2026-10-01', amount: { total: 29, currency: 'USD' }, items: [{ description: 'Click pro (monthly)' }] } }],
            changes: [],
          },
        }
      }
      return { success: true, data: { usage: {}, limits: {} } }
    })
  })

  it('lists the invoices from BillingHistory, in dollars', async () => {
    render(<BillingPage />)
    expect(await screen.findByText('Click pro (monthly)')).toBeInTheDocument()
    expect(screen.getByText('$29.00')).toBeInTheDocument()
  })

  it('choosing Free opens the cancel dialog and never posts /billing/upgrade', async () => {
    render(<BillingPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Start Free/ }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(mPost).not.toHaveBeenCalledWith('/billing/upgrade', expect.anything())
    expect(mockToast).not.toHaveBeenCalledWith(expect.anything(), 'success')
  })

  it('a paid plan without a checkout link is reported as unavailable, not started', async () => {
    render(<BillingPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Get Agency/ }))
    // Terms checkbox then confirm in the checkout dialog.
    const dialog = await screen.findByRole('dialog')
    const box = dialog.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    if (box) fireEvent.click(box)
    const confirm = Array.from(dialog.querySelectorAll('button')).filter((b) => !(b as HTMLButtonElement).disabled).pop() as HTMLButtonElement
    fireEvent.click(confirm)
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('billingPage.checkoutUnavailable', 'error'))
    expect(mockToast).not.toHaveBeenCalledWith(expect.stringMatching(/upgradeInitiated/), 'success')
    expect(mPost).not.toHaveBeenCalledWith('/billing/upgrade', expect.anything())
  })
})
