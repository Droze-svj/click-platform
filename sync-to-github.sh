#!/bin/bash
# Sync local project to GitHub for collaboration
# Run: ./sync-to-github.sh

set -e
cd "$(dirname "$0")"

echo "📥 Fetching latest from GitHub..."
git fetch origin

echo ""
echo "📊 Checking sync status..."
if git diff --quiet origin/main..HEAD 2>/dev/null; then
    echo "Local is behind or same as origin. Pulling any new changes..."
    git pull origin main --no-edit 2>/dev/null || true
fi

echo ""
echo "📦 Staging all changes..."
git add -A

if git diff --cached --quiet; then
    echo "✅ Nothing to commit - already in sync with your staged work."
else
    echo ""
    echo "💾 Committing changes..."
    git commit -m "Sync: Full project update - manual video editing, voice hooks, advanced features, and collaboration-ready state"
    
    echo ""
    echo "📤 Pushing to GitHub..."
    git push origin main
fi

echo ""
echo "✅ Sync complete! Your project is now updated on GitHub."
echo "   Repository: https://github.com/Droze-svj/click-platform"
echo ""
echo "For collaboration workflow:"
echo "  • Pull before starting work:  git pull origin main"
echo "  • Push when done:             git push origin main"
echo "  • Create branches for features: git checkout -b feature-name"
