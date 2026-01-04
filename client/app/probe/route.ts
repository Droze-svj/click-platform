import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // eslint-disable-next-line no-console
  console.log('[next-probe]', {
    url: request.url,
    ua: request.headers.get('user-agent')?.slice(0, 80) || null,
  })

  // Debug instrumentation disabled

  return NextResponse.json({ ok: true, ts: Date.now() })
}


