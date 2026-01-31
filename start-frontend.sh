#!/bin/bash

echo "🎨 Starting WHOP AI V3 Frontend"
echo "=============================="

# Check current directory
if [[ "$(basename $(pwd))" == "WHOP AI V3" ]]; then
    echo "📍 In main project directory, navigating to frontend..."
    cd frontend-integration
elif [[ "$(basename $(pwd))" == "frontend-integration" ]]; then
    echo "📍 Already in frontend directory"
else
    echo "❌ Please run from WHOP AI V3 or frontend-integration directory"
    exit 1
fi

echo "🚀 Starting React development server..."
echo "Frontend will be available at: http://localhost:3000"
echo "Backend API at: http://localhost:5001"
echo ""
echo "Features available:"
echo "  ✅ Enhanced Voice Hooks System"
echo "  ✅ Professional Hook Library (20+ hooks)"
echo "  ✅ AI-Powered Custom Generation"
echo "  ✅ Content-Optimized Templates"
echo "  ✅ Community Marketplace"
echo "  ✅ Advanced Analytics"
echo ""
echo "Test the system:"
echo "  1. Open http://localhost:3000"
echo "  2. Go to Advanced Video Editor"
echo "  3. Click 'Voice Hooks' section"
echo "  4. Explore all 4 tabs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start