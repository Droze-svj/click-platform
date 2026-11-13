import { NextResponse } from 'next/server'
import { devOnlyNotFound } from '@/lib/devOnlyRoute'

export async function GET(request: Request) {
  const hidden = devOnlyNotFound()
  if (hidden) return hidden

  return NextResponse.json({ ok: true, ts: Date.now() })
}


