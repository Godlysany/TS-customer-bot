# Multi-Session Service Booking Guide

## Overview
Many professional services require multiple sequential appointments. Your WhatsApp bot can autonomously handle complex multi-session bookings with configurable strategies, buffer times, and progress tracking.

## Why This Matters

**Traditional Booking:** Manual coordination of multiple appointments  
**Your Smart System:** Automated multi-session booking with intelligent scheduling

**Use Cases:**
- **Dentist:** 3-session dental implant (placement → healing check → crown installation)
- **Driving School:** 10-lesson starter package (flexible scheduling)
- **Physiotherapy:** 6-session treatment plan (weekly sessions)
- **Aesthetic Treatments:** 4-session laser hair removal (monthly intervals)
- **Personal Training:** 12-session fitness program (2x per week)

## Database Schema

### Services Table - New Fields
```sql
-- Multi-session booking configuration
requires_multiple_sessions BOOLEAN DEFAULT false
total_sessions_required INTEGER DEFAULT 1
multi_session_strategy VARCHAR(20) DEFAULT 'flexible'
  -- Options: 'immediate', 'sequential', 'flexible'
session_buffer_config JSONB
  -- Example: {"default_days": 7, "session_2_to_3_days": 30}
```

### Bookings Table - New Fields
```sql
-- Multi-session tracking
is_part_of_multi_session BOOLEAN DEFAULT false
session_group_id UUID  -- Links all sessions in a group
session_number INTEGER DEFAULT 1  -- 1, 2, 3, etc.
total_sessions INTEGER DEFAULT 1  -- Total sessions in group
```

## Three Booking Strategies

### 1. Immediate Strategy - Book All Upfront

**When to Use:**
- Treatment requires commitment to full sequence
- Sessions must be properly spaced
- Customer needs to plan far in advance
- Limited availability requires advance blocking

**Examples:**
- **Dental Implant:** 3 sessions over 3 months
- **Laser Treatment:** 6 sessions monthly
- **Orthodontics:** Multiple adjustment appointments

**Configuration:**
```json
{
  "requires_multiple_sessions": true,
  "total_sessions_required": 3,
  "multi_session_strategy": "immediate",
  "session_buffer_config": {
    "session_1_to_2_days": 14,
    "session_2_to_3_days": 30
  }
}
```

**Bot Behavior:**
```
Bot: "The dental implant procedure requires 3 appointments:
     
     Session 1: Implant placement
     Session 2: Healing check (2 weeks later)
     Session 3: Crown installation (1 month after Session 2)
     
     Let's schedule all three now. When would you like to start?"

Customer: "How about March 1st?"

Bot: "Perfect! Here's your complete schedule:
     
     📅 Session 1: March 1, 2:00 PM - Implant placement
     📅 Session 2: March 15, 2:00 PM - Healing check
     📅 Session 3: April 15, 2:00 PM - Crown installation
     
     Does this work for you?"

Customer: "Yes!"

Bot: [Creates 3 bookings with session_group_id linking them all]
     "✅ All 3 sessions confirmed! You'll receive reminders before each appointment."
```

**Database Result:**
```sql
-- Booking 1
session_group_id: '123e4567-e89b-12d3-a456-426614174000'
session_number: 1
total_sessions: 3
start_time: '2025-03-01 14:00:00'

-- Booking 2
session_group_id: '123e4567-e89b-12d3-a456-426614174000'
session_number: 2
total_sessions: 3
start_time: '2025-03-15 14:00:00'

-- Booking 3
session_group_id: '123e4567-e89b-12d3-a456-426614174000'
session_number: 3
total_sessions: 3
start_time: '2025-04-15 14:00:00'
```

### 2. Sequential Strategy - Book After Completion

**When to Use:**
- Customer needs flexibility
- Future availability uncertain
- Treatment plan may adjust based on progress
- Customer prefers not to commit to all dates

**Examples:**
- **Physiotherapy:** Book next session after seeing progress
- **Training Program:** Schedule next lesson after completing current
- **Therapy Sessions:** Book weekly as patient progresses

**Configuration:**
```json
{
  "requires_multiple_sessions": true,
  "total_sessions_required": 10,
  "multi_session_strategy": "sequential",
  "session_buffer_config": {
    "minimum_days": 2,
    "maximum_days": 14
  }
}
```

**Bot Behavior:**

