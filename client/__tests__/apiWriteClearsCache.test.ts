/**
 * A successful write clears the GET cache. /analytics/dashboard is cached for
 * 5 minutes, so Analytics → Refresh (POST sync-all, then re-read) and saving a
 * result both re-read the old numbers.
 */
import { api, apiGet, apiPost, apiDelete } from '../lib/api'

describe('GET cache after writes', () => {
  const realAdapter = (api.defaults as any).adapter
  let views = 100
  let gets = 0

  beforeEach(() => {
    views = 100
    gets = 0
    ;(api.defaults as any).adapter = async (config: any) => {
      if (config.method === 'get') gets += 1
      const data = config.method === 'get' ? { overview: { total_views: views } } : { success: true }
      return { data, status: 200, statusText: 'OK', headers: {}, config }
    }
  })
  afterAll(() => { (api.defaults as any).adapter = realAdapter })

  it('re-reads a cached endpoint after a POST', async () => {
    expect((await apiGet<any>('/analytics/dashboard')).overview.total_views).toBe(100)
    views = 5418
    // still cached without a write
    expect((await apiGet<any>('/analytics/dashboard')).overview.total_views).toBe(100)
    await apiPost('/analytics/platform/sync-all', { limit: 25 })
    expect((await apiGet<any>('/analytics/dashboard')).overview.total_views).toBe(5418)
    expect(gets).toBe(2)
  })

  it('re-reads after a DELETE too', async () => {
    await apiGet<any>('/analytics/dashboard')
    await apiDelete('/post-results/abc')
    views = 1
    expect((await apiGet<any>('/analytics/dashboard')).overview.total_views).toBe(1)
  })
})
