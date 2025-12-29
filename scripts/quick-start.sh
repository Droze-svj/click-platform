#!/bin/bash

# Quick start script for Click

echo "🚀 Click - Quick Start"
echo "======================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Running setup script..."
    npm run setup:env
    echo ""
fi

# Validate environment
echo "🔍 Validating environment..."
npm run validate:env

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Environment validation failed!"
    echo "Please fix the issues above and try again."
    exit 1
fi

# Test integrations
echo ""
echo "🧪 Testing integrations..."
npm run test:integrations

# Check if MongoDB is running (optional check)
echo ""
echo "🔍 Checking MongoDB connection..."
if command -v mongosh &> /dev/null; then
    mongosh --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "  ✅ MongoDB is running"
    else
        echo "  ⚠️  MongoDB connection failed"
        echo "  ℹ️  Make sure MongoDB is running:"
        echo "     - Local: brew services start mongodb-community"
        echo "     - Docker: docker run -d -p 27017:27017 mongo:7"
    fi
else
    echo "  ℹ️  mongosh not found, skipping MongoDB check"
fi

echo ""
echo "✅ Quick start check complete!"
echo ""
echo "📝 Next steps:"
echo "1. Ensure MongoDB is running"
echo "2. Configure optional services (see QUICK_SETUP_GUIDE.md)"
echo "3. Run: npm run dev"
echo ""






