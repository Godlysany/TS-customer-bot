# Deployment Guide - WhatsApp Dentist CRM

## Quick Start: Deploy Database to Supabase

### 1. Get Your Supabase Credentials

**A. SUPABASE_PROJECT_ID** (Project Reference ID)
- Go to: https://supabase.com/dashboard/project/_/settings/general
- Copy the **"Reference ID"** (looks like: `abcdefghijklmnop`)
- ❌ NOT the Project URL
- ❌ NOT the full project name

**B. SUPABASE_DB_PASSWORD** (Database Password)
- Go to: https://supabase.com/dashboard/project/_/settings/database
- Look for **"Database password"** or **"Connection string"**
- Copy ONLY the password part (after `postgres:` and before `@`)
- If you don't see it, click **"Reset Database Password"** and save the new one

**C. SUPABASE_ACCESS_TOKEN** (Personal Access Token)
- Go to: https://supabase.com/dashboard/account/tokens
- Click **"Generate new token"**
- Give it a name (e.g., "GitHub Actions")
- Copy the token (starts with `sbp_...`)

### 2. Add Secrets to GitHub

1. Go to your GitHub repository
2. Click: **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** for each:

```
Name: SUPABASE_PROJECT_ID
Value: [paste your reference ID, e.g., "abcdefghijklmnop"]

Name: SUPABASE_DB_PASSWORD  
Value: [paste your database password]

Name: SUPABASE_ACCESS_TOKEN
Value: [paste your access token, e.g., "sbp_..."]
```

### 3. Trigger Database Deployment

```bash
# The workflow will auto-run when you push to main
git add .
git commit -m "Deploy database schema"
git push origin main

# OR manually trigger from GitHub:
# Go to: Actions → Deploy to Supabase → Run workflow
```

### 4. Verify Success

Check the Actions tab in GitHub:
- ✅ Green checkmark = Success!
- ❌ Red X = Check the logs for errors

**Common Issues:**

| Error | Solution |
|-------|----------|
| "Connection failed" | Double-check SUPABASE_PROJECT_ID (just the ref ID, no URL) |
| "Authentication failed" | Verify SUPABASE_DB_PASSWORD is correct |
| "Network is unreachable" (IPv6) | ✅ FIXED! Now uses Supabase CLI which handles IPv4/IPv6 automatically |

**How It Works:**
- The workflow connects via **Supavisor pooler** (IPv4-compatible connection pooler)
- Uses `aws-0-eu-west-1.pooler.supabase.com:6543` (transaction mode)
- Bypasses IPv6 issues completely - works perfectly with GitHub Actions
- Your password can contain ANY special characters - handled securely!

## Railway Deployment

### Environment Variables for Railway

```bash
PORT=8080
SUPABASE_URL=https://[your-project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
WHATSAPP_REPLY_MODE=text
RESET_AUTH=false
```

**Get Service Role Key:**
1. Go to: https://supabase.com/dashboard/project/_/settings/api
2. Copy **"service_role"** key (JWT format, long string)
3. ⚠️ Keep this secret - it has full database access!

### Deploy to Railway

1. Connect your GitHub repo to Railway
2. Set environment variables above
3. Railway will automatically:
   - Build backend with `npm run build`
   - Build frontend with `cd admin && npm run build`
   - Start server with `node dist/server.js`
   - Serve frontend on port 8080

## Post-Deployment Setup

Once deployed, configure via CRM Settings page:

1. **OpenAI API Key** - For GPT responses
2. **SendGrid API Key** - For email notifications
3. **Secretary Email** - For daily summaries
4. **Cancellation Policy** - Hours and penalty fees
5. **Daily Summary Time** - In CET timezone
6. **WhatsApp Connection** - Connect manually (see below)

### WhatsApp Connection (Manual Start)

⚠️ **Important:** WhatsApp does NOT auto-connect on server start. This prevents crashes from connection issues.

**To connect WhatsApp:**

```bash
# Method 1: Via API
curl -X POST https://your-app.railway.app/api/whatsapp/connect

# Method 2: Via CRM Settings page (recommended)
# A "Connect WhatsApp" button will be added to the Settings page
```

**Why Manual Start?**
- Prevents Railway deployment crashes from WhatsApp WebSocket errors (405)
- Allows server to start successfully even without WhatsApp connection
- You can connect WhatsApp only when ready (after QR scan setup)
- Production-safe: Server runs independently of WhatsApp status

**To disconnect WhatsApp:**

```bash
curl -X POST https://your-app.railway.app/api/whatsapp/disconnect
```

## Testing the Deployment

### Test Database Connection
```bash
# From your local machine:
PGPASSWORD="your_password" psql \
  "postgresql://postgres:your_password@db.your_project_id.supabase.co:5432/postgres?sslmode=require" \
  -c "SELECT COUNT(*) FROM contacts;"
```

### Test API Endpoints
```bash
# Replace with your Railway URL
curl https://your-app.railway.app/health
curl https://your-app.railway.app/api/dashboard/stats
```

## Troubleshooting

### GitHub Actions Failed?

1. Check the workflow logs in GitHub Actions tab
2. Look for specific error messages
3. Verify all 3 secrets are set correctly
4. Try manual trigger: Actions → Deploy to Supabase → Run workflow

### Tables Not Created?

```sql
-- Run this in Supabase SQL Editor to check:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

Should show: contacts, agents, conversations, messages, bookings, settings, waitlist, questionnaires, reviews, etc.

### Railway Build Failed?

- Check that `railway.json` exists
- Verify environment variables are set
- Check build logs for specific errors

## Success Checklist

- [ ] Database tables created in Supabase (18+ tables)
- [ ] Backend API running on Railway
- [ ] Frontend accessible at Railway URL
- [ ] Dashboard loads and shows stats
- [ ] Settings page allows API key configuration
- [ ] WhatsApp connection can be initiated manually via API

---

**Need Help?** Check the workflow logs first - they contain detailed error messages!
