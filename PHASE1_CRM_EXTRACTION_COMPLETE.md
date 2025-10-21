# Phase 1.5: CRM Data Extraction Logic - COMPLETE

## Implementation Summary

AIService now has **intelligent CRM data extraction** that analyzes conversations and extracts customer insights automatically using GPT-4.

## Methods Implemented

### 1. `extractCustomerData(conversationId, messageHistory)`

**Purpose:** Analyze conversation to find customer insights

**How It Works:**
1. Checks if `enable_crm_extraction` config is enabled
2. Builds conversation context from message history
3. Sends to GPT-4 with specialized extraction prompt
4. Returns structured insights with confidence score

**Extraction Categories:**
- **Preferred Times** - When customer likes appointments
- **Preferred Staff** - Favorite staff members
- **Preferred Services** - Services they're interested in
- **Fears/Anxieties** - Phobias, nervousness, concerns
- **Allergies** - Medical allergies and sensitivities  
- **Physical Limitations** - Accessibility needs
- **Special Requests** - Accommodation needs
- **Behavioral Notes** - Patterns and tendencies
- **Other Insights** - General observations

**Example Input:**
```
Customer: "I'd like to book a cleaning. I get really nervous at the dentist though."
Assistant: "I understand, many patients feel that way. We can make sure you're comfortable."
Customer: "Thanks! I prefer mornings if possible, around 10am works best for me."
```

**Example Output:**
```json
{
  "newInsights": {
    "preferredTimes": "mornings, around 10am",
    "fearsAnxieties": "gets nervous at the dentist",
    "preferredServices": "teeth cleaning"
  },
  "confidence": 0.85,
  "conversationId": "conv_123",
  "extractedAt": "2025-10-21T14:30:00Z"
}
```

**GPT Prompt Strategy:**
- Uses GPT-4 (not GPT-4o-mini) for better extraction accuracy
- Temperature 0.3 for factual, consistent extraction
- JSON response format for structured data
- Conversational, natural extraction (not robotic)
- Only extracts clearly stated or strongly implied information

### 2. `updateContactWithInsights(contactId, extractedData)`

**Purpose:** Save extracted insights to contact profile

**How It Works:**
1. Checks confidence threshold (minimum 0.3)
2. Fetches existing contact data from database
3. Intelligently merges new insights with existing data
4. Updates only fields with new information
5. Logs all changes for transparency

**Smart Merging Logic:**
- **Empty Field** → Add new insight directly
- **Existing Data** → Check if already mentioned
- **New Information** → Append with bullet point
- **Duplicate** → Skip to avoid redundancy

**Example Merge:**
```
Existing: "mornings"
New:      "around 10am specifically"
Result:   "mornings\n• around 10am specifically"

Existing: "dental anxiety"
New:      "dental anxiety"  
Result:   "dental anxiety" (no change - already mentioned)
```

**Logging:**
```
🔍 Extracting CRM data from conversation conv_123 (8 messages)
✅ Extracted 3 customer insights (confidence: 0.85)
   Insights: {
     "preferredTimes": "mornings, around 10am",
     "fearsAnxieties": "gets nervous at the dentist",
     "preferredServices": "teeth cleaning"
   }
   ✨ Adding preferred times: mornings, around 10am
   ✨ Adding fears/anxieties: gets nervous at the dentist
   ✨ Adding preferred services: teeth cleaning
✅ Updated contact abc-123 with CRM insights (3 fields)
```

## Configuration Integration

**Controlled by `enable_crm_extraction` toggle:**
```typescript
const config = await botConfigService.getConfig();

if (!config.enable_crm_extraction) {
  console.log('🚫 CRM data extraction disabled in configuration');
  return { confidence: 0 };
}
```

Users can enable/disable in Bot Configuration → Advanced Controls

## Technical Details

**Model:** GPT-4 (gpt-4o)
- More accurate than GPT-4o-mini for nuanced extraction
- Better at detecting implied information
- Higher quality natural language understanding

