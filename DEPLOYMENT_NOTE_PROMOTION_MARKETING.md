# Marketing Campaign - Promotion Linking Deployment

## Database Schema Changes

### Change Summary
Added `promotion_id` column to `marketing_campaigns` table to enable linking promotions to marketing campaigns for intelligent bot offering.

### SQL Migration (Already Applied to Dev Database)

```sql
-- Add promotion_id column to marketing_campaigns
ALTER TABLE marketing_campaigns 
ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL;
```

### Production Deployment Steps

1. **Schema File Updated**: `supabase-schema.sql` now includes `promotion_id` column in the `marketing_campaigns` table definition (line 176)

2. **Deploy to Production**: Push the updated `supabase-schema.sql` to main branch. The GitHub Action `.github/workflows/deploy-supabase.yml` will automatically apply the schema changes via Supavisor.

3. **Verification**: After deployment, verify the column exists:
   ```sql
   \d marketing_campaigns
   ```
   Should show `promotion_id` column with type `UUID` and foreign key to `promotions(id)`

### Rollback Plan
If needed, remove the column:
```sql
ALTER TABLE marketing_campaigns DROP COLUMN IF EXISTS promotion_id;
```

## Feature Description
- Marketing campaigns can now be linked to active promotions
- Bot can intelligently offer linked promotions during customer conversations
- Frontend UI includes dropdown to select from active promotions
- Setting promotion is optional (defaults to NULL)

## Code Changes
- **Frontend**: `admin/src/pages/Marketing.tsx` - Added promotion selection dropdown
- **Backend API**: `src/api/routes.ts` - Added promotionId parameter handling
- **Service Layer**: `src/core/MarketingService.ts` - Updated createCampaign to save promotion_id
- **Schema**: `supabase-schema.sql` - Added promotion_id column definition

## Testing Checklist
- [ ] Create marketing campaign without promotion (should work)
- [ ] Create marketing campaign with promotion selected (should save promotion_id)
- [ ] Verify promotions dropdown shows only active promotions
- [ ] Verify bot can access campaign's linked promotion
