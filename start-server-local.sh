#!/bin/bash
# ============================================================
# start-server-local.sh
# Copies the server directory OUT of iCloud Drive before starting,
# so Node.js isn't affected by iCloud's file-read hangs (ECANCELED).
# ============================================================

set -e

ROOT_DIR="/Users/orlandhino/Library/Mobile Documents/com~apple~CloudDocs/WHOP AI V3"
TMP_SERVER="/tmp/click-platform-server"

echo "🔄 Copying server files out of iCloud Drive to /tmp ..."
mkdir -p "$TMP_SERVER"

# Use ditto (macOS native) which handles iCloud files well
ditto "$ROOT_DIR/server" "$TMP_SERVER/server"
ditto "$ROOT_DIR/package.json" "$TMP_SERVER/package.json"

# Copy .env files
for f in .env .env.local .env.nosync .env.local.nosync; do
  [ -f "$ROOT_DIR/$f" ] && cp "$ROOT_DIR/$f" "$TMP_SERVER/$f" || true
done

# Use the existing node_modules (already outside iCloud via symlink → node_modules.nosync)
ln -sfn "$ROOT_DIR/node_modules.nosync" "$TMP_SERVER/node_modules"

echo "✅ Files copied successfully."
echo "🚀 Starting server from /tmp ..."

# Start server from the tmp directory
cd "$TMP_SERVER"
NODE_ENV=development node server/index.js