**First Booking:**
```
Bot: "The physiotherapy treatment plan includes 10 sessions total.
     We'll book them one at a time so you can schedule flexibly.
     
     When would you like your first session?"

Customer: "Tuesday at 4pm"

Bot: "✅ Session 1 of 10 confirmed for Tuesday, March 5 at 4:00 PM.
     After you complete this session, I'll help you book Session 2."
```

**After First Session Completes:**
```
[Automatic trigger when booking status changes to 'completed']

Bot: "Great job completing Session 1! You have 9 sessions remaining.
     
     When would you like to schedule Session 2?
     (Recommended: Within the next 7 days for optimal results)"

Customer: "Friday at 4pm works"

Bot: "✅ Session 2 of 10 confirmed for Friday, March 8 at 4:00 PM."
```

**Progress Tracking:**
```
After Session 5:
Bot: "Excellent! You're halfway through - 5 sessions complete, 5 to go.
     When would you like Session 6?"

After Session 10:
Bot: "🎉 Congratulations! You've completed all 10 physiotherapy sessions.
     How are you feeling? Would you like to book a follow-up evaluation?"
```

### 3. Flexible Strategy - Customer Choice

**When to Use:**
- Customer wants full control over scheduling
- No strict timing requirements
- Package/bundle service
- Customer has unpredictable availability

**Examples:**
- **Driving Lessons:** 10-lesson package, book as needed
- **Massage Package:** 5-massage bundle, schedule at own pace
- **Tutoring Sessions:** 8-session course, flexible timing

**Configuration:**
```json
{
  "requires_multiple_sessions": true,
  "total_sessions_required": 10,
  "multi_session_strategy": "flexible",
  "session_buffer_config": {
    "minimum_days": 0,  // Can book consecutive days
    "suggested_frequency": "2 per week"
  }
}
```

**Bot Behavior:**
```
Bot: "The driving lesson starter package includes 10 lessons total.
     You can book as many or as few at a time as you'd like - totally flexible.
     
     How many lessons would you like to schedule now?"

Customer: "Let's do 3 to start"

Bot: "Perfect! Let's find times for your first 3 lessons.
     
     Lesson 1: When works for you?"
Customer: "Monday 5pm"

Bot: "Lesson 2: Another time?"
Customer: "Wednesday 5pm"

Bot: "Lesson 3: And one more?"
Customer: "Friday 5pm"

Bot: "✅ Confirmed! Here's your schedule:
     
     📅 Lesson 1 of 10: Monday, March 4, 5:00 PM
     📅 Lesson 2 of 10: Wednesday, March 6, 5:00 PM
     📅 Lesson 3 of 10: Friday, March 8, 5:00 PM
     
     You have 7 lessons remaining. Book more anytime!"
```

**Later:**
```
Customer: "I want to book 2 more lessons"

Bot: "Great! You have 7 lessons remaining in your package.
     
     Let's schedule 2 more. When would you like them?"

[After booking]
Bot: "✅ 2 more lessons confirmed! You've now completed 5 of 10.
     5 lessons remaining."
```

## Buffer Time Configuration

### Simple Buffer (Same Between All Sessions)
```json
{
  "session_buffer_config": {
    "default_days": 7
  }
}
```
**Behavior:** All sessions must be at least 7 days apart

### Complex Buffer (Different Between Specific Sessions)
```json
{
  "session_buffer_config": {
    "session_1_to_2_days": 14,
    "session_2_to_3_days": 30,
    "session_3_to_4_days": 7
  }
}
```
**Behavior:**
- Session 1 → Session 2: Minimum 14 days
- Session 2 → Session 3: Minimum 30 days (healing period)
- Session 3 → Session 4: Minimum 7 days

### Range Buffer (Min and Max)
```json
{
  "session_buffer_config": {
    "minimum_days": 2,
    "maximum_days": 14,
    "recommended_days": 7
  }
}
```
**Behavior:**
- Sessions cannot be less than 2 days apart
- Sessions should not be more than 14 days apart
- Bot suggests 7-day intervals

### No Buffer Required
```json
{
  "session_buffer_config": {
    "minimum_days": 0
  }
}
```
**Behavior:** Sessions can be on consecutive days if customer prefers

## Bot Intelligence Examples

### Example 1: Dental Implant (Immediate Strategy)

**Service Configuration:**
```json
{
  "name": "Dental Implant - Complete Treatment",
  "requires_multiple_sessions": true,
  "total_sessions_required": 3,
  "multi_session_strategy": "immediate",
  "trigger_words": ["implant", "tooth implant", "dental implant"],
  "session_buffer_config": {
    "session_1_to_2_days": 14,
    "session_2_to_3_days": 30
  }
}
```

