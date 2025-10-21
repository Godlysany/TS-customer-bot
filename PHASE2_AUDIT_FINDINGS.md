# Phase 2: Questionnaire System Audit Findings

## 🚨 Critical Production Mismatches Found

### 1. **Missing Database Columns**

**Frontend expects (QuestionnaireSection.tsx):**
```typescript
interface Questionnaire {
  trigger_type: string;
  linked_services?: string[];      // ❌ NOT IN DATABASE
  linked_promotions?: string[];    // ❌ NOT IN DATABASE
}
```

**Production database has (supabase-schema.sql):**
```sql
CREATE TABLE questionnaires (
    trigger_type VARCHAR(100),
    questions JSONB,
    -- Missing: linked_services
    -- Missing: linked_promotions
)
```

**Impact:** Service-specific questionnaires cannot be saved or loaded.

---

### 2. **Trigger Type Mismatch**

**Frontend offers 5 trigger types:**
1. `manual` - Agent triggers manually ✅
2. `before_booking` - Auto-trigger before any booking ❌
3. `after_booking` - After booking confirmation ❌
4. `first_contact` - New customer ✅ (as `new_contact`)
5. `service_specific` - Linked to specific services ❌

**Backend currently supports only 3:**
- `new_contact`
- `first_booking`
- `manual`

**Impact:** Admins can configure triggers that never fire.

---

### 3. **Question Type Mismatch**

**Frontend allows:**
- `text`
- `multiple_choice`
- `yes_no`

**Backend expects:**
- `text`
- `single_choice`
- `multiple_choice`
- `yes_no`
- `number`

**Impact:** Minor inconsistency in question type handling.

---

## 📋 Complete Questionnaire System Requirements

### **Trigger Types (5 total)**

| Trigger Type | When It Fires | Where to Implement |
|--------------|---------------|-------------------|
| `manual` | Agent clicks "Send questionnaire" button | Admin UI action |
| `before_booking` | Before any booking is confirmed | BookingChatHandler, before creating booking |
| `after_booking` | After booking confirmation sent | BookingChatHandler, after confirmation |
| `first_contact` | New customer's first message | ConversationService, on contact creation |
| `service_specific` | Before booking specific services | BookingChatHandler, check linked_services |

### **Question Types (3 required)**

1. **Text** - Free-form text answer
2. **Multiple Choice** - Select options (comma-separated for multiple)
3. **Yes/No** - Boolean answer

### **Conversation Flow**

```
1. Trigger detected
   ↓
2. Check if customer already completed this questionnaire
   ↓
3. Load questionnaire questions
   ↓
4. Ask first question via WhatsApp
   ↓
5. Wait for customer response
   ↓
6. Validate response (required fields, format)
   ↓
7. Store partial response
   ↓
8. If more questions → Ask next question (repeat 5-7)
   ↓
9. If complete → Save to questionnaire_responses
   ↓
10. Continue normal conversation flow
```

### **Database Schema Updates Needed**

**questionnaires table:**
```sql
ALTER TABLE questionnaires
ADD COLUMN IF NOT EXISTS linked_services UUID[],
ADD COLUMN IF NOT EXISTS linked_promotions UUID[];

CREATE INDEX IF NOT EXISTS idx_questionnaires_trigger_type 
  ON questionnaires(trigger_type) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_questionnaires_linked_services 
  ON questionnaires USING GIN(linked_services);
```

**questionnaire_responses table:**
- Already correct, no changes needed

---

## 🏗️ Implementation Plan

### **Phase 2.1: Database Schema Updates**
- Add missing columns to production schema
- Add performance indexes
- Update both dev and prod schemas

### **Phase 2.2: Backend Service Updates**
- Update QuestionnaireService to support all 5 trigger types
- Add `linked_services` and `linked_promotions` to types
- Implement service-specific questionnaire lookup

### **Phase 2.3: Conversation Context Manager**
- Build questionnaire conversation state tracker
- Store: current questionnaire ID, current question index, partial responses
- Handle interruptions and resumption

### **Phase 2.4: Question Delivery System**
- Format questions conversationally for WhatsApp
- Handle all question types
- Add question numbers and progress indicators

### **Phase 2.5: Response Validation & Parsing**
- Validate required fields
- Parse multiple choice selections
- Handle yes/no variations ("yes", "y", "yeah", "no", "n", "nope")

### **Phase 2.6: Trigger Detection & Integration**
- `first_contact`: ConversationService.getOrCreateConversation
- `before_booking`: BookingChatHandler, before email collection
- `after_booking`: BookingChatHandler, after confirmation sent
- `service_specific`: BookingChatHandler, check linked services
- `manual`: API endpoint for admin to trigger

### **Phase 2.7: WhatsApp Handler Integration**
- Detect if customer is in questionnaire flow
- Route messages to questionnaire handler
- Return to normal conversation after completion

### **Phase 2.8: Production Testing**
- Test all 5 trigger types
- Test all 3 question types
- Test required field validation
- Test partial completion and resumption
- Test multiple questionnaires per contact

---

## ⚠️ Production Safety Checklist

- [ ] Database schema updated in `supabase-schema.sql` (prod)
- [ ] Migration tested in dev environment
- [ ] All trigger types implemented and tested
- [ ] Service linking works correctly
- [ ] Questionnaire doesn't block critical flows (booking)
- [ ] Partial responses saved (crash recovery)
- [ ] Customer can skip optional questionnaires
- [ ] No infinite loops if questionnaire breaks
- [ ] Admin can disable questionnaires instantly
- [ ] Responses stored securely with proper GDPR compliance

---

## 📊 Expected Usage Patterns

**Medical/Dental Practice:**
- `first_contact` → "Welcome! Quick health screening"
- `service_specific` (Surgery) → "Pre-operative checklist"
- `after_booking` → "Preparation instructions"

**Driving School:**
- `first_contact` → "Student information form"
- `before_booking` → "License check & requirements"
- `after_booking` → "What to bring on your lesson"

**Spa/Wellness:**
- `first_contact` → "Health & preferences questionnaire"
- `service_specific` (Massage) → "Pressure preference & allergies"
- `after_booking` → "Arrival instructions"

---

## 🎯 Success Criteria

Phase 2 complete when:
1. ✅ All 5 trigger types work in production
2. ✅ Service-specific linking functional
3. ✅ All question types supported
4. ✅ Responses validated and stored
5. ✅ Admins can see completed questionnaires
6. ✅ System handles edge cases gracefully
7. ✅ No blocking issues in booking flow
8. ✅ Production schema deployed via GitHub Actions

---

**Status:** Audit complete, ready to implement fixes with production-first approach
