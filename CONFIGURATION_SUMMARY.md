# ✅ WhatsApp CRM Bot - Configuration Complete

## 🎯 What Changed

### **API Keys Now CRM-Configurable** (Not Hardcoded!)

Previously, API keys were environment variables. Now they're **configurable via CRM Settings page**:

- ✅ **OpenAI API Key** → Set in CRM (not `.env`)
- ✅ **Deepgram API Key** → Set in CRM (not `.env`)  
- ❌ **ElevenLabs** → Removed (text-to-speech not needed)

**Only Supabase credentials remain in environment variables** (for database connection).

---

## 🔑 Required Secrets

### **For Railway Deployment** (Environment Variables)

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Key format:** Long JWT token (starts with `eyJ...`)  
**NOT** the `sb_secret_...` access token!

**Where to add:**
- Railway Dashboard → Variables tab

---

### **For GitHub Actions** (Optional - Auto DB Deploy)

Add these 3 secrets to **GitHub Settings → Secrets and variables → Actions**:

```bash
SUPABASE_ACCESS_TOKEN=sb_secret_Q21...           # Access token for CLI
SUPABASE_DB_PASSWORD=your-database-password      # Database password
SUPABASE_PROJECT_ID=abcdefghijk                  # Project reference ID
```

See `GITHUB_SECRETS_GUIDE.md` for detailed instructions.

---

## 📝 Configuration Flow

### **Backend (Railway/Replit):**
1. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in environment
2. Deploy backend
3. Database tables auto-created on first run (or use SQL Editor)

### **CRM Frontend (After Deployment):**
1. Build admin interface with Settings page
2. Configure via API:
   ```bash
   PUT /api/settings/openai_api_key
   PUT /api/settings/deepgram_api_key
   PUT /api/settings/calendar_ical_url
   ```

---

## 🚀 Deployment URLs

- **Production**: https://ts-customer-bot-production.up.railway.app
- **Port**: 8080 (Railway)
- **Health Check**: `/health`

---

## 📊 Settings Management

All configurable settings (stored in database):

| Setting Key | Category | Description | Secret? |
|-------------|----------|-------------|---------|
| `bot_enabled` | bot_control | Global bot on/off switch | No |
| `openai_api_key` | integrations | OpenAI API key for GPT | Yes |
| `deepgram_api_key` | integrations | Voice transcription | Yes |
| `calendar_provider` | integrations | google/outlook/caldav | No |
| `calendar_ical_url` | integrations | Calendar iCal URL | No |
| `whatsapp_connected` | bot_control | Connection status | No |

**API Endpoints:**
```bash
GET  /api/settings                  # Get all settings
GET  /api/settings?category=integrations
PUT  /api/settings/:key             # Update setting
POST /api/settings/bot/toggle       # Quick on/off
```

---

## 🎨 Voice Configuration

### **What Changed:**
- ❌ Removed ElevenLabs (no text-to-speech)
- ✅ Kept Deepgram (voice transcription only)
- ✅ Deepgram configured via CRM (not `.env`)

### **How It Works:**
1. User sends voice message
2. Bot transcribes via Deepgram
3. Bot processes text and replies with **text** (not voice)

---

## 🗄️ Database Setup

### **Option 1: Manual (Recommended)**
```bash
1. Go to Supabase SQL Editor
2. Copy contents of supabase-schema.sql
3. Paste and run
```

### **Option 2: GitHub Actions (Automated)**
```bash
1. Add GitHub secrets (see GITHUB_SECRETS_GUIDE.md)
2. Push changes to supabase-schema.sql
3. GitHub Actions auto-deploys
```

---

## 📁 Files Created/Updated

### **New Files:**
- `.github/workflows/deploy-supabase.yml` - GitHub Actions workflow
- `DEPLOYMENT_SETUP.md` - Complete deployment guide
- `GITHUB_SECRETS_GUIDE.md` - Step-by-step secrets setup
- `CONFIGURATION_SUMMARY.md` - This file

### **Updated Files:**
- `src/infrastructure/config.ts` - Removed hardcoded API keys
- `src/infrastructure/openai.ts` - Dynamic client from settings
- `src/core/AIService.ts` - Uses settings-based OpenAI
- `src/core/CustomerAnalyticsService.ts` - Uses settings-based OpenAI
- `src/core/SettingsService.ts` - Added Deepgram getter
- `.env.example` - Simplified to Supabase only
- `supabase-schema.sql` - Removed ElevenLabs settings
- `README.md` - Updated setup instructions

---

## ✅ Setup Checklist

### **Initial Deployment:**
- [ ] Add `SUPABASE_URL` to Railway
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to Railway (JWT format!)
- [ ] Run `supabase-schema.sql` in Supabase SQL Editor
- [ ] Deploy to Railway (auto-deploys on push)
- [ ] Test health endpoint: `https://ts-customer-bot-production.up.railway.app/health`

### **CRM Configuration (After Frontend Built):**
- [ ] Set OpenAI key via Settings page
- [ ] Set Deepgram key via Settings page (optional)
- [ ] Configure calendar iCal URL
- [ ] Test bot with WhatsApp message

### **Optional - GitHub Actions:**
- [ ] Add `SUPABASE_ACCESS_TOKEN` to GitHub
- [ ] Add `SUPABASE_DB_PASSWORD` to GitHub
- [ ] Add `SUPABASE_PROJECT_ID` to GitHub
- [ ] Test workflow (push or manual trigger)

---

## 🧪 Testing Commands

```bash
# Health check
curl https://ts-customer-bot-production.up.railway.app/health

# Get all settings
curl https://ts-customer-bot-production.up.railway.app/api/settings

# Set OpenAI key (replace with your key)
curl -X PUT https://ts-customer-bot-production.up.railway.app/api/settings/openai_api_key \
  -H "Content-Type: application/json" \
  -d '{"value":"sk-proj-YOUR_KEY"}'

# Check bot status
curl https://ts-customer-bot-production.up.railway.app/api/settings?category=bot_control
```

---

## 📚 Documentation

- **Deployment Guide**: `DEPLOYMENT_SETUP.md`
- **GitHub Secrets**: `GITHUB_SECRETS_GUIDE.md`
- **API Reference**: `API_DOCUMENTATION.md`
- **CRM Features**: `CRM_FEATURES.md`
- **Project Docs**: `replit.md`

---

## 🎯 Next Steps

1. **Build Frontend**: Create React/Vite admin dashboard
2. **Settings Page**: UI for configuring API keys
3. **Test Production**: Deploy and verify everything works
4. **WhatsApp QR**: Display QR code in CRM for connection

---

## 🔒 Security Reminders

✅ **DO:**
- Use service_role key (JWT) for Railway
- Use access token (`sb_secret_...`) for GitHub Actions
- Configure sensitive keys via CRM Settings page
- Keep GitHub secrets encrypted

❌ **DON'T:**
- Commit `.env` to repository
- Mix up JWT keys and access tokens
- Share service_role key publicly
- Hardcode API keys in code

---

## 💡 Key Takeaways

1. **Only Supabase keys** in environment variables
2. **OpenAI/Deepgram keys** configured via CRM
3. **Railway auto-deploys** on GitHub push
4. **Database updates** manual or via GitHub Actions
5. **Port 8080** for Railway, 5000 for Replit

Everything is ready for frontend development! 🚀
