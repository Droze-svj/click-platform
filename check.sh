#!/bin/bash
# Quick backend health check. The detailed /api/health endpoint reports
# "status":"ok" when healthy (or "degraded" when a dependency is down), so we
# match on that rather than the basic /health route's "healthy".
PORT="${PORT:-5001}"
echo "Checking API health on http://localhost:${PORT}/api/health ..."

BODY=$(curl -s -m 5 "http://localhost:${PORT}/api/health")

if echo "$BODY" | grep -q '"status":"ok"'; then
  echo "✅ API healthy"
  exit 0
fi

echo "❌ API not healthy (status not ok)"
echo "$BODY"
exit 1
