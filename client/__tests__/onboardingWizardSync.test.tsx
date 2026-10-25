// The quiz answers are saved to the account. Those PUTs used to be fired and
// forgotten (.catch(() => {})); a failure now shows a non-blocking notice with
// a retry, and onboarding carries on either way.
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import OnboardingWizard from '../components/OnboardingWizard'
import * as api from '@/lib/api'

jest.mock('@/lib/api', () => ({ apiPut: jest.fn() }))
const mockT = (k: string) => k
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: mockT }) }))
jest.mock('@/hooks/useWorkspacePrefs', () => ({ useWorkspacePrefs: () => ({ setDefaultLanding: jest.fn() }) }))
jest.mock('framer-motion', () => ({
  m: new Proxy({}, { get: () => ({ children, initial, animate, exit, transition, ...p }: any) => <div {...p}>{children}</div> }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

const mPut = api.apiPut as jest.Mock
const click = (text: string) => fireEvent.click(screen.getByText(text).closest('button')!)

function finishQuiz() {
  click('onboardingPage.niche_finance'); click('onboardingWizard.continue')
  click('onboardingWizard.platformTiktok'); click('onboardingWizard.continue')
  click('onboardingWizard.goalViralLabel'); click('onboardingWizard.configureMyAi')
  click('onboardingWizard.configureMyAi')
}

describe('OnboardingWizard account sync', () => {
  beforeEach(() => { jest.clearAllMocks(); localStorage.clear() })

  it('shows a retry notice when saving fails, and retrying clears it', async () => {
    mPut.mockRejectedValue(new Error('offline'))
    render(<OnboardingWizard onComplete={jest.fn()} />)
    finishQuiz()
    expect(await screen.findByText('onboardingWizard.syncFailed')).toBeInTheDocument()
    // Onboarding moved on to the welcome step regardless.
    expect(screen.getByText('onboardingWizard.aiStackReady')).toBeInTheDocument()

    mPut.mockResolvedValue({ success: true })
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }))
    await waitFor(() => expect(screen.queryByText('onboardingWizard.syncFailed')).toBeNull())
  })

  it('shows no notice when saving works', async () => {
    mPut.mockResolvedValue({ success: true })
    render(<OnboardingWizard onComplete={jest.fn()} />)
    finishQuiz()
    await waitFor(() => expect(mPut).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('onboardingWizard.syncFailed')).toBeNull()
  })

  it('sends a niche and goal the server knows (not creator types the AI maps to "other")', async () => {
    mPut.mockResolvedValue({ success: true })
    render(<OnboardingWizard onComplete={jest.fn()} />)
    finishQuiz()
    await waitFor(() => expect(mPut).toHaveBeenCalledWith('/me/ai-preferences', expect.anything()))
    const body = mPut.mock.calls.find((c) => c[0] === '/me/ai-preferences')[1]
    expect(body.defaults.niche).toBe('finance')
    expect(body.defaults.goals).toEqual(['more_views'])
  })
})
