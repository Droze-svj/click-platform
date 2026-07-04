import {
  parseCommentLines,
  groupTriageByPriority,
  priorityMeta,
  trendMeta,
  compactNumber,
  PRIORITY_ORDER,
} from '../featureViewModels'
import type { TriagedComment } from '../featuresApi'

const c = (text: string, priority: any, score = 0): TriagedComment =>
  ({ text, priority, score, intent: 'other' })

describe('parseCommentLines', () => {
  it('splits non-empty trimmed lines into comment inputs', () => {
    expect(parseCommentLines('  a \n\n b \n')).toEqual([{ text: 'a' }, { text: 'b' }])
    expect(parseCommentLines('')).toEqual([])
  })
})

describe('groupTriageByPriority', () => {
  it('groups in display order, omitting empty buckets', () => {
    const groups = groupTriageByPriority([
      c('praise', 'low'), c('q', 'high'), c('spam', 'ignore'), c('q2', 'high'),
    ])
    expect(groups.map((g) => g.priority)).toEqual(['high', 'low', 'ignore']) // no 'medium'
    expect(groups[0].comments.map((x) => x.text)).toEqual(['q', 'q2'])
  })
  it('empty input → no groups', () => {
    expect(groupTriageByPriority([])).toEqual([])
  })
})

describe('priorityMeta', () => {
  it('has a label+tone for every priority', () => {
    for (const p of PRIORITY_ORDER) {
      expect(priorityMeta(p).label).toBeTruthy()
      expect(priorityMeta(p).tone).toMatch(/^text-/)
    }
  })
})

describe('trendMeta', () => {
  it('renders direction, tone, and signed pct', () => {
    expect(trendMeta('up', 100)).toMatchObject({ arrow: '▲', tone: 'text-green-400', label: 'Up +100%' })
    expect(trendMeta('down', -20)).toMatchObject({ arrow: '▼', label: 'Down -20%' })
    expect(trendMeta('new', null)).toMatchObject({ arrow: '✦', label: 'New' })
    expect(trendMeta('stable', 3)).toMatchObject({ label: 'Flat (+3%)' })
  })
})

describe('compactNumber', () => {
  it('formats thousands and millions', () => {
    expect(compactNumber(950)).toBe('950')
    expect(compactNumber(1500)).toBe('1.5k')
    expect(compactNumber(2_400_000)).toBe('2.4M')
    expect(compactNumber(undefined)).toBe('0')
  })
})
