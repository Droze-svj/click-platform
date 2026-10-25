import { render, screen, fireEvent } from '@testing-library/react'
import AiTimelineChat, { parseTimelineIntent } from '../AiTimelineChat'

jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}))

describe('parseTimelineIntent', () => {
  it('maps grade names (longest first) to registry ids', () => {
    expect(parseTimelineIntent('make it cinematic')).toMatchObject({ kind: 'grade', gradeId: 'cinematic' })
    expect(parseTimelineIntent('give it a film noir look')).toMatchObject({ kind: 'grade', gradeId: 'film-noir' })
    expect(parseTimelineIntent('black and white please')).toMatchObject({ kind: 'grade', gradeId: 'bw' })
  })
  it('recognises frame shapes', () => {
    expect(parseTimelineIntent('format for TikTok')).toEqual({ kind: 'aspect', ratio: '9:16' })
    expect(parseTimelineIntent('make it square')).toEqual({ kind: 'aspect', ratio: '1:1' })
  })
  it('takes title text only from quotes', () => {
    expect(parseTimelineIntent('add title "TikTok tips"')).toEqual({ kind: 'text', text: 'TikTok tips' })
    expect(parseTimelineIntent('add a title')).toEqual({ kind: 'text', text: null })
  })
  it('reads speeds', () => {
    expect(parseTimelineIntent('play at 1.5x')).toEqual({ kind: 'speed', speed: 1.5 })
    expect(parseTimelineIntent('slow motion')).toEqual({ kind: 'speed', speed: 0.5 })
  })
  it('admits when nothing matched', () => {
    expect(parseTimelineIntent('order me a pizza')).toEqual({ kind: 'none' })
  })
})

describe('AiTimelineChat', () => {
  const send = (text: string) => {
    fireEvent.change(screen.getByLabelText('aiTimelineChat.placeholder'), { target: { value: text } })
    fireEvent.submit(screen.getByLabelText('aiTimelineChat.placeholder').closest('form')!)
  }

  it('applies a grade through the real setter and says so', () => {
    const onApplyGrade = jest.fn(() => true)
    render(<AiTimelineChat onApplyGrade={onApplyGrade} onAddText={jest.fn()} />)
    send('make it warm')
    expect(onApplyGrade).toHaveBeenCalledWith('warm')
    expect(screen.getByText(/aiTimelineChat.appliedGrade/)).toBeInTheDocument()
  })

  it('opens Export for a frame-shape request instead of claiming a change', () => {
    const onOpenExport = jest.fn()
    render(<AiTimelineChat onApplyGrade={jest.fn()} onAddText={jest.fn()} onOpenExport={onOpenExport} />)
    send('vertical for reels')
    expect(onOpenExport).toHaveBeenCalled()
    expect(screen.getByText(/aiTimelineChat.aspectOpenExport/)).toBeInTheDocument()
  })

  it('changes nothing and says so when the request is not understood', () => {
    const onApplyGrade = jest.fn(() => true)
    const onAddText = jest.fn()
    render(<AiTimelineChat onApplyGrade={onApplyGrade} onAddText={onAddText} />)
    send('order me a pizza')
    expect(onApplyGrade).not.toHaveBeenCalled()
    expect(onAddText).not.toHaveBeenCalled()
    expect(screen.getByText('aiTimelineChat.notUnderstood')).toBeInTheDocument()
  })

  it('reports a grade the editor could not apply', () => {
    render(<AiTimelineChat onApplyGrade={() => false} onAddText={jest.fn()} />)
    send('vintage')
    expect(screen.getByText(/aiTimelineChat.gradeNotApplied/)).toBeInTheDocument()
  })
})
