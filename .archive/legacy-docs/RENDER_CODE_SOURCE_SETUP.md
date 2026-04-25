# 📦 Render.com Code Source Setup

**How to connect your code to Render.com for deployment**

---

## 🎯 What is "Source of Code"?

**Source of Code** = Where Render.com gets your code from (usually GitHub)

Render.com needs to know:
- **Where is your code?** (GitHub repository)
- **Which branch?** (usually `main` or `master`)
- **How to build it?** (build commands)
- **How to start it?** (start command)

---

## 📋 Step-by-Step: Connect Your Code

### Option 1: Connect GitHub Repository (Recommended)

#### Step 1: Push Your Code to GitHub

**If you don't have a GitHub repository yet:**

1. **Create a new repository on GitHub**:
   - Go to: https://github.com/new
   - Repository name: `click-platform` (or your preferred name)
   - Choose: Public or Private
   - **Don't** initialize with README (you already have code)
   - Click "Create repository"

2. **Push your code to GitHub**:
   ```bash
   # In your project directory
   git init  # If not already a git repo
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/your-username/click-platform.git
   git push -u origin main
   ```

**If you already have a GitHub repository:**

```bash
# Just make sure your code is pushed
git add .
git commit -m "Ready for deployment"
git push origin main
```

---

#### Step 2: Connect to Render.com

1. **In Render.com dashboard**:
   - Click "New +" → "Web Service"
   - Click "Connect account" (if not connected)
   - Select "GitHub"
   - Authorize Render.com to access your GitHub

2. **Select Repository**:
   - Render will show your GitHub repositories
   - Find and select your repository (e.g., `click-platform`)
   - Click "Connect"

3. **Configure Service**:
   ```
   Name: click-platform
   Region: Choose closest to you
   Branch: main (or master)
   Root Directory: (leave empty - uses root)
   Environment: Node
   Build Command: npm install && cd client && npm install && npm run build
   Start Command: npm start
   Plan: Free
   ```

---

### Option 2: Deploy from Public Git Repository

If your code is in a public repository:

1. **In Render.com**:
   - Click "New +" → "Web Service"
   - Select "Public Git repository"
   - Enter your repository URL: `https://github.com/your-username/click-platform`
   - Configure build/start commands (same as above)

---

## 🔧 Build & Start Commands

### Build Command
```bash
npm install && cd client && npm install && npm run build
```

**What this does**:
- `npm install` - Installs backend dependencies
- `cd client && npm install` - Installs frontend dependencies
- `npm run build` - Builds the frontend for production

### Start Command
```bash
npm start
```

**What this does**:
- Starts the Node.js server (runs `node server/index.js`)

---

## 📋 Complete Configuration

### In Render.com, you'll set:

| Setting | Value |
|---------|-------|
| **Name** | `click-platform` (or your choice) |
| **Region** | Choose closest to you |
| **Branch** | `main` (or `master`) |
| **Root Directory** | (leave empty) |
| **Environment** | `Node` |
| **Build Command** | `npm install && cd client && npm install && npm run build` |
| **Start Command** | `npm start` |
| **Plan** | `Free` |

---

## ✅ Pre-Deployment Checklist

Before connecting to Render.com:

- [ ] Code is pushed to GitHub
- [ ] GitHub repository is accessible (public or Render has access)
- [ ] `package.json` exists in root directory
- [ ] `client/package.json` exists (for frontend)
- [ ] `server/index.js` exists (entry point)
- [ ] `.env` file is NOT committed (use environment variables in Render instead)

---

## 🚨 Important: Don't Commit `.env`

**Never commit your `.env` file to GitHub!**

Your `.env` file contains secrets. Instead:

1. **Add `.env` to `.gitignore`**:
   ```bash
   echo ".env" >> .gitignore
   git add .gitignore
   git commit -m "Add .env to gitignore"
   ```

2. **Add environment variables in Render.com** (not in code)

---

## 🔍 Verify Your Repository

### Check if code is ready:

```bash
# Check if git is initialized
git status

# Check if remote is set
git remote -v

# Check if code is pushed
git log --oneline -5
```

---

## 📝 Example: Complete Setup

### 1. Local Setup
```bash
cd "/Users/orlandhino/WHOP AI V3"
git init
git add .
git commit -m "Initial commit"
git branch -M main
```

### 2. Create GitHub Repository
- Go to GitHub.com → New repository
- Name: `click-platform`
- Create (don't initialize)

### 3. Push to GitHub
```bash
git remote add origin https://github.com/your-username/click-platform.git
git push -u origin main
```

### 4. Connect to Render.com
- Render.com → New Web Service
- Connect GitHub → Select `click-platform`
- Configure build/start commands
- Add environment variables
- Deploy!

---

## 🎯 Quick Reference

**Source Type**: GitHub Repository  
**Repository URL**: `https://github.com/your-username/click-platform`  
**Branch**: `main`  
**Build Command**: `npm install && cd client && npm install && npm run build`  
**Start Command**: `npm start`  

---

## 🆘 Troubleshooting

### "Repository not found"
- Make sure repository is public, OR
- Make sure Render.com has access to your private repository

### "Build failed"
- Check build logs in Render.com
- Verify `package.json` exists
- Check Node.js version compatibility

### "Start command failed"
- Verify `npm start` works locally
- Check `package.json` has `"start"` script
- Review error logs in Render.com

---

## 📚 Next Steps

After connecting your code source:

1. ✅ Code source connected
2. ⏭️ Add environment variables (see `RENDER_ENV_VARIABLES_EXACT.md`)
3. ⏭️ Deploy
4. ⏭️ Test

---

**Ready to connect? Follow the steps above! 🚀**

