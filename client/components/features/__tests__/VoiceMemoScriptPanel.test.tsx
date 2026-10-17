import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VoiceMemoScriptPanel from '../VoiceMemoScriptPanel'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
jest.mock('@/lib/api', () => ({
  handleApiError: (e: any) => e?.message ?? '',
}))
const mTranscribe = api.transcribeMemo as jest.MockedFunction<typeof api.transcribeMemo>
const mWrite = api.writeMemoScript as jest.MockedFunction<typeof api.writeMemoScript>
const mSave = api.saveMemoScript as jest.MockedFunction<typeof api.saveMemoScript>

const RESULT: api.MemoScriptResult = {
  platform: 'youtube',
  format: 'long',
  script: {
    title: 'Why nobody buys',
    hook: 'You post every day. Nobody buys.',
    body: ['Your first 3 seconds sell the video.', 'Lead with the buyer problem.'],
    cta: 'Comment HOOK for my openers.',
    brollCues: ['beat 1: empty checkout page'],
    claims: [],
  },
  qa: {
    passed: false,
    estimatedSeconds: 12,
    checks: [
      { id: 'hook-length', ok: true, message: 'Hook is 6 words, short enough to land in 3 seconds.' },
      { id: 'runtime', ok: false, message: 'About 12s spoken; the target is 240-720s.' },
    ],
  },
  markdown: '# Hook\n\nYou post every day. Nobody buys.\n',
}

