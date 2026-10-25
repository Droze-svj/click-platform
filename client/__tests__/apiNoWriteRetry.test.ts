/**
 * Writes must never be re-sent. lib/api used to retry every request (POST
 * included) up to twice on 5xx and client timeouts, so a render or publish
 * that timed out client-side while still running server-side was started
 * again. Reads keep their retry.
 */
import { api, apiGet, apiPost } from '../lib/api'

jest.setTimeout(20000)

describe('retries apply to reads only', () => {
  let calls: Record<string, number>
  const realAdapter = (api.defaults as any).adapter

  beforeEach(() => {
    calls = {}
    ;(api.defaults as any).adapter = async (config: any) => {
      const key = `${config.method?.toUpperCase()} ${config.url}`
      calls[key] = (calls[key] || 0) + 1
      const err: any = new Error('Service Unavailable')
      err.config = config
      err.response = { status: 503, data: { success: false }, headers: {}, config }
      throw err
    }
  })
  afterAll(() => { (api.defaults as any).adapter = realAdapter })

  it('sends a failing POST exactly once', async () => {
    await expect(apiPost('/video/render', { a: 1 })).rejects.toBeTruthy()
    expect(calls['POST /video/render']).toBe(1)
  })

  it('still retries a failing GET', async () => {
    await expect(apiGet('/content/list-x', undefined, false)).rejects.toBeTruthy()
    expect(calls['GET /content/list-x']).toBe(3)
  })
})
