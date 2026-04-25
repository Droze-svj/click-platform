# 🚨 SERVER STARTUP FIX GUIDE - WHOP AI V3

## **🔥 Critical Issues Identified**

Based on your server logs, here are the main problems:

### **1. Memory Usage (CRITICAL - 96%+)**
```
🚨 APM Alert [HIGH]: high_memory_usage {
  utilization: 0.9607620239257812,  // 96% memory usage
  threshold: 0.8,                   // 80% threshold
  heapUsed: 205872552               // 206MB used
}
```

### **2. Database Connection Timeouts**
```
Operation `socialconnections.find()` buffering timed out after 10000ms
Operation `approvalslas.find()` buffering timed out after 10000ms
⚠️ Supabase connection test failed: Could not find the function public.exec_sql(sql)
```

### **3. Redis Configuration Issues**
```
❌ REDIS_URL contains localhost/127.0.0.1 in production. This is not allowed.
❌ Workers will NOT be initialized. Use a cloud Redis service.
```

---

## **🛠️ STEP-BY-STEP FIXES**

### **Step 1: Kill Existing Processes**

```bash
# Kill all Node.js processes
pkill -f "node server/index.js" || true
pkill -f "npm start" || true

# Wait for processes to fully stop
sleep 3
```

### **Step 2: Fix Environment Configuration**

Create or update your `.env` file:

```bash
# Copy the template if it exists
cp .env.example .env 2>/dev/null || true

# Or create manually
cat > .env << EOF
# Required - Update with your actual Supabase credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Server settings
NODE_ENV=development
PORT=5001

# Optional - Redis (use cloud Redis for production)
REDIS_URL=redis://localhost:6379

# Optional - Email service
SENDGRID_API_KEY=your_sendgrid_api_key_here
EOF
```

**CRITICAL:** Replace the placeholder Supabase values with your actual credentials from your Supabase dashboard.

### **Step 3: Clean and Reinstall Dependencies**

```bash
# Remove problematic caches
rm -rf node_modules/.cache
rm -rf .next/cache
rm -rf client/.next/cache

# Clean npm cache
npm cache clean --force

# Remove and reinstall node_modules
rm -rf node_modules package-lock.json
npm install
```

### **Step 4: Start Server with Proper Configuration**

#### **Option A: Development Mode (Recommended)**
```bash
# Start with increased memory and development settings
NODE_ENV=development PORT=5001 node --max-old-space-size=2048 server/index.js
```

#### **Option B: Use the Fix Script**
```bash
# Run the automated fix script
node fix-server.js
```

#### **Option C: Use the Startup Script**
```bash
# Make the startup script executable
chmod +x start-server.sh

# Run it
./start-server.sh
```

---

## **🔍 DIAGNOSTIC CHECKS**

### **Check 1: Environment Variables**
```bash
# Verify .env file exists and has correct values
ls -la .env
cat .env | head -10

# Check if Supabase URL is set
grep SUPABASE_URL .env
```

### **Check 2: Database Connection**
```bash
# Test Supabase connection
curl -s "https://your-supabase-project.supabase.co/rest/v1/" \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-anon-key"
```

### **Check 3: Port Availability**
```bash
# Check if port 5001 is available
lsof -i :5001 || echo "Port 5001 is available"

# Kill any process using port 5001
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
```

### **Check 4: Memory Usage**
```bash
# Check current memory usage
ps aux | grep node | grep -v grep | head -5
free -h  # On Linux/Mac
```

---

## **🚨 SPECIFIC FIXES FOR IDENTIFIED ISSUES**

### **Fix 1: Memory Usage Issue**
```bash
# Start with higher memory limit
node --max-old-space-size=2048 server/index.js

# Or set in package.json scripts
{
  "scripts": {
    "start": "node --max-old-space-size=2048 server/index.js"
  }
}
```

