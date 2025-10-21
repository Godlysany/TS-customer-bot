# Marketing Campaign - Questionnaire Linking Deployment

## Overview
Extended marketing campaigns to support questionnaire linking with optional promotion after completion logic. This enables a powerful flow: send questionnaire → customer completes → automatically offer promotion.

## Database Schema Changes

### Changes Summary
Added two new columns to `marketing_campaigns` table:
1. `questionnaire_id` - Links campaign to a questionnaire
2. `promotion_after_completion` - Boolean flag to give promotion after questionnaire completion

### SQL Migration

```sql
-- Add questionnaire_id column to marketing_campaigns
ALTER TABLE marketing_campaigns 
ADD COLUMN IF NOT EXISTS questionnaire_id UUID REFERENCES questionnaires(id) ON DELETE SET NULL;

-- Add promotion_after_completion flag
ALTER TABLE marketing_campaigns 
ADD COLUMN IF NOT EXISTS promotion_after_completion BOOLEAN DEFAULT FALSE;
```

### Production Deployment Steps

1. **Schema File Updated**: `supabase-schema.sql` now includes both columns in the `marketing_campaigns` table definition (lines 177-178)

2. **Deploy to Production**: Push the updated `supabase-schema.sql` to main branch. The GitHub Action `.github/workflows/deploy-supabase.yml` will automatically apply the schema changes via Supavisor.

3. **Verification**: After deployment, verify the columns exist:
   ```sql
   \d marketing_campaigns
   ```
   Should show:
   - `questionnaire_id` column with type `UUID` and foreign key to `questionnaires(id)`
   - `promotion_after_completion` column with type `BOOLEAN` default `FALSE`

### Rollback Plan
If needed, remove the columns:
```sql
ALTER TABLE marketing_campaigns DROP COLUMN IF EXISTS questionnaire_id;
ALTER TABLE marketing_campaigns DROP COLUMN IF EXISTS promotion_after_completion;
```

## Feature Description

### Marketing Campaign Questionnaire Flow
1. **Create Campaign**: Admin selects target audience filters (sentiment, appointments, interaction history)
2. **Link Questionnaire**: Optionally link a questionnaire to be sent to matching customers
3. **Link Promotion**: Optionally link a promotion
4. **Enable Smart Flow**: When both questionnaire and promotion are linked, admin can enable "promotion after completion"
5. **Automated Reward**: Bot automatically offers the promotion to customers who complete the questionnaire

### Use Cases
- **Customer Profiling**: Send anamnesis questionnaire, reward completion with discount
- **Feedback Collection**: Request detailed feedback, offer incentive upon completion
- **Lead Qualification**: Qualify leads via questionnaire, provide promotion to qualified prospects
- **Re-engagement**: Send questionnaire to inactive customers, reward with comeback offer

## Code Changes

### Backend
- **Schema**: `supabase-schema.sql` - Added `questionnaire_id` and `promotion_after_completion` columns
- **Service**: `src/core/MarketingService.ts` - Updated `createCampaign` method to accept questionnaire parameters
- **API**: `src/api/routes.ts` - Added questionnaire parameters to campaign creation endpoint

### Frontend
- **Marketing Page**: `admin/src/pages/Marketing.tsx`
  - Added questionnaire selector dropdown
  - Added conditional checkbox for "promotion after completion"
  - Checkbox only appears when both questionnaire and promotion are selected
  - Clear helper text explaining the automated flow

## Testing Checklist
- [ ] Create campaign without questionnaire (should work)
- [ ] Create campaign with questionnaire only (should save questionnaire_id)
- [ ] Create campaign with promotion only (should save promotion_id)
- [ ] Create campaign with both questionnaire and promotion (checkbox should appear)
- [ ] Enable "promotion after completion" checkbox (should save as TRUE)
- [ ] Verify bot receives campaign with linked questionnaire and promotion
- [ ] Test end-to-end flow: customer receives questionnaire → completes → receives promotion

## Notes
- The questionnaire selector shows only active questionnaires
- The promotion-after-completion feature requires BOTH questionnaire and promotion to be linked
- The checkbox is conditional and only visible when both are selected for better UX
- Bot logic to handle the automatic promotion offering needs to be implemented separately
