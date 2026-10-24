/**
 * Surfaces that used to show invented numbers or fake success now show real
 * API values, "—", or an honest error:
 *  - EngagementCommandCenter rendered getMockData() (128.5K views) on any error.
 *  - ArbitrageSteererView's "Steer Engine" made no API call (console.log toast).
 *  - FiscalAutonomyHUD hard-coded "Alpha Access (Whop)" nodes and a 22% advisory.
 *  - RegionalComplianceView showed "99.8% CERTAINTY" and treated the server's
 *    failure fallback ({ overallStatus: 'PASS' }) as a pass.
 *  - AdvancedSchedulingHub showed "Daily Diffusion Pattern — T-Minus 4h" and an
 *    iCal feed URL for a route that doesn't exist.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import * as api from '../../lib/api'

jest.mock('../../lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  handleApiError: (e: any) => String(e?.message ?? e),
}))
jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, string>) => (p ? `${k} ${JSON.stringify(p)}` : k),
    language: 'en', setLanguage: jest.fn(), isLoading: false,
  }),
}))
const showToast = jest.fn()
jest.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast, toasts: [], removeToast: jest.fn() }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { _id: 'u1', name: 'Dev' }, loading: false }),
}))
jest.mock('../ToastContainer', () => () => null)
jest.mock('framer-motion', () => {
  const strip = ({ children, initial, animate, exit, transition, whileHover, whileTap, layout, layoutId, variants, ...p }: any) => <div {...p}>{children}</div>
  return {
    m: new Proxy({}, { get: () => strip }),
    motion: new Proxy({}, { get: () => strip }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useReducedMotion: () => true,
  }
})

const mGet = api.apiGet as jest.Mock
const mPost = api.apiPost as jest.Mock

beforeEach(() => {
  mGet.mockReset()
  mPost.mockReset()
  showToast.mockReset()
})

describe('EngagementCommandCenter', () => {
  const Comp = require('../EngagementCommandCenter').default

  it('shows an error with retry instead of mock data when the API fails', async () => {
    mGet.mockRejectedValue(new Error('boom'))
    render(<Comp />)
    await waitFor(() => expect(screen.getByText('engagementCommandCenter.loadFailed')).toBeInTheDocument())
    expect(screen.queryByText(/128\.5/)).not.toBeInTheDocument()
    expect(screen.getByText('engagementCommandCenter.retry')).toBeInTheDocument()
  })

  it('computes totals from the real post rows', async () => {
    mGet.mockResolvedValue({
      success: true,
      data: {
        posts: [
          { postId: 'p1', platform: 'tiktok', views: 1000, likes: 40, comments: 5, shares: 5, potencyScore: null, anomalies: [] },
          { postId: 'p2', platform: 'youtube', views: 1000, likes: 50, comments: 0, shares: 0, potencyScore: null, anomalies: [] },
        ],
      },
    })
    render(<Comp />)
    await waitFor(() => expect(screen.getByText('2.0K')).toBeInTheDocument())
    expect(screen.getByText('5.0%')).toBeInTheDocument() // 100 engagements / 2000 views
  })

  it('shows an empty state when there are no published posts', async () => {
    mGet.mockResolvedValue({ success: true, data: { peakVelocityPost: null, posts: [] }, isFallback: true })
    render(<Comp />)
    await waitFor(() => expect(screen.getByText('engagementCommandCenter.emptyTitle')).toBeInTheDocument())
  })
})

describe('ArbitrageSteererView', () => {
  const { ArbitrageSteererView } = require('../editor/views/ArbitrageSteererView')

  it('records the choice through the real steer endpoint', async () => {
    const offer = { id: 'o1', name: 'Course', platform: 'whop', cvr: 0.02, pcv: 50, category: 'whop', tags: [], priority: 1 }
    mGet.mockResolvedValue({ activeSteer: offer, manifest: [offer], recommendation: 'Only one active offer (Course).' })
    mPost.mockResolvedValue({ status: 'steered', offerId: 'o1', offerName: 'Course' })
    render(<ArbitrageSteererView />)
    await waitFor(() => expect(screen.getByText('Mark as preferred')).toBeInTheDocument())
    expect(screen.queryByText(/94\.2%|42ms|ACTIVE STEER/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Mark as preferred'))
    await waitFor(() => expect(mPost).toHaveBeenCalledWith('/phase10_12/arbitrage/steer', { offerId: 'o1' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Course'), 'success'))
  })

  it('shows an empty state with no offers instead of crashing', async () => {
    mGet.mockResolvedValue({ activeSteer: null, manifest: [], recommendation: 'No active monetization offers to steer toward.' })
    render(<ArbitrageSteererView />)
    await waitFor(() => expect(screen.getByText('No active monetization offers to steer toward.')).toBeInTheDocument())
  })
})

describe('FiscalAutonomyHUD', () => {
  const { FiscalAutonomyHUD } = require('../editor/views/FiscalAutonomyHUD')

  it('lists only the real offers and no invented advisory', async () => {
    mGet.mockImplementation((url: string) =>
      url.includes('fiscal-velocity')
        ? Promise.resolve({ velocity: 1, rpd: 2, epc: 0.5, pulseRevenue: 24, pulseClicks: 48 })
        : Promise.resolve([{ id: 'x', name: 'My Product', platform: 'whop', conversions: 3, conversionRate: 0.1, pcv: 20 }])
    )
    render(<FiscalAutonomyHUD />)
    await waitFor(() => expect(screen.getByText('My Product')).toBeInTheDocument())
    expect(screen.queryByText(/Alpha Access|22% yield|Vultr|Zero-Drift/)).not.toBeInTheDocument()
    expect(screen.getByText('$1.00/hr')).toBeInTheDocument()
  })
})

describe('RegionalComplianceView', () => {
  const { RegionalComplianceView } = require('../editor/views/RegionalComplianceView')

  it('treats the server failure fallback as "could not complete", not a pass', async () => {
    mPost.mockResolvedValue({ overallStatus: 'PASS', requiresHumanOverride: false })
    render(<RegionalComplianceView />)
    fireEvent.change(screen.getByLabelText('Script or transcript'), { target: { value: 'hello world' } })
    fireEvent.click(screen.getByText('Run check'))
    await waitFor(() => expect(screen.getByText(/couldn't be completed/)).toBeInTheDocument())
    expect(screen.queryByText(/99\.8%/)).not.toBeInTheDocument()
    expect(screen.queryByText('Looks fine')).not.toBeInTheDocument()
  })
})

describe('AdvancedSchedulingHub', () => {
  const Comp = require('../scheduler/AdvancedSchedulingHub').default

  it('has no fake recursion row or dead iCal feed', async () => {
    mGet.mockImplementation((url: string) => {
      if (url === '/scheduler') return Promise.resolve({ success: true, data: [] })
      if (url === '/scheduler/analytics') return Promise.resolve({ success: true, total: 0, byStatus: { active: 3 } })
      return Promise.resolve([])
    })
    render(<Comp />)
    await waitFor(() => expect(screen.getByText('advancedSchedulingHub.noPosts')).toBeInTheDocument())
    fireEvent.click(screen.getByText('advancedSchedulingHub.tabRecurring'))
    expect(screen.queryByText(/Daily Diffusion|T-Minus/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('advancedSchedulingHub.tabExport'))
    expect(screen.queryByText(/api\.click\.app|\.ics$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/OPTIMIZING|STANDBY/)).not.toBeInTheDocument()
  })
})