**Temperature:** 0.3
- Lower than normal (0.7) for factual extraction
- Reduces hallucinations
- More consistent results

**Confidence Threshold:** 0.3
- Minimum confidence to save insights
- Prevents low-quality extractions
- Balances data collection vs accuracy

**Field Mapping:**
```typescript
newInsights.preferredTimes     → contact.preferred_times
newInsights.preferredStaff     → contact.preferred_staff
newInsights.preferredServices  → contact.preferred_services
newInsights.fearsAnxieties     → contact.fears_anxieties
newInsights.allergies          → contact.allergies
newInsights.physicalLimitations → contact.physical_limitations
newInsights.specialRequests    → contact.special_requests
newInsights.behavioralNotes    → contact.behavioral_notes
newInsights.other              → contact.customer_insights
```

## Example Extractions

### Example 1: Booking Preferences
**Conversation:**
> Customer: "I can only come on Tuesdays or Thursdays"
> Customer: "And I really need Dr. Smith if possible, she's great"

**Extracted:**
```json
{
  "preferredTimes": "Tuesdays or Thursdays only",
  "preferredStaff": "Dr. Smith - customer specifically requested"
}
```

### Example 2: Medical Information
**Conversation:**
> Customer: "I should mention I'm allergic to latex"
> Customer: "Also I have a wheelchair, is there parking nearby?"

**Extracted:**
```json
{
  "allergies": "latex allergy",
  "physicalLimitations": "wheelchair user, needs accessible parking"
}
```

### Example 3: Behavioral Patterns
**Conversation:**
> Customer: "Sorry I'm late again, traffic was terrible"
> Assistant: "No problem! Maybe we should book you 15 minutes early next time?"
> Customer: "That's a great idea, I'm always running behind"

**Extracted:**
```json
{
  "behavioralNotes": "tends to run late due to traffic, suggest booking 15 min early buffer"
}
```

### Example 4: Fears & Anxieties
**Conversation:**
> Customer: "I'm really scared of needles"
> Customer: "Can we use numbing gel first?"
> Assistant: "Absolutely, we always use topical anesthetic"

**Extracted:**
```json
{
  "fearsAnxieties": "needle phobia, prefers topical numbing gel before injections"
}
```

## Privacy & Data Handling

**GDPR Compliance:**
- Only processes data from conversations customer initiated
- Stores only information customer voluntarily shared
- Can be disabled via `enable_crm_extraction` toggle
- All data deletable via contact management

**Data Minimization:**
- Extracts only relevant business information
- No sensitive financial data stored
- No unnecessary personal details
- Confidence threshold prevents over-collection

**Transparency:**
- All extractions logged with timestamps
- Changes tracked in database (`updated_at`)
- Staff can see what was extracted
- Customer can request their data

## Error Handling

**Graceful Failures:**
```typescript
try {
  // Extraction logic
} catch (error) {
  console.error('❌ CRM data extraction error:', error.message);
  return { confidence: 0 }; // Return empty, don't crash
}
```

**Safe Defaults:**
- Empty conversation → confidence 0, no extraction
- GPT error → log error, return empty
- Database error → log error, skip update
- Never blocks conversation flow

## Performance Considerations

**Cost Optimization:**
- Only extracts when enabled in config
- Uses confidence threshold to skip low-quality data
- Merges intelligently to avoid duplicate API calls
- Caches contact data during update

**Timing:**
- Async extraction doesn't block responses
- Can run after conversation completes
- No impact on user experience
- Batch processing possible for multiple conversations

## Next Step: Phase 1.6

**Integration into Conversation Flow:**
- Call `extractCustomerData()` after conversations
- Trigger on conversation end or periodically
- Call `updateContactWithInsights()` to save
- Add to message processing pipeline

✅ **Phase 1.5 COMPLETE**

**CRM extraction intelligence is ready - just needs to be hooked into the conversation flow!**
