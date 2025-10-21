# Phase 2: Questionnaire Trigger Integration

## Trigger Implementation Status

### ✅ COMPLETE: Trigger Types Supported
1. **manual** - Triggered via admin UI
2. **before_booking** - Before booking creation
3. **after_booking** - After booking confirmation
4. **first_contact** - First message from new customer
5. **service_specific** - Before booking specific services

### ✅ COMPLETE: Implemented Triggers

#### 1. First Contact Trigger
**Location**: `src/adapters/whatsapp.ts` (lines 287-312)
**Trigger Condition**: When customer sends their first inbound message
**Logic**: 
- Counts inbound messages in conversation history
- If count === 1, checks for `first_contact` questionnaires
- Starts questionnaire if configured and not already completed
- Sends first question and stops processing (waits for response)

**Code**:
```typescript
const isFirstContact = messageHistory.filter(m => m.direction === 'inbound').length === 1;
if (isFirstContact) {
  const questionnaireMessage = await checkAndTriggerQuestionnaires(
    conversation.id,
    contact.id,
    'first_contact'
  );
  if (questionnaireMessage) {
    // Send first question and return
  }
}
```

### ⚠️ PARTIAL: Booking Triggers (Integration Points Identified)

#### 2. Before Booking Trigger
**Expected Location**: Before `BookingService.createBooking()` is called
**Current Status**: BookingChatHandler collects booking info but doesn't call createBooking
**Integration Point**: Add trigger when actual booking creation is implemented

**Recommended Integration** (when booking creation is added):
```typescript
// In BookingChatHandler or wherever createBooking is called
const questionnaireMessage = await checkAndTriggerQuestionnaires(
  conversation.id,
  contact.id,
  'before_booking',
  serviceId  // For service-specific questionnaires
);

if (questionnaireMessage) {
  // Pause booking flow, send questionnaire
  // Resume booking after completion
  return questionnaireMessage;
}

// Proceed with booking creation
await bookingService.createBooking(...);
```

#### 3. After Booking Trigger
**Expected Location**: After `BookingService.createBooking()` returns successfully
**Current Status**: Same as above - integration point identified but not active
**Integration Point**: Add trigger after booking is confirmed

**Recommended Integration**:
```typescript
// After booking is created
const booking = await bookingService.createBooking(...);

// Trigger after_booking questionnaire
const questionnaireMessage = await checkAndTriggerQuestionnaires(
  conversation.id,
  contact.id,
  'after_booking'
);

if (questionnaireMessage) {
  await sock.sendMessage(sender, { text: questionnaireMessage });
}
```

### 📋 Questionnaire Flow Priority

The message handler implements a 3-tier priority system:

**PRIORITY 1**: Active Questionnaire (highest)
- If customer is mid-questionnaire, route to `handleQuestionnaireResponse()`
- All other intents are blocked until questionnaire completes

**PRIORITY 2**: Active Booking Context
- If customer is mid-booking conversation, route to `BookingChatHandler.handleContextMessage()`

**PRIORITY 3**: Normal Intent Detection
- Detect intent (booking, general question, etc.) and route accordingly

## Implementation Details

### Helper Function: `checkAndTriggerQuestionnaires()`
**Location**: `src/adapters/whatsapp.ts` (lines 121-172)
**Purpose**: Detect and start questionnaires based on trigger type
**Features**:
- Retrieves active questionnaires for trigger type
- Supports service-specific filtering for `before_booking` trigger
- Checks if customer already completed questionnaire (prevents duplicates)
- Starts questionnaire runtime context
- Returns formatted first question

### Runtime Service: `QuestionnaireRuntimeService`
**Location**: `src/core/QuestionnaireRuntimeService.ts`
**Purpose**: Manage in-memory questionnaire conversation state
**Features**:
- Tracks current question index
- Stores collected responses
- Validates responses based on question type (text, multiple_choice, yes_no)
- Handles question formatting for WhatsApp
- Provides progress tracking

## Known Limitations

1. **Booking Trigger Integration**: The before_booking and after_booking triggers are designed but not actively integrated because the booking creation flow is conversation-based and doesn't currently call `BookingService.createBooking()` directly. Integration points are documented above for when booking automation is completed.

2. **Context Persistence**: Questionnaire contexts are stored in-memory. If the server restarts during a questionnaire, customer will need to start over. For production, consider moving to Redis or database storage.

3. **Multiple Simultaneous Questionnaires**: System only allows one questionnaire per conversation at a time. If a customer has both a `first_contact` and `service_specific` questionnaire configured, only the first one triggers.

## Supported Question Types

All 4 question types from the frontend are fully supported:

1. **text**: Free-form text response, no validation except required field check
2. **single_choice**: Customer selects one option from a list
   - Accepts option number (1, 2, 3) or option text (case-insensitive)
   - Validates selection is from available options
3. **multiple_choice**: Customer selects multiple options (comma-separated)
   - Accepts option numbers (1,2,3) or option text
   - Validates all selections are from available options
4. **yes_no**: Binary yes/no question
   - Accepts multilingual patterns: yes/y/yeah/yep/yup/si/ja/oui or no/n/nope/nah/nein/non
   - Case-insensitive

## Testing Recommendations

1. **Test first_contact trigger**:
   - Create a first_contact questionnaire in admin UI
   - Send a WhatsApp message from a new number
   - Verify questionnaire starts automatically

2. **Test all question types**:
   - **Text**: Any free-form answer accepted
   - **Single choice**: Test both number (1) and text ("Option A") selection
   - **Multiple choice**: Test comma-separated selections (1,2,3) and mixed (1, Option B, 3)
   - **Yes/No**: Test multilingual patterns (yes, y, ja, si, oui / no, n, nein, non)

3. **Test validation**:
   - **Required questions**: Verify empty responses are rejected with clear error message
   - **Invalid yes/no**: Verify "maybe" is rejected with helpful prompt
   - **Invalid single choice**: Verify out-of-range numbers (99) and invalid text are rejected
   - **Invalid multiple choice**: Verify invalid options in list are rejected

4. **Test completion**:
   - Complete full questionnaire with all question types
   - Verify "Thank you" completion message
   - Verify all responses saved to database in `questionnaire_responses` table
   - Verify can't re-trigger same questionnaire for same customer

## Next Steps for Complete Integration

1. ✅ Database schema updated with linked_services and linked_promotions
2. ✅ QuestionnaireService supports all 5 trigger types
3. ✅ QuestionnaireRuntimeService built for conversation state
4. ✅ WhatsApp handler integrated with priority routing
5. ✅ first_contact trigger fully implemented
6. ⏸️ before_booking trigger designed (awaits booking automation)
7. ⏸️ after_booking trigger designed (awaits booking automation)
8. 🔄 End-to-end testing needed

## Production Deployment

The production database schema (`supabase-schema.sql`) has been updated with all necessary changes:
- `linked_services` column (TEXT[])
- `linked_promotions` column (TEXT[])
- Indexes on trigger_type, linked_services, linked_promotions
- All 5 trigger types supported

These changes will auto-deploy to production Supabase via GitHub Actions when merged.
