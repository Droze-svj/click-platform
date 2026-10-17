import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MorningBriefPanel from '../MorningBriefPanel'
import * as api from '@/lib/featuresApi'

jest.mock('@/lib/featuresApi')
jest.mock('@/lib/api', () => ({
  handleApiError: (e: any) => e?.message ?? '',
}))
const mBrief = api.getMorningBrief as jest.MockedFunction<typeof api.getMorningBrief>
const mGetSub = api.getBriefSubscription as jest.MockedFunction<typeof api.getBriefSubscription>
const mSetSub = api.setBriefSubscription as jest.MockedFunction<typeof api.setBriefSubscription>

const EMPTY: api.MorningBrief = {
  generatedAt: '2026-10-17T06:00:00Z',
  performance: null,
  sales: null,
  audience: { window: 'Comments and DMs from the last 7 days', scanned: 0, questions: 0, leads24h: 0, themes: [] },
  needsYou: [],
  makeNext: { source: 'baseline', title: 'Answer the question you hear most', why: 'Not enough comments or history yet.' },
  hasData: false,
}

const FULL: api.MorningBrief = {
  ...EMPTY,
  performance: { window: 'Posts published in the last 7 days', views: 12400, viewsChangePct: 18, engagement: 640, engagementChangePct: -5 },
  sales: { currency: 'USD', last24h: { count: 2, revenue: 994 }, revenueChangePct: 100, last7d: { count: 6, revenue: 2982 } },
  audience: { ...EMPTY.audience, scanned: 14, questions: 9, themes: [{ theme: 'microphone', count: 4, example: 'What microphone do you use?' }] },
  needsYou: [{ id: 'signoffs', count: 1, label: '1 sign-off waiting in Approvals', link: '/dashboard/approvals' }],
  makeNext: { source: 'audience', title: 'Answer this: "What microphone do you use?"', why: '"microphone" came up in 4 separate questions this week.' },
  hasData: true,
}

describe('MorningBriefPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mGetSub.mockResolvedValue({ subscription: null, deliveryActive: true })
  })

  it('renders make-next, numbers, audience asks and needs-you from real data', async () => {
    mBrief.mockResolvedValue(FULL)
    render(<MorningBriefPanel />)
    await waitFor(() => expect(screen.getByTestId('brief-make-next')).toHaveTextContent('What microphone do you use?'))
    expect(screen.getByTestId('brief-performance')).toHaveTextContent('12,400 views (+18%)')
    expect(screen.getByTestId('brief-performance')).toHaveTextContent('640 engagements (-5%)')
    expect(screen.getByTestId('brief-sales')).toHaveTextContent('2 in 24h · $994 (+100%)')
    expect(screen.getByTestId('brief-sales')).toHaveTextContent('6 this week · $2,982')
    expect(screen.getAllByTestId('brief-theme')[0]).toHaveTextContent('4× “What microphone do you use?”')
    expect(screen.getByText('1 sign-off waiting in Approvals →')).toHaveAttribute('href', '/dashboard/approvals')
  })

  it('says plainly when there is no data instead of showing zeros', async () => {
    mBrief.mockResolvedValue(EMPTY)
    render(<MorningBriefPanel />)
    await waitFor(() => expect(screen.getByTestId('brief-performance')).toHaveTextContent(/No analytics yet/))
    expect(screen.getByTestId('brief-sales')).toHaveTextContent(/No tracked sales/)
    expect(screen.getByTestId('brief-audience')).toHaveTextContent(/No repeated questions yet/)
    expect(screen.queryByTestId('brief-needs-you')).not.toBeInTheDocument()
    expect(screen.getByTestId('brief-make-next')).toHaveTextContent('Answer the question you hear most')
  })

  it('surfaces a load error', async () => {
    mBrief.mockRejectedValue(new Error('server down'))
    render(<MorningBriefPanel />)
    await waitFor(() => expect(screen.getByTestId('brief-error')).toHaveTextContent('server down'))
  })

  it('subscribes to daily delivery in the browser timezone', async () => {
    mBrief.mockResolvedValue(EMPTY)
    mSetSub.mockResolvedValue({ subscription: { enabled: true, timezone: 'Europe/Rome', hour: 7, lastSentLocalDate: null }, deliveryActive: true })
    render(<MorningBriefPanel />)
    await waitFor(() => expect(screen.getByTestId('brief-delivery')).toHaveTextContent('Send daily at 07:00'))
    fireEvent.click(screen.getByTestId('brief-delivery'))

    await waitFor(() => expect(screen.getByTestId('brief-delivery')).toHaveTextContent('Daily at 07:00 ✓'))
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    expect(mSetSub).toHaveBeenCalledWith({ enabled: true, timezone: tz, hour: 7 })
    expect(screen.getByTestId('brief-delivery-note')).toHaveTextContent('Arrives as a notification around 07:00 Europe/Rome time.')
  })

  it('never promises a notification when this server has delivery switched off', async () => {
    mBrief.mockResolvedValue(EMPTY)
    mGetSub.mockResolvedValue({ subscription: { enabled: true, timezone: 'Europe/Rome', hour: 7, lastSentLocalDate: null }, deliveryActive: false })
    render(<MorningBriefPanel />)
    await waitFor(() => expect(screen.getByTestId('brief-delivery-note')).toHaveTextContent(/not switched on for this server/))
  })

  it('turns delivery off', async () => {
    mBrief.mockResolvedValue(EMPTY)
    mGetSub.mockResolvedValue({ subscription: { enabled: true, timezone: 'Europe/Rome', hour: 7, lastSentLocalDate: null }, deliveryActive: true })
    mSetSub.mockResolvedValue({ subscription: { enabled: false, timezone: 'Europe/Rome', hour: 7, lastSentLocalDate: null }, deliveryActive: true })
    render(<MorningBriefPanel />)
    await waitFor(() => expect(screen.getByTestId('brief-delivery')).toHaveTextContent('Daily at 07:00 ✓'))
    fireEvent.click(screen.getByTestId('brief-delivery'))
    await waitFor(() => expect(mSetSub).toHaveBeenCalledWith(expect.objectContaining({ enabled: false })))
    await waitFor(() => expect(screen.getByTestId('brief-delivery')).toHaveTextContent('Send daily at 07:00'))
  })
})
