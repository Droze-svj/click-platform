# Security debt

Tracking npm advisories for runtime deps. CI's audit gate
(`.github/workflows/ci.yml` `security` job) runs at `--audit-level=high` for
production deps, so no new `high`/`critical` advisory can merge unnoticed. The
overrides are mirrored in both `overrides` (npm / `npm ci`) and `pnpm.overrides`
(the Docker/pnpm build) so both package managers get the patches.

## Cleared (current as of 2026-06-29)

Production `npm audit`: **0 critical, 0 high.** Patched via direct bumps +
`overrides`:

| Package | Strategy | Note |
|---|---|---|
| axios | bumped to `^1.17.0` | Patches NO_PROXY bypass (incomplete fix for CVE-2025-62718) + earlier `mergeConfig` DoS. |
| mongoose | bumped to `^8.24.0` | Patches `$nor` NoSQL-injection in `sanitizeFilter`. Stays within major 8. |
| postcss | bumped to `^8.5.15` | Patches XSS via unescaped `</style>` in stringify. |
| lodash | bumped to `^4.18.1` | Code injection via `_.template`. |
| ws | override `^8.21.0` | Uninitialized memory disclosure. Clears the engine.io / socket.io-adapter advisories too. |
| qs | override `^6.15.2` | arrayLimit bypass DoS. Clears express/body-parser qs advisories. |
| tmp | override `^0.2.7` | Path traversal via unsanitized prefix/postfix. |
| follow-redirects | override `^1.16.0` | Leaks auth headers on cross-domain redirect. |
| dompurify | override `^3.4.8` | XSS bypass. |
| bn.js | override `^5.2.3` | Infinite loop. |
| brace-expansion | override `^2.0.2` | Large-range `max` DoS. |
| fast-xml-parser | override `^5.8.0` | DoS + builder attribute-quote bypass. |
| `@hono/node-server` | override `^1.19.14` | Authorization bypass. |
| path-to-regexp | override `^0.1.13` | ReDoS (within Express 4's 0.1.x). |
| picomatch | override `^2.3.2` | POSIX char-class injection. |
| socket.io-parser | override `^4.2.6` | Unbounded binary attachments. |
| tar | override `^7.5.13` | Hardlink path-traversal. |
| undici | override `^7.27.3` | Unbounded decompression; bumped 2026-06-29 to clear new highs (TLS bypass via SOCKS5, Set-Cookie/header injection, cache poisoning). Stays within major 7. |
| minimatch | override `^10.2.5` | ReDoS via repeated wildcards. |
| form-data | override `^4.0.6` | (2026-06-29) CRLF injection via unescaped multipart field names/filenames. Transitive; pinned to the 4.x patch. |
| nodemailer | bumped to `^9.0.1` | (2026-06-29) Direct dep. Fixes SMTP command injection (envelope.size, EHLO/HELO CRLF), List-* header injection, jsonTransport file-access bypass, OAuth2 TLS validation, raw-option SSRF/file-read. The only fix is the v9 major; the createTransport/sendMail API Click uses is unchanged. |

## Outstanding (4 moderate, accepted)

All require a **semver-major** bump of a direct dep and have **low real
exploitability** for how Click uses them; deferred to avoid breaking a
market-ready app. None are `high`/`critical`.

| Package | Advisory | Why deferred |
|---|---|---|
| nodemailer | SMTP injection via `envelope.size` | Needs v8 (major). Mail is sent with fixed config; `envelope.size` is never user-set. |
| uuid | bounds check in v3/v5/v6 when `buf` provided | Needs v14 (ESM-only, breaks `require()`). Click uses `uuidv4()` with no `buf`. |
| exceljs | transitive `uuid` | Fix needs a major exceljs change; same low-risk uuid path. |
| node-cron | transitive `uuid` | Needs v4 (major); same low-risk uuid path. |

## How to refresh this list

```bash
npm audit --omit=dev --audit-level=high --json | jq '.vulnerabilities | to_entries | map(select(.value.severity == "high" or .value.severity == "critical")) | .[] | {name: .key, severity: .value.severity, range: .value.range}'
```

After adding / changing an override:

```bash
npm install --package-lock-only --no-audit --no-fund
npm audit --omit=dev --audit-level=high --json | jq '.metadata.vulnerabilities'
```
