# Railway Deployment Guide

## 🚀 Quick Deployment Steps

### 1. Push Your Code to GitHub
```bash
git add .
git commit -m "Fix: Railway production deployment ready"
git push origin main
```

### 2. Connect Railway to Your GitHub Repo
1. Go to [Railway.app](https://railway.app)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Railway will auto-detect and start building

### 3. Add Required Environment Variables

In Railway dashboard → **Settings** → **Variables**, add:

#### Required (Server Won't Work Without These):
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_random_secure_string_here
```

#### Optional (Add When Ready):
```
FRONTEND_URL=your_railway_app_url
NODE_ENV=production
```

**Where to Find Supabase Credentials:**
- Go to your Supabase project → **Settings** → **API**
- Copy **Project URL** → Use as `SUPABASE_URL`
- Copy **service_role key** (secret) → Use as `SUPABASE_SERVICE_ROLE_KEY`

**JWT_SECRET:** Generate a random string:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Redeploy After Adding Variables
- After adding environment variables, click **"Redeploy"**
- Watch the logs - server should start and stay running

### 5. Verify Deployment
- Railway will give you a URL like `https://your-app.railway.app`
- Visit `/health` endpoint: `https://your-app.railway.app/health`
- Should return: `{"status":"ok","timestamp":"..."}`
- Visit the main URL to see the login page

---

## 🔧 What Was Fixed

### Problem
Railway container was stopping immediately after start because:
- Missing environment variables caused the Supabase client to throw errors during module import
- Errors happened before error handlers could catch them
- Railway interpreted this as a failed deployment and stopped the container

### Solution
1. **Graceful Environment Variable Handling:**
   - Server now starts even if Supabase credentials are missing
   - Prints clear error messages showing which variables are missing
   - Uses placeholder values to prevent crashes

2. **Error Handlers Added:**
   - Catches uncaught exceptions and unhandled promise rejections
   - Logs errors instead of crashing
   - Handles SIGTERM gracefully for clean shutdowns

3. **Health Check Endpoint:**
   - Added `/health` endpoint for Railway to verify server is running
   - Returns JSON response with timestamp

---

## 📊 Expected Railway Logs

**Successful Deployment:**
```
Starting Container...
(node:1) [DEP0040] DeprecationWarning: The `punycode` module is deprecated...
✅ CRM API server running on 0.0.0.0:8080
📱 Frontend served from /app/admin/dist
```

**Missing Environment Variables (Warning, but still runs):**
```
❌ MISSING REQUIRED ENVIRONMENT VARIABLES:
   - SUPABASE_URL is missing
   - SUPABASE_SERVICE_ROLE_KEY is missing
⚠️  Server will start but database operations will fail
📝 Add these variables in Railway dashboard → Settings → Variables
✅ CRM API server running on 0.0.0.0:8080
```

---

## ✅ Post-Deployment Checklist

- [ ] Server stays running (check Railway logs)
- [ ] Health check works: `https://your-app.railway.app/health`
- [ ] Login page loads: `https://your-app.railway.app`
- [ ] Can login with: `admin@crm.local` / `admin123`
- [ ] After login, go to Settings and add API keys
- [ ] Change default admin password immediately!

---

## 🆘 Troubleshooting

**Container Still Stops:**
- Check Railway logs for exact error message
- Verify all environment variables are set correctly (no typos)
- Make sure `SUPABASE_URL` starts with `https://`
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is the **service_role** key, not the **anon** key

**Can't Login:**
- Database might not have tables yet
- Run the SQL migration from `supabase-schema.sql` in your Supabase SQL Editor
- Or use the GitHub Actions workflow to deploy schema automatically

**502 Bad Gateway:**
- Server crashed - check Railway logs
- Usually means missing environment variables or database connection failed

---

## 📝 Notes

- Railway automatically builds from `railway.json` configuration
- Build command: `npm install && npm run build && cd admin && npm install && npm run build`
- Start command: `node dist/server.js`
- Railway provides a random PORT - server uses it automatically
- Frontend is served from the same Express server (single deployment)
