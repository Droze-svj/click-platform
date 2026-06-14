/**
 * urlGuard.js — SSRF protection for any server-side URL fetch.
 *
 * The platform pulls remote video by URL (see routes/ingest.js, downloadUtils.js
 * and the Repurpose Studio). Without a guard, an authed user can point those
 * fetchers at internal services — `http://localhost:5001/...`, the cloud metadata
 * endpoint `http://169.254.169.254/...`, or any RFC-1918 host — and use Click as
 * an SSRF proxy for internal recon. This module is the single chokepoint that
 * blocks that.
 *
 * Two layers:
 *   - isBlockedIp(ip)        pure, synchronous range check (unit-testable, no DNS)
 *   - assertPublicUrl(url)   parse + protocol check + DNS resolve + per-IP check.
 *                            MUST be called on every redirect hop (anti DNS-rebind):
 *                            a hostname that resolved public on hop 1 can resolve
 *                            private on hop 2, so we re-validate the *resolved IP*
 *                            of each URL we actually connect to.
 */

'use strict';

const net = require('net');
const dns = require('dns');

class BlockedUrlError extends Error {
  constructor(message, ctx) {
    super(message);
    this.name = 'BlockedUrlError';
    this.statusCode = 400;
    this.ctx = ctx || {};
  }
}

/** Parse a dotted-quad IPv4 string to its 32-bit unsigned integer, or null. */
function ipv4ToLong(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let long = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    long = long * 256 + n;
  }
  return long >>> 0;
}

/** True if an IPv4 (as 32-bit long) falls inside base/maskBits CIDR. */
function inCidr(long, baseIp, maskBits) {
  const base = ipv4ToLong(baseIp);
  if (base === null || long === null) return false;
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (long & mask) === (base & mask);
}

// RFC-1918 / special-use IPv4 ranges that must never be reachable from a
// user-supplied URL. Includes loopback, link-local (incl. cloud metadata
// 169.254.169.254), CGNAT, and the "this host" / broadcast edges.
const BLOCKED_V4_CIDRS = [
  ['0.0.0.0', 8],       // "this" network
  ['10.0.0.0', 8],      // private
  ['100.64.0.0', 10],   // CGNAT
  ['127.0.0.0', 8],     // loopback
  ['169.254.0.0', 16],  // link-local (cloud metadata lives here)
  ['172.16.0.0', 12],   // private
  ['192.0.0.0', 24],    // IETF protocol assignments
  ['192.168.0.0', 16],  // private
  ['198.18.0.0', 15],   // benchmarking
  ['255.255.255.255', 32], // broadcast
];

/**
 * Pure range check. Accepts IPv4, IPv6, or IPv4-mapped IPv6 (::ffff:a.b.c.d).
 * Returns true when the address is private/loopback/link-local/reserved and so
 * must be blocked. Unknown/unparseable input fails CLOSED (returns true).
 */
function isBlockedIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  let addr = ip.trim();
  if (!addr) return true;

  // Strip zone id (fe80::1%eth0) and brackets ([::1]).
  addr = addr.replace(/%.*$/, '').replace(/^\[|\]$/g, '');

  const family = net.isIP(addr);

  if (family === 4) {
    const long = ipv4ToLong(addr);
    if (long === null) return true;
    return BLOCKED_V4_CIDRS.some(([base, bits]) => inCidr(long, base, bits));
  }

  if (family === 6) {
    const lower = addr.toLowerCase();
    // Unspecified / loopback.
    if (lower === '::' || lower === '::1') return true;
    // IPv4-mapped (::ffff:127.0.0.1) and IPv4-compatible — re-check as IPv4.
    const mapped = lower.match(/(?:^|:)((?:\d{1,3}\.){3}\d{1,3})$/);
    if (mapped) return isBlockedIp(mapped[1]);
    // Unique-local fc00::/7 (fc.. / fd..).
    if (/^f[cd][0-9a-f]{2}:/.test(lower) || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // Link-local fe80::/10.
    if (/^fe[89ab][0-9a-f]:/.test(lower) || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
    return false;
  }

  // Not a recognisable IP literal → fail closed.
  return true;
}

/**
 * Resolve every A/AAAA address for a hostname and return them. IP literals
 * resolve to themselves (no DNS needed) so this also works offline for the
 * loopback/metadata test cases.
 */
async function resolveAll(hostname) {
  if (net.isIP(hostname)) return [hostname];
  const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

/**
 * Validate a single URL we are about to fetch. Throws BlockedUrlError when:
 *   - it isn't a parseable http(s) URL, or
 *   - any resolved IP is private/loopback/link-local/reserved.
 * Returns the parsed URL on success.
 *
 * Call this for the initial URL AND on every redirect hop.
 *
 * @param {string} rawUrl
 * @returns {Promise<URL>}
 */
async function assertPublicUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError('Invalid URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new BlockedUrlError(`Unsupported protocol "${u.protocol}"`);
  }
  const hostname = u.hostname.replace(/^\[|\]$/g, '');
  let addresses;
  try {
    addresses = await resolveAll(hostname);
  } catch (e) {
    throw new BlockedUrlError(`Could not resolve host "${hostname}"`, { cause: e.message });
  }
  if (!addresses.length) throw new BlockedUrlError(`Host "${hostname}" resolved to no addresses`);
  for (const addr of addresses) {
    if (isBlockedIp(addr)) {
      throw new BlockedUrlError(`URL resolves to a blocked address (${addr})`, { hostname, addr });
    }
  }
  return u;
}

module.exports = {
  assertPublicUrl,
  isBlockedIp,
  BlockedUrlError,
};
