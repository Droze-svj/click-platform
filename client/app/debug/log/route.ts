import { NextResponse } from 'next/server'
import { devOnlyNotFound } from '@/lib/devOnlyRoute'

const INGEST =
  'http://127.0.0.1:5556/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a'

function redact(input: any): any {
  if (!input || typeof input !== 'object') return input

  // shallow clone + targeted redaction
  const out: any = Array.isArray(input) ? [...input] : { ...input }
  for (const k of Object.keys(out)) {
    const key = String(k).toLowerCase()
    if (
      key.includes('token') ||
      key.includes('password') ||
      key.includes('authorization') ||
      key.includes('cookie') ||
      key.includes('apikey') ||
      key.includes('api_key')
    ) {
      out[k] = '[REDACTED]'
      continue
    }
    // avoid deep recursion; redact common nested bag
    if (k === 'data' && out[k] && typeof out[k] === 'object') {
      out[k] = redact(out[k])
    }
  }
  return out
}

export async function POST(req: Request) {
  const hidden = devOnlyNotFound()
  if (hidden) return hidden
  try {
    console.log('🔍 DEBUG API: Received request')
    const body = await req.json().catch(() => ({}))
    console.log('🔍 DEBUG API: Body received:', body)
    const safeBody = redact(body)

    // Debug logging disabled

    // Never block the app on debug logging
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('🔍 DEBUG API: Error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}


