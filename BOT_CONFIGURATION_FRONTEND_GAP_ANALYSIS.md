# Bot Configuration Frontend - Gap Analysis
**Date:** October 21, 2025

## Summary
The backend has **comprehensive bot configuration** with 40+ settings across business details, escalation modes, confirmation templates, service restrictions, and more. The current frontend only exposes ~10% of this functionality.

---

## Backend Features (From Database & MASTER_SYSTEM_PROMPT)

### 1. Business Details & Context (MISSING in Frontend)
**Database Settings:**
- `business_name` - Business name
- `business_address` - Physical address
- `business_phone` - Contact phone
- `business_email` - Contact email  
- `business_location` - Location description
- `business_directions` - How to get there
- `opening_hours` - Business hours

**Used in Master Prompt:**
- `{BUSINESS_NAME}` - Personalize bot
- `{OPENING_HOURS}` - Booking time constraints
- `{LOCATION}` - Where to go
- `{DIRECTIONS}` - How to get there

**Current Frontend:** ❌ Only has generic "businessInfo" textarea

---

### 2. Two-Tier Prompt Architecture (INCORRECT in Frontend)

**Backend Design:**
- **Master System Prompt** (FIXED, NON-EDITABLE) - Core instructions in MASTER_SYSTEM_PROMPT.md
- **Business Fine-Tuning Prompt** (EDITABLE) - Personality, tone, business-specific flavor

**Current Frontend:** ❌ Has editable "systemPrompt" which suggests editing the master prompt (wrong!)

**Correct Implementation:**
- Show Master System Prompt as READ-ONLY preview
- Add "Business Fine-Tuning Prompt" field (editable)
- Explain the two-tier architecture to admins

---

### 3. Service Configuration (MISSING in Frontend)

**Database Settings:**
- `service_trigger_words` - JSON mapping of services to trigger keywords
  ```json
  {
    "dental_cleaning": ["cleaning", "checkup", "hygiene"],
    "root_canal": ["root canal", "pain", "toothache"]
  }
  ```
- `service_time_restrictions` - JSON of time constraints per service
  ```json
  {
    "dental_implant": {"min_slot_hours": 2, "only_mornings": true}
  }
  ```
- `emergency_blocker_slots` - Table of blocked times (holidays, emergencies)

**Used in Master Prompt:**
- `{AVAILABLE_SERVICES}` - List services
- `{SERVICE_TRIGGER_WORDS}` - Understand customer requests
- `{SERVICE_RESTRICTIONS}` - Booking constraints

**Current Frontend:** ❌ None of this exists

---

### 4. Email Collection Configuration (MISSING in Frontend)

**Database Settings:**
- `email_collection_mode` - "mandatory" | "gentle" | "skip"
- `email_collection_prompt_gentle` - How to ask nicely
- `email_collection_prompt_mandatory` - Firm requirement message

**Used in Master Prompt:**
- `{EMAIL_REQUIREMENT_INSTRUCTION}` - Dynamic email collection behavior

**Current Frontend:** ❌ Not configurable

---

### 5. Confirmation Templates (MISSING in Frontend)

**WhatsApp Confirmation:**
- `whatsapp_confirmation_enabled` - Boolean
- `whatsapp_confirmation_template` - Template with placeholders
  - Placeholders: `{{name}}`, `{{service}}`, `{{datetime}}`, `{{cost}}`, `{{location}}`, `{{directions}}`

**Email Confirmation:**
- `email_confirmation_enabled` - Boolean
- `email_confirmation_template` - Email body template
- `email_confirmation_subject` - Subject line template

**Current Frontend:** ❌ Not configurable (hardcoded)

---

### 6. Escalation Configuration (OUTDATED in Frontend)

**Backend (New Structured Approach):**
- `escalation_config` - Comprehensive JSON object:
  ```json
  {
    "mode": "sentiment_and_keyword",
    "enabled": true,
    "triggers": {
      "keywords": ["complaint", "refund", "angry"],
      "sentiment_threshold": -0.3
    },
    "behavior": {
      "escalation_message": "...",
      "notify_agents": true,
      "pause_bot": true
    },
    "modes_available": {
      "keyword_only": "...",
      "sentiment_only": "...",
      "sentiment_and_keyword": "...",
      "sentiment_then_keyword": "...",
      "manual_only": "..."
    }
  }
  ```

**Current Frontend:** ❌ Uses deprecated `escalationTriggers` array (simple keyword list)

**Needed:**
- Mode selector (5 modes)
- Keyword editor (with mode-specific behavior)
- Sentiment threshold slider
- Escalation message editor
- Test harness (example scenarios)

---

### 7. Tone & Response Style (PARTIALLY in Frontend)

**Backend:**
- Part of Business Fine-Tuning Prompt (freeform)
- OR structured dropdowns for quick selection

**Current Frontend:** ✅ Has `toneOfVoice` and `responseStyle` dropdowns (GOOD)

---

### 8. Questionnaires (PARTIALLY in Frontend)

**Current Frontend:** ✅ Has basic questionnaire builder (GOOD)

**Missing:**
- Link questionnaires to services (trigger before specific bookings)
- Link to promotions (reward completion)

---

## Proposed New Frontend Structure

