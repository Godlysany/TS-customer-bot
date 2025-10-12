# WhatsApp CRM Bot - Deployment & CI/CD Setup

## 🚀 Quick Overview

Your bot is deployed to: **https://ts-customer-bot-production.up.railway.app**
- Railway auto-deploys when you push to GitHub
- Port: 8080
- OpenAI and Deepgram keys configured via CRM frontend (not environment variables)

---

## 📋 Required Secrets

### 1. **Supabase Project API Keys** (For Application)

These are **required in Railway environment variables**:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to find them:**
1. Go to your Supabase project
2. Click **Settings** → **API**
3. Copy **Project URL** → use for `SUPABASE_URL`
4. Copy **service_role** key (the one marked "secret") → use for `SUPABASE_SERVICE_ROLE_KEY`
   - It's a long JWT token starting with `eyJ...`
   - **NOT** the `sb_secret_...` access token!

**Add to Railway:**
1. Go to Railway dashboard
2. Select your project
3. Go to **Variables** tab
4. Add both variables

---

### 2. **GitHub Actions Secrets** (Optional - For Auto DB Setup)

If you want GitHub Actions to automatically set up your Supabase database when you push code:

**Add these to GitHub Secrets** (Settings → Secrets and variables → Actions):

```bash
SUPABASE_ACCESS_TOKEN=<your-access-token>     # sb_secret_Q21... format
SUPABASE_DB_PASSWORD=<your-database-password>
SUPABASE_PROJECT_ID=<your-project-id>
```

**Where to find them:**

**SUPABASE_ACCESS_TOKEN:**
1. Go to Supabase Dashboard
2. Click your profile (top right)
3. **Account Settings** → **Access Tokens**
4. Create new token or copy existing one
5. Format: `sb_secret_...`

**SUPABASE_DB_PASSWORD:**
1. Supabase Dashboard → **Project Settings** → **Database**
2. Database password (the one you set when creating the project)
3. If forgotten, you can reset it

**SUPABASE_PROJECT_ID:**
1. Supabase Dashboard → **Project Settings** → **General**
2. Reference ID (e.g., `abcdefghijk`)

---

## 🗄️ Database Setup

### Option 1: Manual Setup (Recommended for First Time)

1. Go to your Supabase project
2. Click **SQL Editor** (left sidebar)
3. Click **New query**
4. Copy entire contents of `supabase-schema.sql`
5. Paste and click **Run**
6. ✅ All tables, indexes, and default data created!

### Option 2: Automated via GitHub Actions

Once you've added the GitHub secrets above:

1. Push `supabase-schema.sql` to GitHub
2. GitHub Actions will automatically run
3. Database schema deployed!

**Manual trigger:**
- Go to GitHub → Actions → "Deploy to Supabase"
- Click "Run workflow"

---

## ⚙️ Railway Configuration

### Environment Variables Already Set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### What's NOT in environment variables (configured via CRM):
- ❌ `OPENAI_API_KEY` - Set in CRM Settings page
- ❌ `DEEPGRAM_API_KEY` - Set in CRM Settings page (optional)

### Port Configuration:
- Railway: **8080** (already configured)
- Replit: **5000** (development)

---

## 🔐 API Keys Configuration (In CRM Frontend)

After deployment, configure these in the **CRM Settings page**:

### Required:
1. **OpenAI API Key**
   ```
   PUT https://ts-customer-bot-production.up.railway.app/api/settings/openai_api_key
   Body: { "value": "sk-proj-xxxxx" }
   ```

### Optional:
2. **Deepgram API Key** (for voice transcription)
   ```
   PUT https://ts-customer-bot-production.up.railway.app/api/settings/deepgram_api_key
   Body: { "value": "your-deepgram-key" }
   ```

3. **Calendar iCal URL**
   ```
   PUT https://ts-customer-bot-production.up.railway.app/api/settings/calendar_ical_url
   Body: { "value": "https://calendar.google.com/..." }
   ```

---

## 🔄 Deployment Flow

### Current Setup:
1. **Code pushed to GitHub** → Railway auto-deploys backend
2. **Database changes** → Run manually in Supabase SQL Editor OR use GitHub Actions

### With GitHub Actions:
1. **Code pushed to GitHub** → Railway auto-deploys backend
2. **supabase-schema.sql changed** → GitHub Actions auto-updates database

---

## ✅ Setup Checklist

### Initial Setup (One-time):
- [ ] Add Supabase project API keys to Railway
- [ ] Run `supabase-schema.sql` in Supabase SQL Editor
- [ ] (Optional) Add GitHub secrets for automated DB deploys
- [ ] Configure OpenAI API key via CRM settings API
- [ ] Configure Deepgram API key via CRM settings API (if using voice)
- [ ] Test bot: Send WhatsApp message

### For Each Deployment:
- [ ] Push code to GitHub
- [ ] Railway auto-deploys (check Railway dashboard)
- [ ] If schema changed, run SQL manually OR wait for GitHub Action
- [ ] Test production URL: https://ts-customer-bot-production.up.railway.app/health

---

## 🧪 Testing

### Health Check:
```bash
curl https://ts-customer-bot-production.up.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "WhatsApp CRM Bot"
}
```

### Check Settings:
```bash
curl https://ts-customer-bot-production.up.railway.app/api/settings
```

### Set OpenAI Key:
```bash
curl -X PUT https://ts-customer-bot-production.up.railway.app/api/settings/openai_api_key \
  -H "Content-Type: application/json" \
  -d '{"value":"sk-proj-YOUR_KEY_HERE"}'
```

---

## 🐛 Troubleshooting

### Bot not responding?
1. Check Railway logs for errors
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is the **service_role** JWT (not `sb_secret_...`)
3. Check OpenAI key is set: `GET /api/settings/openai_api_key`
4. Check bot is enabled: `GET /api/settings/bot_enabled`

### Database connection failed?
1. Verify `SUPABASE_URL` format: `https://xxxxx.supabase.co`
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is the long JWT token
3. Check Supabase project is active
4. Verify schema is installed (check tables in Supabase dashboard)

### GitHub Actions failing?
1. Verify all 3 secrets are added to GitHub
2. Check `SUPABASE_ACCESS_TOKEN` is `sb_secret_...` format
3. Check project ID matches your Supabase project
4. Check database password is correct

---

## 📚 Additional Resources

- **Railway Docs**: https://docs.railway.app
- **Supabase Docs**: https://supabase.com/docs
- **GitHub Actions**: https://docs.github.com/actions
- **API Documentation**: See `API_DOCUMENTATION.md`
- **CRM Features**: See `CRM_FEATURES.md`

---

## 🔒 Security Notes

- **Never commit** `.env` file to GitHub
- **service_role key** is sensitive - only use server-side
- **Access tokens** (`sb_secret_...`) are for CLI/admin only
- **GitHub secrets** are encrypted and only visible to Actions
- **Railway variables** are encrypted in their dashboard
