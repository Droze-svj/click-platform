#!/usr/bin/env bash
# Launch a Click soak/load run against a target.
#
#   ./scripts/run-soak.sh <TARGET_URL> [DURATION_SECONDS] [ARRIVAL_RATE]
#
# Examples:
#   ./scripts/run-soak.sh https://sovereign-platform.onrender.com 900 5     # 15-min validation
#   ./scripts/run-soak.sh https://staging-host 172800 5                     # 48-HOUR soak
#
# Watch during the run: the target's /api/health (degrades to 503 if a dep
# falls over), Sentry for new errors, and host memory/CPU. See
# docs/soak-testing.md for the full runbook.
set -euo pipefail

TARGET="${1:-${SOAK_TARGET:-}}"
DURATION="${2:-900}"   # default 15 minutes
RATE="${3:-5}"         # requests/sec sustained

if [ -z "$TARGET" ]; then
  echo "ERROR: pass a target URL (or set SOAK_TARGET). e.g. ./scripts/run-soak.sh https://staging-host 172800 5" >&2
  exit 1
fi

REPORT="soak-report-$(date +%Y%m%d-%H%M%S).json"
echo "▶ Soak: target=$TARGET sustained=${DURATION}s @ ${RATE} rps → $REPORT"

SOAK_TARGET="$TARGET" npx --yes artillery@2 run tests/soak/soak.yml \
  --overrides "{\"config\":{\"phases\":[{\"name\":\"ramp\",\"duration\":60,\"arrivalRate\":1,\"rampTo\":${RATE}},{\"name\":\"sustained\",\"duration\":${DURATION},\"arrivalRate\":${RATE}}]}}" \
  --output "$REPORT"

echo "✔ Soak complete. Report: $REPORT  (view: npx artillery report $REPORT)"
