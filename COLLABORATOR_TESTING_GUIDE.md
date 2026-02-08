# Collaborator Testing Guide

How to set up Click locally and verify it works.

---

## 1. Prerequisites

- **Node.js** 18+ (`node -v`)
- **MongoDB** — Local or Atlas
- **Git** — For cloning and branches

---

## 2. Local Setup (~10 min)

### Clone & Install

```bash
git clone https://github.com/Droze-svj/click-platform.git
cd click-platform

# Install dependencies
npm run install:all
# or: npm install && cd client && npm install
```

### Environment

```bash
cp .env.example .env
```

Edit `.env` — minimum for local testing:

```env
NODE_ENV=development
PORT=5001
FRONTEND_URL=http://localhost:3010

# Database (local MongoDB)
MONGODB_URI=mongodb://localhost:27017/click

# JWT (any 32+ char string for dev)
JWT_SECRET=dev-secret-key-minimum-32-characters-long

# OpenAI (optional for AI features; leave empty to skip)
OPENAI_API_KEY=
```

**MongoDB options:**
- **Local:** `brew services start mongodb-community` (Mac) or `mongod`
- **Docker:** `docker run -d -p 27017:27017 mongo:7`
- **Atlas:** Use your Atlas connection string (ensure your IP is whitelisted)

**Redis (optional for local):**
- Workers work without Redis locally; some features may be limited
- To enable: `REDIS_URL=redis://localhost:6379` (requires Redis installed)

---

## 3. Run Click

```bash
npm run dev
```

- Backend: http://localhost:5001
- Frontend: http://localhost:3010

---

## 4. Verify Phase 0 (Connections)

```bash
npm run verify:phase0
```

Expected:
- MongoDB: ✅
- Redis: ⚠️ or ✅
- API: ✅ (if server is running)

---

## 5. Test Production (Optional)

To verify production is healthy:

```bash
BASE_URL=https://click-platform.onrender.com npm run verify:phase0
```

---

## 6. Run Tests

```bash
# Unit tests
npm run test:unit

# Integration tests (requires MongoDB)
npm run test:integration

# Critical E2E (requires server + client running)
npm run test:critical
```

---

## 7. Test Checklist

| Item | How to Test |
|------|-------------|
| Register | http://localhost:3010/register |
| Login | http://localhost:3010/login |
| Dashboard | After login → /dashboard |
| Content | Dashboard → Content |
| API Health | http://localhost:5001/api/health |

---

## 8. Working on Assignments

1. Pull latest: `git pull origin main`
2. Create branch: `git checkout -b feature/your-feature`
3. Make changes
4. Run tests: `npm run test:unit`
5. Commit & push
6. Create Pull Request on GitHub
7. Add `Closes #XX` in PR description (XX = issue number)

---

## Troubleshooting

### MongoDB connection failed
- Ensure MongoDB is running
- Check MONGODB_URI in .env
- For Atlas: Whitelist your IP (Network Access → Add IP)

### Port already in use
- Change PORT in .env (e.g. 5002)
- Or kill process: `lsof -i :5001` then `kill -9 <PID>`

### Redis errors (local)
- Redis is optional locally — remove REDIS_URL to disable workers
- Or install Redis: `brew install redis` and `brew services start redis`

### Frontend won't connect to API
- Ensure backend runs on PORT 5001
- Check `client/next.config.js` rewrites point to correct backend URL
