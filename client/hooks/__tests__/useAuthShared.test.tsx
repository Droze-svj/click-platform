import { render, screen, waitFor, act } from '@testing-library/react'
import { useAuth } from '../useAuth'

const mockGet = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('../../lib/api', () => ({ apiGet: (...a: any[]) => mockGet(...a) }))

// The header, sidebar and page each call useAuth() at the same time. Only one
// fetches /auth/me; the others used to wait and never take its result, so they
// showed the "Creator" fallback (or stayed "loading") forever.
function Who({ id }: { id: string }) {
  const { user, loading } = useAuth() as any
  return <span data-testid={id}>{loading ? 'loading' : user?.name || 'Creator'}</span>
}

beforeEach(() => {
  mockGet.mockReset()
  localStorage.clear()
  window.history.pushState({}, '', '/dashboard')
})

test('every component using useAuth gets the signed-in user from one /auth/me call', async () => {
  localStorage.setItem('token', 'T1')
  let release: (v: any) => void = () => {}
  mockGet.mockImplementation(() => new Promise((r) => { release = r }))

  render(<><Who id="header" /><Who id="sidebar" /><Who id="page" /></>)
  await act(async () => { release({ user: { id: 'u1', name: 'Portal Tester' } }) })

  await waitFor(() => {
    expect(screen.getByTestId('header')).toHaveTextContent('Portal Tester')
    expect(screen.getByTestId('sidebar')).toHaveTextContent('Portal Tester')
    expect(screen.getByTestId('page')).toHaveTextContent('Portal Tester')
  })
  expect(mockGet).toHaveBeenCalledTimes(1)
})

test('a new token is fetched even right after a check for an old token; late mounts never hang', async () => {
  localStorage.setItem('token', 'T2')
  mockGet.mockResolvedValue({ data: { user: { id: 'u2', name: 'Second User' } } })
  const first = render(<Who id="first" />)
  await waitFor(() => expect(screen.getByTestId('first')).toHaveTextContent('Second User'))
  expect(mockGet).toHaveBeenCalledTimes(1)
  first.unmount()

  render(<Who id="late" />)
  await waitFor(() => expect(screen.getByTestId('late')).toHaveTextContent('Second User'))
})
