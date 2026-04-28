# Security debt

Tracking transitive npm advisories that are not currently patched at the source. CI's audit gate (`.github/workflows/ci.yml`) runs at `--audit-level=critical` so these `high` items don't block merges. They should be cleared whenever the affected ranges' upstream consumers ship updates.

## Cleared (current as of 2026-04-28)

These are patched via `package.json` `overrides` or direct dependency bumps:

| Package | Strategy | Note |
|---|---|---|
| axios | bumped to `^1.15.2` | Was `^1.13.2`. Patches DoS via `__proto__` in `mergeConfig`. |
| lodash | bumped to `^4.18.1` | Was `^4.17.23`. Patches code injection via `_.template`. |
| `@hono/node-server` | override `^1.19.14` | Patches authorization bypass. |
| fast-xml-parser | override `^5.7.2` | Patches DoS via numeric entities. |
| path-to-regexp | override `^0.1.13` | Patches ReDoS in route matching. Stays within Express 4's compatible 0.1.x range. |
| picomatch | override `^2.3.2` | Patches POSIX char-class injection. |
| socket.io-parser | override `^4.2.6` | Patches unbounded binary attachments. |
| tar | override `^7.5.13` | Patches arbitrary file create/overwrite via hardlink path traversal. Knocks out the transitive `@mapbox/node-pre-gyp` advisory too. |
| undici | override `^7.25.0` | Patches unbounded decompression chain in fetch responses. |
| minimatch | override `^10.2.5` | Patches ReDoS via repeated wildcards. Forces all minimatch consumers to 10.x. Watch for regressions from consumers that were on 3.x, 5.x, or 9.x. |

## Outstanding

None at `high` or `critical` for runtime deps. `npm audit --omit=dev --audit-level=high` returns clean.

## How to refresh this list

```bash
npm audit --omit=dev --audit-level=high --json | jq '.vulnerabilities | to_entries | map(select(.value.severity == "high" or .value.severity == "critical")) | .[] | {name: .key, severity: .value.severity, range: .value.range}'
```

After adding / changing an override:

```bash
npm install --package-lock-only --no-audit --no-fund
npm audit --omit=dev --audit-level=high --json | jq '.metadata.vulnerabilities'
```
