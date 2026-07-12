#!/bin/bash
# setup_venv.sh - Set up Python virtual environment for Click's free AI features
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🐍 Setting up Python Virtual Environment in $PROJECT_ROOT/.venv..."

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo "✅ Created new virtual environment"
else
    echo "ℹ️ Virtual environment already exists"
fi

echo "Installing pip dependencies from requirements.txt..."
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

echo "✅ Python environment setup complete!"
