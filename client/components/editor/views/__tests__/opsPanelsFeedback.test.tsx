/**
 * Ops panels used to swallow failures with console.error (the user saw a button
 * stop spinning and nothing else), and RemediationHUD rendered an `actionPlan`
 * the server never sent. They now toast failures and render what the server
 * actually returns.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { RemediationHUD } from '../RemediationHUD'
import { CulturalArbitrageHUD } from '../CulturalArbitrageHUD'
import { SyndicateConsensusView } from '../SyndicateConsensusView'
import * as api from '../../../../lib/api'

jest.mock('../../../../lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  handleApiError: (e: any) => String(e?.message ?? e),
}))
jest.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k),
    language: 'en', setLanguage: jest.fn(), isLoading: false,
  }),
}))

const mGet = api.apiGet as jest.Mock
const mPost = api.apiPost as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe('RemediationHUD', () => {
  it('renders the plan the server returns and toasts that it is scheduled', async () => {
    mPost.mockResolvedValue({ success: true, status: 'SCHEDULED', actionPlan: [{ type: 'ADJUST_VOLUME', value: 30 }], window: { start: 2, end: 6 } })
    const toast = jest.fn()
    render(<RemediationHUD contentId="c1" showToast={toast} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run auto-fix' }))
    await waitFor(() => expect(screen.getByText('ADJUST VOLUME')).toBeInTheDocument())
    expect(screen.getByText('editorPanels.remediation.planned')).toBeInTheDocument()
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('editorPanels.remediation.scheduledToast'), 'info')
  })

  it('says no fix is needed instead of "not checked yet"', async () => {
    mPost.mockResolvedValue({ success: true, status: 'CLEAN', actionPlan: [], commentsChecked: 4 })
    render(<RemediationHUD contentId="c1" showToast={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run auto-fix' }))
    await waitFor(() => expect(screen.getByText(/editorPanels\.remediation\.noFixesNeeded/)).toBeInTheDocument())
  })

  it('toasts a failure', async () => {
    mPost.mockRejectedValue(new Error('Content not found'))
    const toast = jest.fn()
    render(<RemediationHUD contentId="c1" showToast={toast} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run auto-fix' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining('Content not found'), 'error'))
  })
})

describe('CulturalArbitrageHUD', () => {
  it('toasts a failed scan and shows an honest empty state', async () => {
    mGet.mockRejectedValue(new Error('offline'))
    const toast = jest.fn()
    render(<CulturalArbitrageHUD showToast={toast} />)
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining('offline'), 'error'))
    expect(screen.getByText('editorPanels.culturalArbitrage.noCandidates')).toBeInTheDocument()
  })

  it('toasts a failed repost', async () => {
    mGet.mockImplementation(async (url: string) => (url.includes('resurrection')
      ? [{ originalPostId: 'p1', contentId: null, title: 'Old hit', historicalViews: 12000, historicalEngagement: 600, ageInDays: 120, signalStrength: 80 }]
      : []))
    mPost.mockRejectedValue(new Error('Content is already being recycled'))
    const toast = jest.fn()
    render(<CulturalArbitrageHUD showToast={toast} />)
    fireEvent.click(await screen.findByRole('button', { name: /Deploy Resurrection/i }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining('already being recycled'), 'error'))
  })
})

describe('SyndicateConsensusView', () => {
  it('toasts a failed review', async () => {
    mPost.mockRejectedValue(new Error('A proposal object is required'))
    const toast = jest.fn()
    render(<SyndicateConsensusView showToast={toast} />)
    fireEvent.click(screen.getByRole('button', { name: /INITIATE COUNCIL DEBATE/i }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining('A proposal object is required'), 'error'))
  })
})
