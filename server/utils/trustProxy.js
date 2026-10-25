// trustProxy — which proxy hops Express may believe when it reads
// X-Forwarded-For / X-Forwarded-Proto, so req.ip is the real visitor.
//
// Production traffic goes visitor → Cloudflare → Render's load balancer → app.
// Without a 'trust proxy' setting req.ip was the load balancer's private
// address, so every per-IP rate limit (5 failed logins / 15 min, uploads,
// anonymous renders) was one bucket shared by everybody: five bad passwords
// from anyone locked every user out of sign-in.
//
// We trust only hops that can't be the visitor: private/loopback addresses
// (Render's internal network) and Cloudflare's published edge ranges. Express
// walks X-Forwarded-For from the right and stops at the first untrusted
// address, so a visitor who sends their own X-Forwarded-For can't pick their
// IP — Cloudflare appends the address it actually saw. Someone calling the
// onrender.com origin directly gets their real address too (their hop isn't
// trusted).
//
// TRUST_PROXY overrides: 'false' disables, a number is a hop count, anything
// else is a comma-separated list of addresses/CIDRs/proxy-addr keywords.

// https://www.cloudflare.com/ips-v4 and /ips-v6 (fetched 2026-10-24).
const CLOUDFLARE_RANGES = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
  '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
];

// loopback, link-local and private (10/8, 172.16/12, 192.168/16, fc00::/7)
// plus carrier-grade NAT space, which some PaaS networks use internally.
const INTERNAL_RANGES = ['loopback', 'linklocal', 'uniquelocal', '100.64.0.0/10'];

function trustProxySetting(env = process.env) {
  const raw = String(env.TRUST_PROXY ?? '').trim();
  if (!raw) return [...INTERNAL_RANGES, ...CLOUDFLARE_RANGES];
  if (/^(false|0|off|no)$/i.test(raw)) return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

module.exports = { trustProxySetting, CLOUDFLARE_RANGES, INTERNAL_RANGES };
