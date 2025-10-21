# Production Deployment Checklist - Phase 1

## ✅ What Was Fixed

I discovered and fixed a **critical production mismatch**:
- My code was trying to use new CRM columns (`preferred_times`, `fears_anxieties`, etc.)
- But `supabase-schema.sql` (deployed to production) didn't have these columns
- This would have caused **immediate production failures** when CRM extraction ran

## 🔧 Changes Made to Production Schema

### Updated: `supabase-schema.sql`

**Added 10 new CRM columns to `contacts` table:**
1. `preferred_times` - When customer prefers appointments
2. `preferred_staff` - Preferred staff members
3. `preferred_services` - Services customer is interested in
4. `fears_anxieties` - Phobias, nervousness, concerns
5. `allergies` - Medical allergies and sensitivities
6. `physical_limitations` - Wheelchair, hearing, vision needs
7. `special_requests` - Accommodation needs
8. `communication_preferences` (JSONB) - How they prefer contact
9. `behavioral_notes` - Punctuality, personality patterns
10. `customer_insights` - General observations

**Added 3 performance indexes:**
- `idx_contacts_preferred_staff` (partial index)
- `idx_contacts_allergies` (partial index)
- `idx_contacts_physical_limitations` (partial index)

## 🚀 Deployment Process

### How Production Database Gets Updated:

**GitHub Actions handles deployment automatically:**

1. **When you push to `main` branch**, GitHub Actions workflow triggers:
   - File: `.github/workflows/deploy-supabase.yml`
   - Watches for changes to: `supabase-schema.sql`

2. **Workflow runs:**
   ```bash
   psql -h aws-1-eu-west-1.pooler.supabase.com \
        -p 6543 \
        -U postgres.${SUPABASE_PROJECT_ID} \
        -d postgres \
        -f supabase-schema.sql
   ```

3. **Uses Supavisor pooler** (transaction mode, port 6543)
   - IPv4-compatible connection
   - No URL encoding issues
   - Production-safe deployment

### Required GitHub Secrets:
- ✅ `SUPABASE_ACCESS_TOKEN` - Already configured
- ✅ `SUPABASE_DB_PASSWORD` - Already configured
- ✅ `SUPABASE_PROJECT_ID` - Already configured

## 📋 Deployment Steps

### Option 1: Automatic (Recommended)
```bash
# Push changes to main branch
git add supabase-schema.sql
git commit -m "Phase 1: Add CRM extraction columns to production schema"
git push origin main

# GitHub Actions will automatically deploy to production Supabase
# Check workflow status: https://github.com/your-repo/actions
```

### Option 2: Manual (Emergency)
If GitHub Actions fails, you can manually deploy:
```bash
# Connect to production via Supavisor
psql -h aws-1-eu-west-1.pooler.supabase.com \
     -p 6543 \
     -U postgres.YOUR_PROJECT_ID \
     -d postgres \
     -f supabase-schema.sql
```

## ✅ Pre-Deployment Verification

**Local Testing (Replit Dev Environment):**
- ✅ Migration applied to dev database
- ✅ All 10 columns created successfully
- ✅ All 3 indexes created
- ✅ AIService can write to new columns
- ✅ TypeScript compiles without errors
- ✅ Architect reviewed and approved

**Production Schema File:**
- ✅ `supabase-schema.sql` updated with new columns
- ✅ Indexes added for performance
- ✅ Comments added for documentation
- ✅ Uses `IF NOT EXISTS` for safe re-runs

## 🔍 Post-Deployment Verification

After pushing to main and GitHub Actions completes:

1. **Check workflow status:**
   ```
   Go to: https://github.com/your-repo/actions
   Verify: "Deploy to Supabase" workflow succeeded
   ```

2. **Verify columns in production:**
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'contacts'
     AND column_name IN (
       'preferred_times', 'preferred_staff', 'fears_anxieties',
       'allergies', 'physical_limitations', 'special_requests',
       'behavioral_notes', 'customer_insights', 'communication_preferences'
     );
   ```

3. **Check indexes:**
   ```sql
   SELECT indexname
   FROM pg_indexes
   WHERE tablename = 'contacts'
     AND indexname LIKE 'idx_contacts_%';
   ```

4. **Test CRM extraction:**
   - Send a WhatsApp message with customer preferences
   - Check Replit logs for "✅ Extracted X customer insights"
   - Verify data appears in production Supabase

## 🛡️ Safety Features

**The schema update is production-safe:**

1. **Non-destructive:**
   - Only adds columns (doesn't remove or modify)
   - Uses `IF NOT EXISTS` for idempotency
   - Can be re-run safely

2. **Backward compatible:**
   - All new columns are nullable
   - Existing data unaffected
   - Old code won't break

3. **Performance-optimized:**
   - Partial indexes (WHERE ... IS NOT NULL)
   - Only index non-null values
   - Minimal storage overhead

## 🚨 Rollback Plan

If CRM extraction causes issues in production:

**Disable CRM extraction without database changes:**
```sql
-- In Supabase, update bot_config table:
UPDATE bot_config
SET enable_crm_extraction = false
WHERE id = 1;
```

This stops extraction immediately without rolling back schema.

## 📊 Expected Impact

**Storage:**
- Minimal increase (columns are nullable, only used when data exists)
- Text fields compress well in PostgreSQL

**Performance:**
- Indexes are partial (only non-null values)
- Background async extraction (doesn't block responses)
- No impact on WhatsApp message latency

**User Experience:**
- Automatic customer preference learning
- Better service personalization
- No manual data entry needed

## 🎯 Success Criteria

Phase 1 deployment is successful when:
- ✅ GitHub Actions workflow completes without errors
- ✅ All 10 CRM columns exist in production database
- ✅ All 3 indexes created successfully
- ✅ WhatsApp bot can extract and save customer insights
- ✅ No production errors in logs
- ✅ CRM data appears in admin dashboard

## 📝 Files Changed in This Phase

**Production Schema:**
- `supabase-schema.sql` (contacts table + indexes)

**Migration Files:**
- `supabase/migrations/20251021_add_crm_fields.sql` (documentation/reference)

**Application Code:**
- `src/core/AIService.ts` (extraction methods)
- `src/core/BookingChatHandler.ts` (email collection)
- `src/core/EmailService.ts` (template integration)
- `src/adapters/whatsapp.ts` (CRM integration)
- `src/utils/templateReplacer.ts` (template engine)
- `src/types/crm.ts` (type definitions)

## 🔄 Next Steps After Deployment

1. **Monitor production logs** for first 24 hours
2. **Check CRM extraction success rate** in analytics
3. **Verify data quality** in Supabase dashboard
4. **Train staff** on new customer insights features
5. **Proceed to Phase 2** (questionnaire runtime)

---

**Status:** ✅ Ready for production deployment via GitHub Actions

**When to deploy:** Push to `main` branch when ready

**Estimated deployment time:** 30-60 seconds (GitHub Actions)

**Risk level:** LOW (non-destructive, backward compatible, tested in dev)
