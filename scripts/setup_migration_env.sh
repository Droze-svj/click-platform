#!/bin/zsh
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
DEST="/Users/orlandhino/click-platform-repair"

echo "Running pnpm install on $DEST with internal store..."
pnpm --prefix "$DEST" install --shamefully-hoist --store-dir /Users/orlandhino/.pnpm-store

echo "Generating Prisma Client..."
node "$DEST/node_modules/.bin/prisma" generate --schema="$DEST/prisma/schema.prisma"
