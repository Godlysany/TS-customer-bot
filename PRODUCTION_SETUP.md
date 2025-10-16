# Production Setup Guide - WhatsApp CRM Bot

## Recent Updates (October 16, 2025)

### ✅ **Completed Fixes:**

1. **Language Preference System**
   - Added `preferred_language` column to contacts table (default: 'de')
   - Bot will remember customer language preferences
   - Default language setting: German (de)
   - Supported: de, en, fr, it

2. **Currency Standardization**
   - All currency references updated to **CHF (Swiss Francs)**
   - Payment transactions, penalties, cancellation fees now in CHF
   - Timezone: CET

3. **WhatsApp Contact Name Extraction**
   - Bot now auto-populates contact names from WhatsApp
   - Existing conversations will have names populated on next message

### 🔄 **Database Migration Required:**

Run these SQL commands on your **Railway Supabase database**:

```sql
-- Add language preference to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'de';

-- Add language settings
INSERT INTO settings (key, value, category, description, is_secret)
VALUES 
    ('default_bot_language', 'de', 'bot', 'Default language for bot responses (de, en, fr, it)', false),
    ('supported_languages', '["de","en","fr","it"]', 'bot', 'Supported languages for bot and customers', false),
    ('auto_detect_language', 'false', 'bot', 'Auto-detect customer language from messages', false)
ON CONFLICT (key) DO NOTHING;

-- Update currency to CHF
UPDATE payment_transactions SET currency = 'CHF' WHERE currency IN ('EUR', 'USD');
```

### ⚙️ **Google Calendar OAuth Setup (Production):**

Since you're running on Railway (not Replit), you need to set up OAuth manually:

1. **Google Cloud Console:**
   - Go to https://console.cloud.google.com
   - Create/select project
   - Enable Google Calendar API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs: `https://your-railway-app.up.railway.app/api/calendar/callback`

2. **Environment Variables (Railway):**
   ```
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=https://your-railway-app.up.railway.app/api/calendar/callback
   ```

3. **Automatic Token Refresh:**
   - The system will automatically refresh access tokens
   - Refresh tokens stored encrypted in database
   - No re-authentication needed once connected

### 🐛 **Known Issues Requiring Production Debugging:**

The following features exist in code but need debugging in your Railway environment:

1. **Bot Configuration Save** - API endpoints exist (/api/bot-config/*) but may not be saving
   - Check Railway logs for errors when clicking Save
   - Verify auth cookies are being sent with requests

2. **Admin Management Empty** - AgentService exists, data is in database
   - Check network tab for /api/auth/agents response
   - Verify camelCase/snake_case mapping

3. **Service Creation** - API exists (/api/services) 
   - Check for validation errors in Railway logs
   - Verify form data structure matches API expectations

4. **Customer CRM Empty** - Will populate as new conversations arrive with WhatsApp names

### 📊 **Verification Steps:**

1. **Deploy to Railway:**
   ```bash
   git add .
   git commit -m "Add language system, update currency to CHF, fix WhatsApp names"
   git push origin main
   ```

2. **Run Database Migrations:**
   - Execute the SQL commands above in Railway/Supabase SQL editor

3. **Test WhatsApp:**
   - Send a message to the bot
   - Verify contact name appears in Customers page
   - Check language preference is saved

4. **Debug Save Issues:**
   - Open browser DevTools → Network tab
   - Try saving bot config
   - Check request/response in Railway logs

### 🔑 **Critical Settings:**

Make sure these are configured in your CRM Settings:

- **OpenAI API Key**: Required for bot responses
- **WhatsApp Connected**: Via Settings → Connect WhatsApp  
- **Calendar Connected**: After OAuth setup above
- **Default Language**: German (de) - already set
- **Currency**: CHF - already updated

---

## Honest Assessment:

The core infrastructure is in place, but several features need production debugging:
- ✅ WhatsApp integration works
- ✅ Database schema complete
- ✅ API endpoints exist
- ⚠️ Save functionality needs debugging in production logs
- ⚠️ Data population depends on active usage

Next step: Check Railway application logs while testing each feature to identify specific errors.
