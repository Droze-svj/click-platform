export const runtime = 'nodejs'

export async function GET(req: Request) {
  const marker = 'run31-which-build'
  const ts = Date.now()
  try {
    const url = new URL(req.url)
    const headersObj: Record<string, string> = {}
    try {
      // Keep only non-sensitive headers
      for (const k of ['host', 'user-agent', 'referer', 'origin']) {
        const v = req.headers.get(k)
        if (v) headersObj[k] = v.slice(0, 200)
      }
    } catch {}

    // Debug instrumentation disabled
  } catch {}

  return new Response(
    JSON.stringify({
      ok: true,
      marker,
      ts,
      nodeEnv: process.env.NODE_ENV || null,
      nextPublicApiUrl: process.env.NEXT_PUBLIC_API_URL || null,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Debug-Marker': 'run31',
      },
    }
  )
}


