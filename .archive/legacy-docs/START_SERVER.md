# Starting Click Server for Testing

## Quick Start Commands

### Option 1: Development Mode (Recommended for Testing)
Starts both backend and frontend together:
```bash
npm run dev
```
- **Backend**: http://localhost:5001
- **Frontend**: http://localhost:3000 (or 3010)
- **API Docs**: http://localhost:5001/api-docs
- **Health Check**: http://localhost:5001/api/health

### Option 2: Start Server Only
If you only need the backend API:
```bash
npm run dev:server
```
This uses `nodemon` which auto-restarts on file changes.

### Option 3: Start Server in Production Mode
For production-like testing:
```bash
npm run start:server
```
This runs without auto-reload.

## Verify Server is Running

1. **Check Health Endpoint**:
   ```bash
   curl http://localhost:5001/api/health
   ```

2. **Open in Browser**:
   - API Docs: http://localhost:5001/api-docs
   - Health: http://localhost:5001/api/health

3. **Check Server Logs**:
   Look for:
   ```
   ✅ Server bound to port 5001 on 0.0.0.0
   🚀 Server running on port 5001
   ```

## Common Issues

### Port Already in Use
If port 5001 is already in use:
```bash
# Find what's using the port
lsof -ti:5001

# Kill it
kill -9 $(lsof -ti:5001)

# Or use a different port
PORT=5002 npm run dev:server
```

### Server Won't Start
1. Check logs for errors
2. Verify environment variables: `npm run validate:env`
3. Check database connection (MongoDB/Supabase)
4. Ensure all dependencies are installed: `npm install`

### Nodemon Stuck
If nodemon is running but server isn't:
```bash
# Kill all nodemon/node processes
pkill -f nodemon
pkill -f "node.*index.js"

# Start fresh
npm run dev:server
```

## Testing Endpoints

Once server is running, test these:

1. **Health Check**: `GET http://localhost:5001/api/health`
2. **API Docs**: Open http://localhost:5001/api-docs in browser
3. **Register**: `POST http://localhost:5001/api/auth/register`
4. **Login**: `POST http://localhost:5001/api/auth/login`

## Frontend Access

After starting, access the frontend:
- Development: http://localhost:3000 (or 3010)
- The frontend will automatically connect to the backend API


