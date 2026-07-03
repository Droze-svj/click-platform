import { paths } from '../featuresApi'

describe('featuresApi.paths', () => {
  it('never prefixes /api (apiGet/apiPost already do)', () => {
    for (const build of Object.values(paths)) {
      const p = (build as (...a: any[]) => string)('x', 1)
      expect(p.startsWith('/api')).toBe(false)
      expect(p.startsWith('/')).toBe(true)
    }
  })

  it('builds streak with the unit query', () => {
    expect(paths.streak()).toBe('/streak?unit=week')
    expect(paths.streak('day')).toBe('/streak?unit=day')
  })

  it('builds optimal-slots with encoded platform + count', () => {
    expect(paths.optimalSlots('tiktok', 7)).toBe('/schedule/optimal-slots?platform=tiktok&count=7')
  })

  it('omits undefined query params', () => {
    expect(paths.calendarDrafts()).toBe('/calendar/drafts')
    expect(paths.calendarDrafts(20)).toBe('/calendar/drafts?limit=20')
    expect(paths.calendarDrafts(20, 40)).toBe('/calendar/drafts?limit=20&skip=40')
  })

  it('encodes ids in path segments', () => {
    expect(paths.calendarApprove('cal_ab/cd')).toBe('/calendar/plans/cal_ab%2Fcd/approve')
    expect(paths.responderApprove('a b')).toBe('/responder/a%20b/approve')
  })

  it('covers the responder + repurpose + first-comment endpoints', () => {
    expect(paths.responderDraft()).toBe('/responder/draft')
    expect(paths.responderReject('x')).toBe('/responder/x/reject')
    expect(paths.responderSend('x')).toBe('/responder/x/send')
    expect(paths.repurposeStudio()).toBe('/repurpose/studio')
    expect(paths.repurposeSchedule()).toBe('/repurpose/studio/schedule')
    expect(paths.firstComment()).toBe('/first-comment')
    expect(paths.digestLatest()).toBe('/digest/latest')
    expect(paths.triage()).toBe('/triage')
  })
})