### Tab 1: **Business Details** (NEW)
**Purpose:** Configure business-specific information for bot personalization

**Fields:**
- Business Name
- Address
- Phone
- Email
- Location Description (for directions)
- Directions (how to get there)
- Opening Hours (structured input: Mon-Fri 9am-6pm, Sat 9am-2pm, etc.)

**Save Button:** Updates all business_* settings

---

### Tab 2: **GPT Prompts & Tone** (REDESIGN)

**Section 1: Master System Prompt (Read-Only)**
- Show MASTER_SYSTEM_PROMPT.md content
- Explain: "This is the core AI brain. It cannot be edited to ensure professional behavior."
- Preview button to see full prompt

**Section 2: Business Fine-Tuning Prompt (Editable)**
- Large textarea for personality customization
- Placeholder examples:
  ```
  You are a friendly Swiss dental practice assistant. 
  Always address customers formally (Sie) in German.
  Show empathy for nervous patients.
  ```
- Save to `business_fine_tuning_prompt` setting

**Section 3: Quick Tone Settings**
- Tone of Voice dropdown (Professional, Friendly, Empathetic, etc.)
- Response Style dropdown (Concise, Balanced, Detailed)

---

### Tab 3: **Service Configuration** (NEW)

**Section 1: Service Trigger Words**
- For each service, list of trigger keywords
- Example:
  ```
  Dental Cleaning: cleaning, checkup, hygiene, polish
  Root Canal: root canal, severe pain, infection
  ```

**Section 2: Service Time Restrictions**
- Per service: minimum slot duration, time-of-day restrictions
- Example:
  ```
  Dental Implant: 
    - Minimum 2 hours
    - Only mornings (before 12pm)
  ```

**Section 3: Emergency Blocker Slots**
- Table of blocked times (holidays, staff vacations)
- Add/remove blocked date ranges

---

### Tab 4: **Confirmation Templates** (NEW)

**Section 1: WhatsApp Confirmation**
- Enable/Disable toggle
- Template editor with placeholder hints
- Preview with sample data

**Section 2: Email Confirmation**
- Enable/Disable toggle
- Subject line editor
- Body template editor
- Placeholder list: {{name}}, {{service}}, {{datetime}}, {{cost}}, {{location}}, {{directions}}

---

### Tab 5: **Escalation Configuration** (REDESIGN)

**Section 1: Escalation Mode**
- Radio buttons for 5 modes:
  - ○ Keyword Only
  - ○ Sentiment Only
  - ● Sentiment AND Keyword (default)
  - ○ Sentiment THEN Keyword
  - ○ Manual Only
- Description of each mode

**Section 2: Trigger Configuration**
- Keyword editor (pills/tags interface)
- Sentiment threshold slider (-1.0 to 0.0)
- Visual feedback of current threshold

**Section 3: Escalation Behavior**
- Escalation message editor
- Agent notification template
- Toggles: Notify agents, Pause bot

**Section 4: Test Harness**
- Input box: "Enter test message"
- Output: "Would escalate: YES/NO, Reason: ..."
- Example scenarios (links to test)

---

### Tab 6: **Email & Contact Collection** (NEW)

**Email Collection Mode:**
- Radio buttons:
  - ○ Mandatory (require before booking)
  - ○ Gentle (ask nicely, allow skip)
  - ○ Skip (don't ask)

**Prompts:**
- Gentle prompt editor
- Mandatory prompt editor

---

### Tab 7: **Questionnaires** (KEEP, ENHANCE)
- Current questionnaire builder ✅
- Add: Link to services (trigger before specific bookings)
- Add: Link to promotions (reward completion)

---

### Tab 8: **Advanced Controls** (KEEP)
- Current feature toggles ✅

---

## Implementation Plan

### Phase 1: Redesign Tab Structure
- Update tabs list in BotConfiguration.tsx
- Create new tab components

### Phase 2: Build New Settings Pages
- Business Details form
- Service Configuration interface
- Confirmation Templates editor
- Email Collection config

### Phase 3: Redesign Existing
- Rewrite GPT Prompts & Tone tab (two-tier architecture)
- Rewrite Escalation tab (comprehensive config)

### Phase 4: API Integration
- Create `/api/bot-config/*` endpoints for all settings
- Batch save operations
- Validation

### Phase 5: Testing & UX Polish
- Test all configurations save correctly
- Preview functionality
- Help text and tooltips

---

## Priority

**HIGH PRIORITY** (Critical for bot to work correctly):
1. Business Details (business name, opening hours, location)
2. Escalation Configuration (fix deprecated approach)
3. GPT Prompts redesign (two-tier architecture)

**MEDIUM PRIORITY** (Improves functionality):
4. Service Configuration (trigger words, restrictions)
5. Confirmation Templates (customization)

**LOW PRIORITY** (Nice to have):
6. Email Collection config
7. Questionnaire enhancements

---

## Estimated Effort
- Tab redesign + new components: **8-12 hours**
- API endpoints + backend integration: **4-6 hours**
- Testing & polish: **2-3 hours**
- **Total: 14-21 hours**

---

This gap analysis shows the current frontend is only exposing ~10% of the bot's configuration capability. A complete redesign is needed to match the sophisticated backend infrastructure.
