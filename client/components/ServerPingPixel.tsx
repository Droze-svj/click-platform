import crypto from 'crypto'

/**
 * Server-side "ping pixel" to force a browser request that proves which Next server/origin
 * the user is actually hitting, even if client JS fails to run.
 *
 * NOTE: This is intentionally NOT a client component.
 */
export default function ServerPingPixel() {
  const nonce = crypto.randomUUID()
  const ts = Date.now()
  // Ping both:
  // 1) same-origin via Next (/api rewrite)
  // 2) backend directly (CORS doesn't apply to <img>, so this proves the browser can reach :5001 even if proxying is broken)
  const srcSameOrigin = `/api/debug/ping?ts=${ts}&nonce=${encodeURIComponent(nonce)}`
  const srcDirectBackend = `http://localhost:5001/api/debug/ping?ts=${ts}&nonce=${encodeURIComponent(nonce)}`

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={srcSameOrigin} alt="" width={1} height={1} style={{ display: 'none' }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={srcDirectBackend} alt="" width={1} height={1} style={{ display: 'none' }} />
    </>
  )
}