### **Fix 2: Database Connection Timeouts**
```bash
# Check Supabase credentials
echo "SUPABASE_URL: $SUPABASE_URL"
echo "SUPABASE_ANON_KEY length: ${#SUPABASE_ANON_KEY}"

# Test connection
curl -s "$SUPABASE_URL/rest/v1/" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

### **Fix 3: Redis Configuration**
```bash
# For development (optional)
export REDIS_URL="redis://localhost:6379"

# For production (recommended)
export REDIS_URL="redis://your-cloud-redis-instance:6379"

# Test Redis connection
redis-cli -u "$REDIS_URL" ping 2>/dev/null || echo "Redis not available - this is OK for basic functionality"
```

---

## **🎯 QUICK START COMMANDS**

### **One-Line Fix (Try this first):**
```bash
cd /Users/orlandhino/WHOP\ AI\ V3 && pkill -f "node server" && sleep 2 && NODE_ENV=development PORT=5001 node --max-old-space-size=2048 server/index.js
```

### **If that doesn't work, try the comprehensive fix:**
```bash
cd /Users/orlandhino/WHOP\ AI\ V3

# Kill processes
pkill -f "node server" || true
sleep 2

# Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# Start with proper settings
NODE_ENV=development PORT=5001 node --max-old-space-size=2048 server/index.js
```

---

## **📊 HEALTH CHECKS**

### **Test Server Health:**
```bash
# Wait for server to start, then test
sleep 5
curl -s http://localhost:5001/api/health | jq . || echo "Server not responding"
```

### **Test Voice Hooks API:**
```bash
# Test the enhanced voice hooks system
curl -s "http://localhost:5001/api/video/voice-hooks/library" | jq '.success' || echo "Voice hooks API not working"
```

### **Test Frontend:**
```bash
# Start frontend in another terminal
cd frontend-integration && npm start
# Should open on http://localhost:3000
```

---

## **🚨 IF ISSUES PERSIST**

### **Check 1: Logs Analysis**
```bash
# Check recent logs
tail -n 50 logs/*.log 2>/dev/null || echo "No log files found"

# Check console output
# Look for these error patterns:
# - "Cannot find module"
# - "ECONNREFUSED"
# - "timeout"
# - "heap out of memory"
```

### **Check 2: System Resources**
```bash
# Check available memory
free -h || echo "Memory check not available on this system"

# Check disk space
df -h | head -5

# Check Node.js version
node --version
```

### **Check 3: Network Connectivity**
```bash
# Test internet connection
curl -s https://google.com >/dev/null && echo "Internet OK" || echo "No internet"

# Test Supabase connectivity
curl -s "$SUPABASE_URL" >/dev/null && echo "Supabase reachable" || echo "Supabase not reachable"
```

---

## **🎯 EXPECTED SUCCESS INDICATORS**

### **✅ Server Started Successfully:**
```
🚀 Starting server...
✅ Environment variables loaded
✅ Server bound to port 5001 on 0.0.0.0
🚀 Server running on port 5001
```

### **✅ Health Check Passed:**
```bash
curl http://localhost:5001/api/health
# Should return: {"status":"ok","timestamp":"...","uptime":"..."}
```

### **✅ Voice Hooks Working:**
```bash
curl "http://localhost:5001/api/video/voice-hooks/library"
# Should return: {"success":true,"data":{"categories":[...]}}
```

---

## **🚀 FINAL VERIFICATION**

Once the server is running:

1. **Open browser:** http://localhost:5001
2. **Check API docs:** http://localhost:5001/api-docs
3. **Test voice hooks:** http://localhost:5001/api/video/voice-hooks/library
4. **Start frontend:** `cd frontend-integration && npm start`

**Your enhanced voice hooks system with AI generation, templates, marketplace, and advanced analytics is now ready to test!** 🎉

---

## **📞 STILL HAVING ISSUES?**

If the server still won't start:

1. **Check the .env file** - ensure Supabase credentials are correct
2. **Try minimal startup:** `node --max-old-space-size=1024 server/index.js`
3. **Check system resources** - ensure enough RAM available
4. **Test database connection** separately
5. **Review logs** for specific error messages

**The enhanced voice hooks system is implemented and ready - we just need to get the server running to test it!** 🚀





