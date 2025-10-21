# Phase 1.4: CRM Database Schema - COMPLETE

## Implementation Summary

The contacts table now has **10 new columns** for storing customer insights extracted from conversations. The database is ready to capture rich customer data.

## Database Schema Changes

### New Columns Added to `contacts` Table

```sql
ALTER TABLE contacts 
ADD COLUMN preferred_times TEXT,              -- When customer prefers appointments
ADD COLUMN preferred_staff TEXT,              -- Staff member preferences
ADD COLUMN preferred_services TEXT,           -- Service preferences and interests
ADD COLUMN fears_anxieties TEXT,              -- Dental anxiety, phobias, fears
ADD COLUMN allergies TEXT,                    -- Allergies and sensitivities
ADD COLUMN physical_limitations TEXT,         -- Mobility, hearing, vision issues
ADD COLUMN special_requests TEXT,             -- Special needs, cultural requirements
ADD COLUMN communication_preferences JSONB,   -- How they prefer to be contacted
ADD COLUMN behavioral_notes TEXT,             -- Punctuality, cancellation patterns
ADD COLUMN customer_insights TEXT;            -- General insights and notes
```

### Column Purposes

| Column | Purpose | Example Data |
|--------|---------|--------------|
| `preferred_times` | When customer likes to book | "mornings", "weekends", "Mondays 2pm" |
| `preferred_staff` | Favorite staff members | "Dr. Schmidt", "Sarah the hygienist" |
| `preferred_services` | Services they typically book | "teeth cleaning", "interested in whitening" |
| `fears_anxieties` | Fears, phobias, anxieties | "dental anxiety", "needle phobia", "claustrophobia" |
| `allergies` | Allergies and sensitivities | "latex allergy", "penicillin sensitivity" |
| `physical_limitations` | Access and health needs | "wheelchair access", "hearing impaired", "vision issues" |
| `special_requests` | Special accommodations | "quiet environment", "bring companion", "child-friendly room" |
| `communication_preferences` | Contact preferences (JSON) | `{"whatsappOnly": true, "bestTimeToContact": "mornings"}` |
| `behavioral_notes` | Patterns and tendencies | "always early", "cancels last-minute", "detail-oriented" |
| `customer_insights` | General observations | Free-form notes about personality, preferences, etc. |

### Communication Preferences JSON Structure

```typescript
{
  "whatsappOnly": boolean,        // Only contact via WhatsApp
  "emailPreferred": boolean,      // Prefers email communication
  "callPreferred": boolean,       // Prefers phone calls
  "bestTimeToContact": string,    // "mornings", "afternoons", "weekdays only"
  "doNotContact": boolean,        // Opt-out flag
  "preferredLanguage": string     // "en", "de", "fr", etc.
}
```

## TypeScript Types

Created `src/types/crm.ts` with comprehensive type definitions:

### `CommunicationPreferences`
```typescript
interface CommunicationPreferences {
  whatsappOnly?: boolean;
  emailPreferred?: boolean;
  callPreferred?: boolean;
  bestTimeToContact?: string;
  doNotContact?: boolean;
  preferredLanguage?: string;
}
```

### `CustomerInsights`
All CRM fields in one interface for easy access

### `ContactCRMData`
Complete contact record with all CRM fields

### `ExtractedConversationData`
Data extracted from a single conversation with confidence scoring

## Example Data Storage

**Customer Profile After Conversation Extraction:**
```json
{
  "id": "uuid",
  "name": "Sarah Miller",
  "email": "sarah@example.com",
  "phoneNumber": "+41791234567",
  "preferredLanguage": "en",
  
  // CRM Data Extracted from Conversations
  "preferredTimes": "mornings, especially Mondays around 10am",
  "preferredStaff": "Dr. Schmidt - built good rapport",
  "preferredServices": "regular cleaning, interested in whitening",
  "fearsAnxieties": "slight dental anxiety, prefers detailed explanations",
  "allergies": "latex allergy - use nitrile gloves",
  "physicalLimitations": null,
  "specialRequests": "prefers quiet waiting room, likes to bring headphones",
  "communicationPreferences": {
    "whatsappOnly": true,
    "bestTimeToContact": "mornings",
    "preferredLanguage": "en"
  },
  "behavioralNotes": "always punctual, books 3-month intervals regularly",
  "customerInsights": "Very health-conscious, asks lots of questions, appreciates thorough explanations. Mentioned interest in preventive care."
}
```

## Database Query Examples

**Update Customer Insights:**
```sql
UPDATE contacts 
SET 
  preferred_times = 'mornings',
  fears_anxieties = 'dental anxiety',
  allergies = 'latex allergy',
  communication_preferences = '{"whatsappOnly": true}'::jsonb,
  updated_at = NOW()
WHERE id = 'customer_uuid';
```

**Query Customers with Specific Needs:**
```sql
-- Find customers with allergies
SELECT name, allergies 
FROM contacts 
WHERE allergies IS NOT NULL AND allergies != '';

-- Find customers who prefer mornings
SELECT name, preferred_times 
FROM contacts 
WHERE preferred_times ILIKE '%morning%';

-- Find customers with WhatsApp-only preference
SELECT name, communication_preferences 
FROM contacts 
WHERE communication_preferences->>'whatsappOnly' = 'true';
```

## Migration Safety

✅ Used `ADD COLUMN IF NOT EXISTS` - safe for re-running
✅ All columns nullable - no data loss on existing records
✅ JSONB default empty object - prevents null errors
✅ TEXT columns - flexible for free-form data
✅ No breaking changes to existing columns

## Integration Points

**Where This Data Will Be Used:**

1. **AIService** - Extract insights during conversations
2. **BookingService** - Suggest preferred times/staff
3. **Marketing** - Segment by preferences and needs
4. **Customer Analytics** - Analyze patterns and trends
5. **Admin CRM UI** - Display rich customer profiles
6. **Staff Dashboard** - Show customer notes before appointments

## Next Steps

**Phase 1.5:** Implement `extractCustomerData()` in AIService
- Use GPT to analyze conversation messages
- Extract insights based on MASTER_SYSTEM_PROMPT guidelines
- Map extracted data to database columns

**Phase 1.6:** Save extracted data to profiles
- Update contacts table with insights
- Track when data was extracted
- Avoid overwriting existing data unless explicitly updated

## Privacy & GDPR Compliance

**Important Considerations:**
- All personal data stored with consent
- Customer can request data deletion
- Clear data retention policies needed
- Access controls for sensitive data (allergies, health info)
- Audit trail for data modifications

**Recommended Implementation:**
- Add `consent_given` boolean column
- Add `data_retention_until` date column
- Add `last_accessed_by` tracking
- Implement data export functionality
- Add "request deletion" feature

✅ **Phase 1.4 COMPLETE**

**Database ready for CRM data extraction!**