describe('VoiceMemoScriptPanel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('validates an empty memo without calling the API', () => {
    render(<VoiceMemoScriptPanel />)
    fireEvent.click(screen.getByTestId('memo-run'))
    expect(screen.getByTestId('memo-error')).toHaveTextContent(/record a memo or type/i)
    expect(mWrite).not.toHaveBeenCalled()
  })

  it('hides the record button where the browser cannot record', () => {
    render(<VoiceMemoScriptPanel />)
    expect(screen.queryByTestId('memo-record')).not.toBeInTheDocument()
    expect(screen.getByTestId('memo-file')).toBeInTheDocument()
  })

  it('transcribes an uploaded memo into the editable transcript box', async () => {
    mTranscribe.mockResolvedValue({ transcript: 'hook idea, coffee shops' })
    render(<VoiceMemoScriptPanel />)
    const file = new File(['bytes'], 'memo.m4a', { type: 'audio/mp4' })
    fireEvent.change(screen.getByTestId('memo-file'), { target: { files: [file] } })

    await waitFor(() => expect(screen.getByTestId('memo-input')).toHaveValue('hook idea, coffee shops'))
    expect(mTranscribe).toHaveBeenCalledWith(file, 'memo.m4a')
  })

  it('shows the server reason when transcription is unavailable', async () => {
    mTranscribe.mockRejectedValue(new Error('Transcription is not configured on this server.'))
    render(<VoiceMemoScriptPanel />)
    fireEvent.change(screen.getByTestId('memo-file'), { target: { files: [new File(['x'], 'm.mp3', { type: 'audio/mpeg' })] } })
    await waitFor(() => expect(screen.getByTestId('memo-error')).toHaveTextContent(/not configured/))
  })

  it('writes a script with the chosen platform + format and renders hook/body/cta + QA', async () => {
    mWrite.mockResolvedValue(RESULT)
    render(<VoiceMemoScriptPanel />)
    fireEvent.change(screen.getByTestId('memo-input'), { target: { value: 'raw thoughts about hooks' } })
    fireEvent.change(screen.getByTestId('memo-platform'), { target: { value: 'youtube' } })
    fireEvent.change(screen.getByTestId('memo-format'), { target: { value: 'long' } })
    fireEvent.click(screen.getByTestId('memo-run'))

    await waitFor(() => expect(screen.getByTestId('memo-result')).toBeInTheDocument())
    expect(mWrite).toHaveBeenCalledWith({ memo: 'raw thoughts about hooks', platform: 'youtube', format: 'long' })
    expect(screen.getByTestId('memo-hook')).toHaveTextContent('You post every day. Nobody buys.')
    expect(screen.getByTestId('memo-body').querySelectorAll('li')).toHaveLength(2)
    expect(screen.getByTestId('memo-cta')).toHaveTextContent('Comment HOOK')
    expect(screen.getByTestId('memo-qa')).toHaveTextContent(/needs a look/)
    expect(screen.getAllByTestId('memo-qa-item')).toHaveLength(2)
    expect(screen.getByText(/target is 240-720s/)).toBeInTheDocument()
  })

  it('surfaces a script API error', async () => {
    mWrite.mockRejectedValue(new Error('Script writing is temporarily unavailable.'))
    render(<VoiceMemoScriptPanel />)
    fireEvent.change(screen.getByTestId('memo-input'), { target: { value: 'x' } })
    fireEvent.click(screen.getByTestId('memo-run'))
    await waitFor(() => expect(screen.getByTestId('memo-error')).toHaveTextContent(/temporarily unavailable/))
  })

  async function renderWithScript() {
    mWrite.mockResolvedValue(RESULT)
    render(<VoiceMemoScriptPanel />)
    fireEvent.change(screen.getByTestId('memo-input'), { target: { value: 'x' } })
    fireEvent.click(screen.getByTestId('memo-run'))
    await waitFor(() => expect(screen.getByTestId('memo-approve')).toBeInTheDocument())
  }

  it('sends the script for approval and links to Scripts + Approvals', async () => {
    mSave.mockResolvedValue({ scriptId: 's1', approvalId: 'a1' })
    await renderWithScript()
    fireEvent.click(screen.getByTestId('memo-approve'))

    await waitFor(() => expect(screen.getByTestId('memo-saved')).toBeInTheDocument())
    expect(mSave).toHaveBeenCalledWith({ script: RESULT.script, format: 'long', requestApproval: true })
    expect(screen.getByText('Open in Scripts')).toHaveAttribute('href', '/dashboard/scripts/s1')
    expect(screen.getByText(/Waiting for your sign-off/)).toHaveAttribute('href', '/dashboard/approvals')
    expect(screen.queryByTestId('memo-approve')).not.toBeInTheDocument()
  })

  it('saves without approval, and says so when only the approval step failed', async () => {
    mSave.mockResolvedValue({ scriptId: 's1', approvalId: null, approvalError: 'Could not create the approval request.' })
    await renderWithScript()
    fireEvent.click(screen.getByTestId('memo-save'))

    await waitFor(() => expect(screen.getByTestId('memo-saved')).toBeInTheDocument())
    expect(mSave).toHaveBeenCalledWith(expect.objectContaining({ requestApproval: false }))
    expect(screen.queryByText(/Waiting for your sign-off/)).not.toBeInTheDocument()
    expect(screen.getByText(/Could not create the approval request/)).toBeInTheDocument()
  })

  it('surfaces a save error and keeps the buttons', async () => {
    mSave.mockRejectedValue(new Error('Provide a script with a hook, body and CTA'))
    await renderWithScript()
    fireEvent.click(screen.getByTestId('memo-save'))
    await waitFor(() => expect(screen.getByTestId('memo-error')).toHaveTextContent(/hook, body and CTA/))
    expect(screen.getByTestId('memo-save')).toBeInTheDocument()
  })

  it('copies script.md to the clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    mWrite.mockResolvedValue(RESULT)
    render(<VoiceMemoScriptPanel />)
    fireEvent.change(screen.getByTestId('memo-input'), { target: { value: 'x' } })
    fireEvent.click(screen.getByTestId('memo-run'))
    await waitFor(() => expect(screen.getByTestId('memo-copy')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('memo-copy'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(RESULT.markdown))
    expect(screen.getByTestId('memo-copy')).toHaveTextContent('Copied ✓')
  })
})
