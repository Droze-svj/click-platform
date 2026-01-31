#!/bin/bash

echo "🔍 VERIFYING REACT FIX"
echo "======================"

echo "1. Checking server status..."
if curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
    echo "✅ Backend server is running"
else
    echo "❌ Backend server not responding"
fi

echo ""
echo "2. Checking voice hooks API..."
if curl -s "http://localhost:5001/api/video/voice-hooks/library" | grep -q '"success":true'; then
    echo "✅ Voice hooks API working"
else
    echo "❌ Voice hooks API not working"
fi

echo ""
echo "3. Checking frontend..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend server responding"
    echo ""
    echo "🎯 MANUAL BROWSER TEST:"
    echo "   Open: http://localhost:3000"
    echo "   Check browser console for AuthContext errors"
    echo "   Navigate to Voice Hooks section"
else
    echo "❌ Frontend server not responding"
fi

echo ""
echo "💡 If you still see AuthContext errors:"
echo "   1. Hard refresh browser (Ctrl+F5)"
echo "   2. Clear browser cache"
echo "   3. Try incognito mode"
echo "   4. Restart React server"





