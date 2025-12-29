#!/bin/bash

echo "🚀 Setting up WHOP Content Optimizer..."

# Create upload directories
echo "📁 Creating upload directories..."
mkdir -p uploads/videos
mkdir -p uploads/clips
mkdir -p uploads/thumbnails
mkdir -p uploads/quotes

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd client && npm install && cd ..

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Please edit .env with your API keys before running the application"
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys (OpenAI, WHOP, MongoDB)"
echo "2. Start MongoDB (if using local instance)"
echo "3. Run 'npm run dev' to start both servers"







