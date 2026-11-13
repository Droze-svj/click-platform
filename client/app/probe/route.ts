import { NextResponse } from 'next/server'
import { devOnlyNotFound } from '@/lib/devOnlyRoute'

export async function GET(request: Request) {
  const hidden = devOnlyNotFound()
  if (hidden) return hidden
  // eslint-disable-next-line no-console
  console.log('[next-probe]', {
    url: request.url,
    ua: request.headers.get('user-agent')?.slice(0, 80) || null,
  })

  // Debug instrumentation disabled

  return NextResponse.json({ ok: true, ts: Date.now() })
}


