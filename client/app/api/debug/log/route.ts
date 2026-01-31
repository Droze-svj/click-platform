import { NextResponse } from 'next/server'

// Rate limiting for debug logs
const rateLimit = new Map<string, { count: number, resetTime: number }>()
// Increase rate limit in development to prevent blocking debug logs
const MAX_REQUESTS_PER_MINUTE = process.env.NODE_ENV === 'development' ? 1000 : 100

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

export async function GET() {
  try {
    const g = global as any
    const logs = g.__debugLogs || []
    return NextResponse.json({
      logs: logs.slice(-50), // Return last 50 entries
      total: logs.length,
      timestamp: Date.now()
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // Add CORS headers to ensure the route works from any origin in development
    const headers = new Headers()
    if (process.env.NODE_ENV === 'development') {
      headers.set('Access-Control-Allow-Origin', '*')
      headers.set('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS')
      headers.set('Access-Control-Allow-Headers', 'Content-Type')
    }

    // In development, disable rate limiting entirely to prevent blocking debug logs
    // In production, use rate limiting to prevent abuse
    if (process.env.NODE_ENV === 'production') {
      const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      const now = Date.now()
      const windowStart = Math.floor(now / 60000) * 60000 // 1 minute windows

      if (!rateLimit.has(clientIP)) {
        rateLimit.set(clientIP, { count: 0, resetTime: windowStart + 60000 })
      }

      const clientLimit = rateLimit.get(clientIP)!
      if (now > clientLimit.resetTime) {
        clientLimit.count = 0
        clientLimit.resetTime = windowStart + 60000
      }

      if (clientLimit.count >= MAX_REQUESTS_PER_MINUTE) {
        // Return a proper JSON response for rate limiting
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }

      clientLimit.count++
    }

    const body = await req.json().catch((err) => {
      // If JSON parsing fails, return early with a proper response
      return null
    })

    // If body is null, it means JSON parsing failed - return early
    if (body === null) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const safeBody = redact(body)

    // Enhanced debug logging with component categorization
    console.log(`[${safeBody.component || 'Debug'}] ${safeBody.message}:`, {
      ...safeBody.data,
      timestamp: new Date(safeBody.data?.timestamp || Date.now()).toISOString()
    })

    // Store debug data in memory for the session (in production this would go to a proper logging service)
    if (typeof global !== 'undefined') {
      const g = global as any
      if (!g.__debugLogs) g.__debugLogs = []
      g.__debugLogs.push({
        timestamp: Date.now(),
        component: safeBody.component,
        message: safeBody.message,
        data: safeBody.data
      })

      // Keep only last 1000 entries to prevent memory leaks
      if (g.__debugLogs.length > 1000) {
        g.__debugLogs = g.__debugLogs.slice(-1000)
      }
    }

    // Never block the app on debug logging - return 204 No Content
    return new NextResponse(null, { status: 204, headers })
  } catch (err) {
    // Don't log debug endpoint errors to avoid infinite loops
    // Return a proper JSON error response instead of empty 500
    const errorHeaders = new Headers()
    if (process.env.NODE_ENV === 'development') {
      errorHeaders.set('Access-Control-Allow-Origin', '*')
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: errorHeaders })
  }
}

export async function DELETE() {
  try {
    if (typeof global !== 'undefined') {
      const g = global as any
      g.__debugLogs = []
    }
    return NextResponse.json({ 
      success: true, 
      message: 'Logs cleared successfully',
      timestamp: Date.now()
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}