**Conversation:**
```
Customer: "I need a dental implant"

Bot: "I can help you with that! A dental implant treatment consists of 3 appointments:
     
     1️⃣ Implant placement (90 minutes)
     2️⃣ Healing check - 2 weeks after placement (30 minutes)
     3️⃣ Crown installation - 1 month after healing check (60 minutes)
     
     The complete treatment takes about 6 weeks total.
     Let's schedule all three appointments now.
     
     When would you like to start with the implant placement?"

Customer: "How about March 10th at 2pm?"

Bot: "Checking availability... ✅ March 10 at 2pm is available!
     
     Based on the required healing periods, here's your full schedule:
     
     📅 **Session 1:** March 10, 2:00 PM - Implant placement (90 min)
     📅 **Session 2:** March 24, 2:00 PM - Healing check (30 min)
     📅 **Session 3:** April 24, 2:00 PM - Crown installation (60 min)
     
     Total cost: CHF 3,500 for all 3 sessions
     
     Does this schedule work for you?"

Customer: "Perfect!"

Bot: "✅ Excellent! All 3 appointments confirmed.
     
     You'll receive:
     - Confirmation email with all dates
     - Reminder 24 hours before each appointment
     - Care instructions after Sessions 1 and 2
     
     See you March 10th! If you need to reschedule any appointment, 
     please let me know at least 48 hours in advance."
```

### Example 2: Driving Lessons (Flexible Strategy)

**Service Configuration:**
```json
{
  "name": "Driving Lessons - Starter Package (10 Lessons)",
  "requires_multiple_sessions": true,
  "total_sessions_required": 10,
  "multi_session_strategy": "flexible",
  "trigger_words": ["driving lesson", "learn to drive", "driving school"],
  "session_buffer_config": {
    "minimum_days": 0,
    "recommended_frequency": "2-3 per week"
  }
}
```

**Conversation:**
```
Customer: "I want to learn to drive"

Bot: "Great! Our Starter Package includes 10 driving lessons.
     You can schedule them flexibly - book all 10 now, or a few at a time.
     
     Most students book 2-3 lessons per week.
     
     How many lessons would you like to schedule right now?"

Customer: "Let's start with 5"

Bot: "Perfect! Let's find times for your first 5 lessons.
     Do you have specific days/times that work best?"

Customer: "Mondays and Wednesdays at 6pm, and Saturday mornings"

Bot: "Got it! Here are available slots:
     
     Monday, March 4, 6:00 PM ✅
     Wednesday, March 6, 6:00 PM ✅
     Saturday, March 9, 10:00 AM ✅
     Monday, March 11, 6:00 PM ✅
     Wednesday, March 13, 6:00 PM ✅
     
     Should I book these 5 lessons?"

Customer: "Yes!"

Bot: "✅ Confirmed! Here's your schedule:
     
     📅 Lesson 1 of 10: Mon, Mar 4, 6:00 PM
     📅 Lesson 2 of 10: Wed, Mar 6, 6:00 PM
     📅 Lesson 3 of 10: Sat, Mar 9, 10:00 AM
     📅 Lesson 4 of 10: Mon, Mar 11, 6:00 PM
     📅 Lesson 5 of 10: Wed, Mar 13, 6:00 PM
     
     **Progress:** 5 lessons booked, 5 remaining
     
     You can book the remaining 5 lessons anytime! Just message me 
     when you're ready to schedule more."

[After completing 3 lessons]

Bot: "Hi! I see you've completed 3 lessons - great progress! 🚗
     
     You have 2 more booked and 5 still available in your package.
     Would you like to schedule more lessons now?"
```

### Example 3: Physiotherapy (Sequential Strategy)

**Service Configuration:**
```json
{
  "name": "Physiotherapy Treatment Plan",
  "requires_multiple_sessions": true,
  "total_sessions_required": 8,
  "multi_session_strategy": "sequential",
  "trigger_words": ["physiotherapy", "physio", "physical therapy"],
  "session_buffer_config": {
    "minimum_days": 2,
    "maximum_days": 7,
    "recommended_days": 3
  }
}
```

