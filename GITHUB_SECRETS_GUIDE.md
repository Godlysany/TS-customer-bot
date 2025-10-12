# GitHub Secrets Setup Guide

## 📋 What You Need to Add

To enable **automated Supabase database deployment** via GitHub Actions, add these 3 secrets to your GitHub repository:

---

## 🔐 Required GitHub Secrets

### 1. **SUPABASE_ACCESS_TOKEN**

**What it is:** Your Supabase Management API token (for CLI operations)

**Format:** `sb_secret_Q21...` (starts with `sb_secret_`)

**Where to find it:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click your **profile icon** (top right)
3. Select **Account Settings**
4. Go to **Access Tokens** tab
5. Create a new token or copy existing one
6. Copy the token (format: `sb_secret_...`)

**Add to GitHub:**
```
Settings → Secrets and variables → Actions → New repository secret
Name: SUPABASE_ACCESS_TOKEN
Secret: sb_secret_Q21...
```

---

### 2. **SUPABASE_DB_PASSWORD**

**What it is:** Your Supabase database password

**Where to find it:**
1. Go to your Supabase project
2. Click **Settings** → **Database**
3. Find **Database Password** section
4. If you forgot it, click **Reset Database Password**
5. Copy the password

**Add to GitHub:**
```
Settings → Secrets and variables → Actions → New repository secret
Name: SUPABASE_DB_PASSWORD
Secret: <your-database-password>
```

---

### 3. **SUPABASE_PROJECT_ID**

**What it is:** Your Supabase project reference ID

**Where to find it:**
1. Go to your Supabase project
2. Click **Settings** → **General**
3. Find **Reference ID** (e.g., `abcdefghijk`)
4. Copy the Reference ID

**Add to GitHub:**
```
Settings → Secrets and variables → Actions → New repository secret
Name: SUPABASE_PROJECT_ID
Secret: abcdefghijk
```

---

## ✅ How to Add Secrets to GitHub

### Step-by-step:

1. **Go to your GitHub repository**
2. Click **Settings** tab
3. In left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret** button
5. Add each secret one by one:
   - Name: `SUPABASE_ACCESS_TOKEN`
   - Secret: `sb_secret_...`
   - Click **Add secret**
   
6. Repeat for other two secrets

---

## 🚀 How GitHub Actions Uses These

Once secrets are added, the workflow `.github/workflows/deploy-supabase.yml` will:

1. **Trigger** when you push changes to `supabase-schema.sql`
2. **Use** these secrets to connect to your Supabase project
3. **Run** the SQL schema to update your database
4. **Verify** deployment was successful

---

## 🧪 Testing the Setup

### After adding secrets:

1. Make a small change to `supabase-schema.sql` (add a comment)
2. Commit and push to GitHub:
   ```bash
   git add supabase-schema.sql
   git commit -m "test: verify GitHub Actions"
   git push
   ```
3. Go to **Actions** tab in GitHub
4. Watch "Deploy to Supabase" workflow run
5. Check for ✅ success

### Manual trigger:
1. Go to **Actions** tab
2. Click **Deploy to Supabase** workflow
3. Click **Run workflow** dropdown
4. Click **Run workflow** button

---

## ⚠️ Important Notes

### Different Key Types:

| Key Type | Format | Used For | Add To |
|----------|--------|----------|---------|
| **Access Token** | `sb_secret_...` | CLI/Admin operations | GitHub Secrets |
| **service_role Key** | `eyJhbGciOiJIUzI1NiIs...` (JWT) | Application database access | Railway Env Vars |

**Don't confuse them!**
- GitHub Actions needs the `sb_secret_...` token
- Your Railway app needs the `eyJ...` JWT service_role key

### Security:
- ✅ GitHub secrets are encrypted
- ✅ Only visible to GitHub Actions
- ✅ Never exposed in logs
- ❌ Never commit these to your repository
- ❌ Never share them publicly

---

## 🐛 Troubleshooting

### "Authentication failed" error:
- Verify `SUPABASE_ACCESS_TOKEN` is correct `sb_secret_...` format
- Check token hasn't expired (regenerate if needed)
- Ensure token has proper permissions

### "Database connection failed":
- Verify `SUPABASE_DB_PASSWORD` is correct
- Try resetting password in Supabase dashboard
- Check password doesn't have special characters that need escaping

### "Project not found":
- Verify `SUPABASE_PROJECT_ID` matches your project
- Check you're using Reference ID, not Project Name
- Format is usually lowercase alphanumeric (e.g., `abcdefghijk`)

---

## 📚 Alternative: Manual Database Updates

**Don't want to use GitHub Actions?** No problem!

Simply run the SQL manually:
1. Go to Supabase → SQL Editor
2. Copy `supabase-schema.sql` contents
3. Paste and run

GitHub Actions is **optional** - it just automates this process.

---

## 🎯 Summary Checklist

- [ ] Found Supabase Access Token (`sb_secret_...`)
- [ ] Found Database Password
- [ ] Found Project Reference ID
- [ ] Added all 3 secrets to GitHub
- [ ] Tested workflow (push or manual trigger)
- [ ] Verified ✅ in Actions tab

Once complete, your database will auto-update when you change `supabase-schema.sql`!
