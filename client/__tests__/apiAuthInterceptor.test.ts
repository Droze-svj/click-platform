/**
 * Raw `axios.*(`${API_URL}/…`)` and fetch('/api/…') calls used to go out with
 * no Authorization header: fine locally (dev auth bypass), a 401 on every one
 * of them in production. lib/api now attaches the session token to them.
 */
import axios from 'axios'

describe('session token on raw API calls', () => {
  let seen: Record<string, string | undefined>
  const realFetch = window.fetch

  beforeAll(() => {
    window.fetch = jest.fn(async (input: any, init?: any) => {
      const h = new Headers(init?.headers)
      seen[String(typeof input === 'string' ? input : input.url)] = h.get('Authorization') || undefined
      return { ok: true, status: 200, json: async () => ({}) }
    }) as any
    // Load after the fetch stub so the wrapper wraps it.
    require('../lib/api')
  })
  afterAll(() => { window.fetch = realFetch })

  beforeEach(() => {
    seen = {}
    localStorage.setItem('token', 'tok-123')
  })

  const viaAxios = async (url: string, headers?: Record<string, string>) => {
    let auth: string | undefined
    await axios.get(url, {
      headers,
      adapter: async (config) => {
        const h: any = config.headers
        auth = typeof h.get === 'function' ? h.get('Authorization') : h.Authorization
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      },
    })
    return auth
  }

  it('adds the token to default-axios calls to the API', async () => {
    expect(await viaAxios('/api/content/abc')).toBe('Bearer tok-123')
  })

  it('leaves other hosts, token-minting routes and explicit headers alone', async () => {
    expect(await viaAxios('https://example.com/api-ish')).toBeUndefined()
    expect(await viaAxios('/api/auth/login')).toBeUndefined()
    expect(await viaAxios('/api/x', { Authorization: 'Bearer mine' })).toBe('Bearer mine')
  })

  it('adds the token to fetch calls to the API only', async () => {
    await window.fetch('/api/compliance/rules')
    await window.fetch('https://cdn.example.com/x.json')
    expect(seen['/api/compliance/rules']).toBe('Bearer tok-123')
    expect(seen['https://cdn.example.com/x.json']).toBeUndefined()
  })
})
