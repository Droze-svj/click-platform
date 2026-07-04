import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HookGeneratorPanel from '../HookGeneratorPanel'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
const mHooks = api.generateHooks as jest.MockedFunction<typeof api.generateHooks>

describe('HookGeneratorPanel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('validates empty topic without calling the API', () => {
    render(<HookGeneratorPanel />)
    fireEvent.click(screen.getByTestId('hooks-run'))
    expect(screen.getByTestId('hooks-error')).toHaveTextContent(/topic or paste your script/i)
    expect(mHooks).not.toHaveBeenCalled()
  })

  it('generates hooks with the chosen platform + style and lists them', async () => {
    mHooks.mockResolvedValue({
      platform: 'tiktok', style: 'contrarian',
      hooks: [{ text: 'Stop posting daily.', style: 'contrarian' }, { text: 'Nobody tells you this.', style: 'contrarian' }],
    })

    render(<HookGeneratorPanel />)
    fireEvent.change(screen.getByTestId('hooks-platform'), { target: { value: 'tiktok' } })
    fireEvent.change(screen.getByTestId('hooks-style'), { target: { value: 'contrarian' } })
    fireEvent.change(screen.getByTestId('hooks-input'), { target: { value: 'posting cadence' } })
    fireEvent.click(screen.getByTestId('hooks-run'))

    await waitFor(() => expect(screen.getAllByTestId('hooks-item')).toHaveLength(2))
    expect(mHooks).toHaveBeenCalledWith({ topic: 'posting cadence', platform: 'tiktok', style: 'contrarian' })
    expect(screen.getByText('Stop posting daily.')).toBeInTheDocument()
  })

  it('surfaces an API error', async () => {
    mHooks.mockRejectedValue(new Error('rate limited'))
    render(<HookGeneratorPanel />)
    fireEvent.change(screen.getByTestId('hooks-input'), { target: { value: 'x' } })
    fireEvent.click(screen.getByTestId('hooks-run'))
    await waitFor(() => expect(screen.getByTestId('hooks-error')).toHaveTextContent('rate limited'))
  })

  it('copies a hook to the clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    mHooks.mockResolvedValue({ platform: 'instagram', style: 'mix', hooks: [{ text: 'Hook A', style: 'mix' }] })

    render(<HookGeneratorPanel />)
    fireEvent.change(screen.getByTestId('hooks-input'), { target: { value: 't' } })
    fireEvent.click(screen.getByTestId('hooks-run'))
    await waitFor(() => expect(screen.getByTestId('hooks-item')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('hooks-copy'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Hook A'))
    expect(screen.getByTestId('hooks-copy')).toHaveTextContent('Copied ✓')
  })
})
