/**
 * Catch-all proxy for `/api/*` → Express server on localhost:5001.
 *
 * Why this exists
 * ───────────────
 * Next.js's app router treats the `app/api/` folder as fully owned: any
 * `/api/*` path that doesn't match a `route.ts` handler returns the framework's
 * 404 page rather than falling through to `next.config.js` rewrites. With four
 * stub route handlers already present (auth/me, uploads/[...path],
 * debug/ping, debug/recovery), the rewrite was being shadowed and every API
 * call from the browser was 404-ing.
 *
 * Behaviour
 * ─────────
 * • This handler runs LAST because more specific routes win in app router.
 * • It streams the request body + headers through to the Express backend and
 *   pipes the response back, preserving status, body, and headers.
 * • Multipart uploads, chunked transfers, and binary responses all work
 *   because we forward the raw `Body` and don't materialise it as JSON.
 * • If the backend is offline the user sees a clear 502 instead of HTML.
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BACKEND = process.env.BACKEND_URL || 'http://localhost:5001'

async function proxy(req: NextRequest, slug: string[]) {
  const path = '/api/' + slug.join('/')
  const search = req.nextUrl.search || ''
  const url = `${BACKEND}${path}${search}`

  // Strip headers that confuse Node's fetch when re-issuing a request.
  const headers = new Headers(req.headers)
  headers.delete('host')
  headers.delete('connection')
  headers.delete('content-length')
  // Forward the chosen language header explicitly — most callers already
  // include it, but the language middleware on the backend depends on it.
  // No-op if absent.

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
    // Body is only valid on non-GET/HEAD methods; pass through as a stream.
    ...(req.method !== 'GET' && req.method !== 'HEAD'
      ? { body: req.body, duplex: 'half' } as any
      : {}),
  }

  let upstream: Response
  try {
    upstream = await fetch(url, init)
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `Upstream unreachable: ${err?.message || 'connection refused'}` },
      { status: 502 }
    )
  }

  // Forward the raw body and headers. Strip hop-by-hop / Next-incompatible
  // headers so the dev server doesn't choke on encoded bodies it can't
  // re-decode (Node's fetch already decoded the upstream gzip stream, so
  // returning content-encoding: gzip downstream would double-decode).
  const respHeaders = new Headers(upstream.headers)
  respHeaders.delete('content-encoding')
  respHeaders.delete('content-length')
  respHeaders.delete('transfer-encoding')
  respHeaders.delete('connection')

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  })
}

type Ctx = { params: Promise<{ slug: string[] }> | { slug: string[] } }

async function resolveSlug(ctx: Ctx): Promise<string[]> {
  const p = ctx.params instanceof Promise ? await ctx.params : ctx.params
  return p?.slug || []
}

export async function GET(req: NextRequest, ctx: Ctx)    { return proxy(req, await resolveSlug(ctx)) }
export async function POST(req: NextRequest, ctx: Ctx)   { return proxy(req, await resolveSlug(ctx)) }
export async function PUT(req: NextRequest, ctx: Ctx)    { return proxy(req, await resolveSlug(ctx)) }
export async function PATCH(req: NextRequest, ctx: Ctx)  { return proxy(req, await resolveSlug(ctx)) }
export async function DELETE(req: NextRequest, ctx: Ctx) { return proxy(req, await resolveSlug(ctx)) }
export async function OPTIONS(req: NextRequest, ctx: Ctx){ return proxy(req, await resolveSlug(ctx)) }
