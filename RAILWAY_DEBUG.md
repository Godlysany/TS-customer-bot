# 🔍 Railway Deployment Debug Guide

## What I Added:

✅ **Version Tracking System**
- Version file: `admin/public/version.json` (timestamp: 1760357945)
- API endpoint: `/api/version` to check deployed build
- Cache headers: `no-cache, no-store, must-revalidate` on all static files

---

## Step 1: Push Changes to Railway

```bash
git add .
git commit -m "Add version tracking and cache-busting headers"
git push origin main
```

---

## Step 2: Verify Railway Deployment

After Railway finishes deploying, check what version it deployed:

**Open this URL in your browser:**
```
https://ts-customer-bot-production.up.railway.app/api/version
```

**You should see:**
```json
{
  "version": "1760357945",
  "build": "index-BYBUhiUV.js",
  "timestamp": "2025-10-13 12:19:05 UTC"
}
```

---

## Step 3: Diagnose the Issue

### ✅ If you see the correct version (1760357945):
Railway deployed correctly. The issue is browser/CDN caching:
1. Clear ALL browser data for Railway domain
2. Try different browser entirely
3. Check browser DevTools → Network → Look for `index-BYBUhiUV.js`

### ❌ If you see "Version file not found":
Railway's build didn't copy the public folder:
1. Check Railway logs for build errors
2. Verify `railway.json` buildCommand ran successfully
3. Frontend build may have failed silently

### ❌ If you see old version or different timestamp:
Railway is serving an old deployment:
1. Check Railway dashboard - which commit is deployed?
2. Manually trigger redeploy in Railway
3. Check if Railway has multiple deployments running

---

## Step 4: Force Railway Cache Clear

If `/api/version` shows correct version but frontend is still old:

**Railway may be caching at CDN level.** Try:

1. **Add query parameter to force cache bust:**
   ```
   https://ts-customer-bot-production.up.railway.app/?v=1760357945
   ```

2. **Check specific asset directly:**
   ```
   https://ts-customer-bot-production.up.railway.app/assets/index-BYBUhiUV.js
   ```
   Should return 200 OK (not 404)

3. **If 404:** Railway didn't build/deploy the new frontend

---

## Expected Timeline:

1. **Push to git**: < 1 min
2. **Railway build**: 2-4 minutes
3. **Railway deploy**: < 1 min
4. **CDN propagation**: Should be instant with no-cache headers

**Total: ~5 minutes from push to live**

---

## Debug Commands:

**Local version check:**
```bash
cat admin/dist/version.json
```

**Railway version check:**
```bash
curl https://ts-customer-bot-production.up.railway.app/api/version
```

**Compare builds:**
```bash
# Local
ls -lh admin/dist/assets/*.js

# Railway (check browser DevTools Network tab)
# Should see: index-BYBUhiUV.js (394KB)
```
