import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Return a simple ping response for debugging
  const url = new URL(request.url)
  const ts = url.searchParams.get('ts')
  const nonce = url.searchParams.get('nonce')

  return NextResponse.json({
    status: 'ok',
    timestamp: ts,
    nonce: nonce,
    server: 'nextjs',
    message: 'Debug ping successful'
  })
}
