import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HookGeneratorPanel from '../HookGeneratorPanel'
import RepurposeStudioPanel from '../RepurposeStudioPanel'
import * as api from '@/lib/featuresApi'

// When the AI is unavailable the generators now answer 503 with a reason, and a
// repurpose variant the AI could not adapt is flagged `degraded`. The panels
// show the server's reason (not axios' "status code 503") and an empty state.
jest.mock('@/hooks/useTranslation', () => require('@/mocks/useTranslationEn'))
jest.mock('@/lib/featuresApi')
const mHooks = api.generateHooks as jest.MockedFunction<typeof api.generateHooks>
const mRepurpose = api.repurposeStudio as jest.MockedFunction<typeof api.repurposeStudio>

const http503 = (msg: string) => Object.assign(new Error('Request failed with status code 503'), {
  response: { status: 503, data: { success: false, error: msg } },
})

describe('creator tools: honest AI failure', () => {
  beforeEach(() => jest.clearAllMocks())

  it("shows the server's 503 reason", async () => {
    mHooks.mockRejectedValue(http503('The AI could not produce hooks right now. Try again in a moment.'))
    render(<HookGeneratorPanel />)
    fireEvent.change(screen.getByTestId('hooks-input'), { target: { value: 'coffee' } })
    fireEvent.click(screen.getByTestId('hooks-run'))
    await waitFor(() => expect(screen.getByTestId('hooks-error')).toHaveTextContent('could not produce hooks'))
  })

  it('an empty result shows an empty state instead of nothing', async () => {
    mHooks.mockResolvedValue({ platform: 'tiktok', style: 'mix', hooks: [] } as any)
    render(<HookGeneratorPanel />)
    fireEvent.change(screen.getByTestId('hooks-input'), { target: { value: 'coffee' } })
    fireEvent.click(screen.getByTestId('hooks-run'))
    await waitFor(() => expect(screen.getByTestId('hooks-empty')).toBeInTheDocument())
    expect(screen.queryByTestId('hooks-results')).toBeNull()
  })

  it('a degraded repurpose variant is labelled as the original text', async () => {
    mRepurpose.mockResolvedValue({
      variants: [{ platform: 'tiktok', content: 'src', hashtags: [], score: null, suggestions: [], aspectRatio: '9:16', format: 'vertical', degraded: true }],
      count: 1,
    } as any)
    render(<RepurposeStudioPanel />)
    fireEvent.change(screen.getByTestId('repurpose-input'), { target: { value: 'src' } })
    fireEvent.click(screen.getByTestId('repurpose-run'))
    await waitFor(() => expect(screen.getByTestId('repurpose-degraded')).toBeInTheDocument())
  })
})