**Conversation:**
```
Customer: "I need physiotherapy for my back pain"

Bot: "I can help! Based on your needs, we recommend an 8-session 
     treatment plan. We'll book one session at a time so we can 
     adjust based on your progress.
     
     For best results, sessions should be 2-7 days apart 
     (ideally every 3 days).
     
     When would you like your first session?"

Customer: "Tomorrow at 10am if possible"

Bot: "Checking... ✅ Tomorrow (March 5) at 10:00 AM is available!
     
     📅 **Session 1 of 8** confirmed: March 5, 10:00 AM (45 min)
     Cost: CHF 120
     
     After your first session, I'll help you schedule Session 2.
     See you tomorrow!"

[After Session 1 is marked complete in system]

Bot: "Great job completing Session 1! 💪
     
     **Progress:** 1 of 8 sessions complete
     
     For optimal results, Session 2 should be within the next 7 days.
     When would you like to schedule it?"

Customer: "Same time on Friday?"

Bot: "Friday, March 8 at 10:00 AM? Perfect!
     
     📅 **Session 2 of 8** confirmed: March 8, 10:00 AM
     
     You're making excellent progress. 7 sessions to go!"
```

## Progress Tracking & Notifications

### Automatic Progress Updates

**After Each Session:**
```
"✅ Session 2 of 10 complete! You have 8 sessions remaining."
```

**Halfway Point:**
```
"🎉 Milestone! You're halfway through - 5 of 10 sessions complete!"
```

**Near Completion:**
```
"Almost there! Session 9 of 10 complete. Just 1 more to go!"
```

**Completion:**
```
"🏆 Congratulations! You've completed all 10 sessions of your treatment plan!
 
 How are you feeling? Would you like to:
 - Book a follow-up evaluation?
 - Purchase another package?
 - Share feedback on your experience?"
```

### Reminder Logic for Multi-Session

**For Immediate Strategy (All Booked):**
- Reminder 24h before each session
- Reminder includes session number: "Reminder: Session 2 of 3 tomorrow at 2pm"

**For Sequential Strategy (Book After Completion):**
- Standard reminder for current booking
- Proactive outreach after completion: "Ready to book Session 4?"
- Warning if too much time passes: "It's been 10 days since Session 3. Book Session 4 soon for best results!"

**For Flexible Strategy (Customer Paced):**
- Reminder for booked sessions
- Periodic check-ins: "You have 5 lessons remaining in your package. Would you like to schedule more?"
- Expiration warnings if applicable: "Your package expires in 30 days. 5 sessions still available!"

## Admin Dashboard Features

### Multi-Session View
```
Customer: Marie Schmidt
Service: Dental Implant
Strategy: Immediate

Progress: 2 of 3 complete
✅ Session 1: March 10 - Completed
✅ Session 2: March 24 - Completed
📅 Session 3: April 24 - Confirmed

Next Action: Send Session 3 reminder on April 23
```

### Package Management
```
Customer: Thomas Weber
Service: Driving Lessons (10-lesson package)
Strategy: Flexible

Progress: 7 of 10 booked, 4 completed

Booked Sessions:
✅ Lesson 1: March 4 - Completed
✅ Lesson 2: March 6 - Completed
✅ Lesson 3: March 9 - Completed
✅ Lesson 4: March 11 - Completed
📅 Lesson 5: March 13 - Confirmed
📅 Lesson 6: March 18 - Confirmed
📅 Lesson 7: March 20 - Confirmed

Remaining: 3 unscheduled lessons
```

## Business Benefits

### For Customers:
- ✅ Easy multi-appointment booking (no back-and-forth)
- ✅ Clear progress tracking
- ✅ Flexible scheduling options
- ✅ Automatic reminders for each session
- ✅ Transparency on commitment

### For Business:
- ✅ Guaranteed future bookings (immediate strategy)
- ✅ Reduced admin work (automated booking flow)
- ✅ Better calendar planning (know future appointments)
- ✅ Increased revenue (packages encourage full completion)
- ✅ Customer retention (ongoing treatment plans)
- ✅ Analytics on completion rates

## Implementation Roadmap

1. **Database Schema:** ✅ Already added to supabase-schema.sql
2. **Bot Logic:** Update BookingChatHandler to support multi-session
3. **Admin UI:** Add multi-session configuration to Services Management
4. **Progress Tracking:** Implement session completion triggers
5. **Analytics:** Track completion rates and popular strategies

---

This multi-session booking system transforms your bot from a simple appointment scheduler into a comprehensive treatment plan manager that handles complex scheduling scenarios autonomously.
