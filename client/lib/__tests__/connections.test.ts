import { isPlatformConnected } from '../connections'

test('an empty account list is NOT connected (every new user saw "Connected 7")', () => {
  const fresh = { twitter: [], tiktok: [], youtube: [], instagram: [], linkedin: [], facebook: [], google: [] }
  expect(Object.values(fresh).filter(isPlatformConnected)).toHaveLength(0)
})

test.each([
  [[{ id: 'acct1' }], true],
  [{ connected: true }, true],
  [{ connected: false }, false],
  [{ handle: '@me' }, true],
  [null, false],
  [undefined, false],
  [true, true],
  [false, false],
])('%p → %p', (value, expected) => {
  expect(isPlatformConnected(value)).toBe(expected)
})
