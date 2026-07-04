import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CalendarAutofillPanel from '../CalendarAutofillPanel'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
const mAutofill = api.autofillCalendar as jest.MockedFunction<typeof api.autofillCalendar>
const mApprove = api.approveCalendarPlan as jest.MockedFunction<typeof api.approveCalendarPlan>

describe('CalendarAutofillPanel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('generates drafts with the chosen options and lists them', async () => {
    mAutofill.mockResolvedValue({
      planId: 'cal_x', count: 2,
      posts: [
        { platform: 'tiktok', content: { text: 'Idea one' } },
        { platform: 'tiktok', content: { text: 'Idea two' } },
      ],
    } as any)

    render(<CalendarAutofillPanel />)
    fireEvent.change(screen.getByTestId('autofill-count'), { target: { value: '2' } })
    fireEvent.change(screen.getByTestId('autofill-topic'), { target: { value: 'hooks' } })
    fireEvent.click(screen.getByTestId('autofill-generate'))

    await waitFor(() => expect(screen.getByTestId('autofill-result')).toBeInTheDocument())
    expect(mAutofill).toHaveBeenCalledWith(
      expect.objectContaining({ count: 2, platforms: ['tiktok'], topic: 'hooks', optimalTimes: true }),
    )
    expect(screen.getAllByTestId('autofill-draft')).toHaveLength(2)
  })

  it('approves the plan after generating', async () => {
    mAutofill.mockResolvedValue({ planId: 'cal_x', count: 1, posts: [{ platform: 'tiktok', content: { text: 'x' } }] } as any)
    mApprove.mockResolvedValue({ planId: 'cal_x', approved: 1 } as any)

    render(<CalendarAutofillPanel />)
    fireEvent.click(screen.getByTestId('autofill-generate'))
    await waitFor(() => expect(screen.getByTestId('autofill-approve')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('autofill-approve'))
    await waitFor(() => expect(screen.getByTestId('autofill-approved')).toBeInTheDocument())
    expect(mApprove).toHaveBeenCalledWith('cal_x')
  })

  it('surfaces a generation error', async () => {
    mAutofill.mockRejectedValue(new Error('over budget'))
    render(<CalendarAutofillPanel />)
    fireEvent.click(screen.getByTestId('autofill-generate'))
    await waitFor(() => expect(screen.getByTestId('autofill-error')).toHaveTextContent('over budget'))
  })
})
