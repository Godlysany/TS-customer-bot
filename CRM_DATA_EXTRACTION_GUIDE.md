# CRM Data Extraction & Customer Profiling Guide

## Overview
Your WhatsApp bot actively builds comprehensive customer profiles through intelligent conversation analysis and strategic data collection. This transforms basic contact information into rich, actionable customer intelligence.

## Why This Matters

**Traditional CRM:** Static fields filled by manual data entry  
**Your Smart CRM:** Dynamic profiles built through natural conversations

**Example Scenario:**
```
First Contact:
Customer: "Hi, I need a dental appointment"
Bot: Extracts → New customer, needs dental service

Second Message:
Customer: "I'm terrified of dental work, last time was awful"
Bot: Stores → Fear: Dental anxiety, negative past experience

Third Message:
Customer: "Can I get an appointment with Dr. Weber? She was so gentle last time"
Bot: Stores → Preferred staff: Dr. Weber, Reason: Gentle approach

Fourth Message:
Customer: "I prefer morning appointments, I'm usually busy after 2pm"
Bot: Stores → Preferred times: Mornings before 2pm
```

After 4 messages, you have a rich profile:
- Name, phone, service interest
- Emotional state: Dental anxiety
- Staff preference: Dr. Weber (gentle)
- Time preference: Mornings
- Communication style: Appreciates detailed care

## Enhanced Contact Fields

### Database Schema
```sql
contacts table additions:
- preferred_staff_member (VARCHAR 255)
- preferred_appointment_times (TEXT)
- special_notes (TEXT)
- communication_preferences (TEXT)
- preferred_services (JSONB array)
```

### Field Definitions

#### 1. Preferred Staff Member
**What:** Staff member the customer prefers to work with  
**Examples:**
- "Dr. Schmidt"
- "Sarah (the blonde physiotherapist)"
- "Any female therapist"
- "Not interested in specific person"

**How to Extract:**
- Customer explicitly requests: "Can I book with Dr. Weber again?"
- Customer mentions positive past experience: "That massage therapist last month was amazing"
- Customer asks: "Will it be the same person as last time?"

**Bot Behavior:**
- Store the preference
- Prioritize that staff member in future bookings
- Mention in confirmations: "You're booked with Dr. Weber as requested"

#### 2. Preferred Appointment Times
**What:** Customer's preferred days/times for appointments  
**Examples:**
- "Mornings only"
- "Weekends if possible"
- "Tuesdays or Thursdays after 3pm"
- "Flexible, any time works"
- "Early mornings (7-9am) before work"

**How to Extract:**
- Customer states preference: "I prefer morning appointments"
- Pattern recognition: Customer books 3 appointments, all Tuesdays at 2pm → Pattern detected
- Customer indicates constraints: "I work until 5, so evenings only"

**Bot Behavior:**
- Propose slots matching preferences first
- Mention preference: "I see you typically prefer mornings - I have Tuesday at 9am available"
- Allow override if customer wants different time

#### 3. Special Notes
**What:** Critical information affecting customer care  
**Categories:**

**Fears & Anxieties:**
- "Terrified of needles"
- "Claustrophobic in small rooms"
- "Dental anxiety, needs gentle approach"
- "Fear of pain, requests local anesthesia"

**Physical Limitations:**
- "Hard of hearing, please speak clearly"
- "Mobility issues, needs ground floor room"
- "Wheelchair user, requires accessible entrance"
- "Visual impairment, needs verbal explanations"

**Allergies & Sensitivities:**
- "Latex allergy - use latex-free gloves"
- "Sensitive to strong fragrances"
- "Allergic to certain anesthetics"
- "Cannot tolerate fluoride treatments"

**Medical Considerations:**
- "Pregnant, avoid X-rays"
- "Diabetic, may need breaks"
- "Heart condition, no epinephrine"
- "Takes blood thinners"

**Special Requests:**
- "Prefers quiet music during treatment"
- "Likes to bring partner for support"
- "Needs extra time for questions"
- "Wants detailed explanations before procedures"

**Cultural/Religious:**
- "Prefers female-only staff"
- "Observes Ramadan, fasting during day"
- "Needs prayer breaks"

**How to Extract:**
- Customer mentions directly: "I'm really scared of dental work"
- Customer asks questions revealing concern: "Will it hurt? How much pain is normal?"
- Customer requests accommodation: "Can I bring someone with me?"

**Bot Behavior:**
- Acknowledge and reassure: "I've noted you have dental anxiety. Our team is experienced with nervous patients and will be very gentle."
- Share notes with human staff
- Proactively address in confirmations: "Reminder: We'll use latex-free gloves as noted in your preferences"

#### 4. Communication Preferences
**What:** How customer prefers to be contacted  
**Examples:**
- "WhatsApp only, no calls"
- "Email reminders appreciated"
- "Text-only, no voice messages"
- "Prefers phone calls for important updates"
- "Likes detailed written instructions"
- "Brief messages only, gets to the point"

**How to Extract:**
- Customer states: "Please don't call me, just WhatsApp"
- Customer behavior: Never responds to emails, always to WhatsApp → Note preference
- Customer asks: "Can you send that in writing?"

**Bot Behavior:**
- Respect stated preferences
- Adjust message style (brief vs detailed) based on preference
- Route important messages through preferred channel

#### 5. Preferred Services
**What:** Services customer has booked or expressed interest in  
**Format:** JSON array of service IDs or names  
**Examples:**
```json
["Deep Tissue Massage", "Acupuncture"]
["Dental Cleaning", "Teeth Whitening"]
["Driving Lesson - Manual", "Driving Lesson - Highway"]
```

**How to Extract:**
- Booking history: Customer books same service repeatedly
- Customer mentions: "I love your massages" → Add to preferences
- Customer asks about: "Tell me about your acupuncture services" → Express interest

**Bot Behavior:**
- Suggest preferred services: "Would you like to book your usual Deep Tissue Massage?"
- Proactive outreach: "Hi Marie, it's been 6 weeks since your last massage. Would you like to book another session?"
- Cross-sell related services: "You enjoy massages - have you tried our new aromatherapy add-on?"

## Extraction Strategies

### 1. Listen Actively (Passive Extraction)
**What:** Extract information customer shares naturally without prompting

**Examples:**

**Customer Says:** "I can't do mornings, I'm not a morning person"  
**Bot Stores:** Preferred times: "Afternoons/evenings preferred, not mornings"

**Customer Says:** "Last time Dr. Weber was so gentle, can I book with her again?"  
**Bot Stores:** 
- Preferred staff: Dr. Weber
- Special notes: "Appreciates gentle approach"

**Customer Says:** "I'm really nervous about this procedure"  
**Bot Stores:** Special notes: "Nervous about procedures, needs reassurance"

**Customer Says:** "Don't call me, I'm usually in meetings. WhatsApp is best"  
**Bot Stores:** Communication preferences: "WhatsApp only, avoid calls (in meetings)"

### 2. Ask Strategically (Active Extraction)
**What:** Politely ask for missing important information when conversation allows

**Timing is Key:**
- After first successful booking: "By the way, may I have your email for confirmations?"
- When customer seems uncertain: "Is there anything specific we should know to make you comfortable?"
- For returning customers: "I noticed you usually book in the mornings - shall I keep that preference?"

**Good Examples:**

**After First Booking:**
```
Bot: "Great! Your appointment is confirmed for Tuesday at 2pm. 
     By the way, what's your email address? We'll send you a confirmation."
```

**When Detecting Nervousness:**
```
Bot: "I sense you might be a bit nervous about this procedure. 
     Is there anything specific that would help you feel more comfortable?"
```

**Pattern Recognition:**
```
Bot: "I've noticed you always book morning appointments. 
     Would you like me to prioritize mornings when suggesting times?"
```

**Bad Examples:**

❌ **Too Aggressive:**
```
Bot: "Before we proceed, I need to collect the following information:
     1. Your full name
     2. Email address
     3. Any fears or anxieties
     4. Staff preferences
     5. Time preferences
     Please provide all this information now."
```
*Why bad:* Feels like interrogation, overwhelming, not natural conversation

❌ **Too Early:**
```
Customer: "Hi"
Bot: "Hello! What are your preferred appointment times and do you have any fears I should know about?"
```
*Why bad:* Too abrupt, customer hasn't even stated their need yet

❌ **Ignoring Context:**
```
Customer: "I need an emergency appointment, I'm in severe pain!"
Bot: "Sure! First, do you have any communication preferences? Also, what's your preferred appointment time?"
```
*Why bad:* Customer is in pain, not the time for preference collection

### 3. Never Interrogate
**What:** Avoid making customers feel like they're filling out a form

**Principles:**
- Collect over time, not all at once
- Make it conversational, not transactional
- Only ask what's relevant to current context
- Accept "I don't know" or "doesn't matter" gracefully

**Good Flow:**
```
Visit 1: Get basics (name, service, time)
Visit 2: Learn preferences (staff, times)
Visit 3: Understand deeper needs (fears, special requests)
```

**Bad Flow:**
```
Visit 1: Demand everything at once
```

### 4. Respect Boundaries
**What:** If customer doesn't want to share, don't push

**Scenarios:**

**Customer Declines:**
```
Bot: "May I have your email for confirmations?"
Customer: "I prefer not to share that"
Bot: "No problem! We'll send confirmations via WhatsApp. Your appointment is confirmed."
```
*Don't push, don't ask again next time*

**Customer Gives Minimal Info:**
```
Bot: "Is there anything we should know to make you comfortable?"
Customer: "No, I'm fine"
Bot: "Great! See you Tuesday at 2pm."
```
*Don't probe further*

**Customer Changes Subject:**
```
Bot: "Do you have any time preferences for future appointments?"
Customer: "Actually, can I reschedule this one?"
Bot: "Of course! When would work better for you?"
```
*Follow customer's lead, drop the preference question*

### 5. Update Continuously
**What:** Every conversation is an opportunity to learn more

**Progressive Profiling:**

**First Visit (Basics):**
- Name: Marie Schmidt
- Phone: +41 79 123 4567
- Service: Dental Cleaning
- Language: German

**Second Visit (Preferences):**
- Previous data PLUS:
- Preferred times: "Mornings preferred"
- Email: marie.schmidt@email.com

**Third Visit (Deeper Understanding):**
- Previous data PLUS:
- Special notes: "Dental anxiety, prefers detailed explanations"
- Preferred staff: "Dr. Weber - gentle approach"

**Fourth Visit (Behavioral Patterns):**
- Previous data PLUS:
- Communication preference: "Prefers brief, to-the-point messages"
- Service patterns: "Books every 6 months for cleaning"

## Implementation in Master Prompt

The master prompt includes:

```
### 4. CRM DATA EXTRACTION & ENRICHMENT

Your goal is to build a comprehensive customer profile over time by 
extracting data from conversations and explicitly asking for missing 
critical information.

**Information to Extract:**
- Basic Information: Name, email, phone, language
- Service Preferences: Preferred services, booking patterns
- Personal Preferences: Staff, times, communication style
- Special Considerations: Fears, limitations, allergies, medical needs
- Behavioral Insights: Punctuality, cancellation patterns

**How to Extract:**
1. Listen Actively - Note information shared naturally
2. Ask Strategically - Polite questions when appropriate
3. Never Interrogate - Conversational, not form-filling
4. Respect Boundaries - Don't push if customer declines
5. Update Continuously - Learn more each interaction

**Storage Instructions:**
- Use structured fields when available
- Use special_notes for contextual information
- Always timestamp information
- Never overwrite unless customer corrects
```

## Bot Behavior Examples

### Example 1: Extracting Fear Information

**Conversation:**
```
Customer: "I need a dental appointment but I'm honestly terrified"
Bot: "I completely understand - many of our patients feel nervous about 
      dental work. Our team is very experienced with anxious patients 
      and will be extremely gentle. Is there anything specific that 
      would help you feel more comfortable?"

Customer: "I'm scared of the drill sound and needles"
Bot: "I've noted that - we can offer noise-canceling headphones and 
      our dentists are very skilled with gentle numbing techniques. 
      Would you like to book with Dr. Weber? She's especially popular 
      with nervous patients."

[Stores in special_notes: "Dental anxiety - scared of drill sounds and 
needles. Offer headphones. Prefers gentle approach."]
```

### Example 2: Extracting Staff Preference

**Conversation:**
```
Customer: "Can I book another session with Sarah? She was amazing last time"
Bot: "Absolutely! I'll book you with Sarah again. Let me check her 
      availability... I have Tuesday 10am or Thursday 3pm. Which works better?"

[Stores in preferred_staff_member: "Sarah - customer specifically requested, 
had excellent experience"]
```

### Example 3: Extracting Time Preference

**Conversation:**
```
Bot: "I have appointments available Tuesday 9am, Wednesday 2pm, or Friday 6pm"
Customer: "6pm would be perfect - I work during the day"
Bot: "Friday 6pm it is! I'll note that evening appointments work best for you."

[Stores in preferred_appointment_times: "Evenings preferred (works during day)"]

Next time:
Bot: "I see you prefer evening appointments. I have Thursday at 6pm or Friday at 7pm available."
```

### Example 4: Extracting Communication Preference

**Conversation:**
```
Customer: "Please just WhatsApp me, don't call. I'm always in meetings and can't answer"
Bot: "Got it! I've noted you prefer WhatsApp communication only. 
      All reminders and updates will come via WhatsApp."

[Stores in communication_preferences: "WhatsApp only, no calls (in meetings frequently)"]
```

## Privacy & Security

**Important Rules:**
1. **Never Log Sensitive Medical Details** in plain text conversations
2. **Use Special Notes Field** for sensitive information (only admins see)
3. **Get Consent:** "I'll note this in your profile to ensure we provide the best care"
4. **Allow Deletion:** "If you'd like me to remove any notes, just let me know"
5. **GDPR Compliant:** Customer can request their data at any time

## Benefits of Rich Customer Profiles

### For Customers:
- ✅ Don't have to repeat information every visit
- ✅ Feel understood and cared for
- ✅ Receive personalized service
- ✅ Staff prepared for their specific needs
- ✅ Better overall experience

### For Business:
- ✅ Higher customer satisfaction scores
- ✅ Reduced no-show rates (better customer relationships)
- ✅ Increased repeat bookings (personalized service)
- ✅ Better staff preparedness (know customer needs in advance)
- ✅ Marketing insights (understand customer preferences)
- ✅ Improved efficiency (don't waste time re-collecting data)

## Integration with Existing Features

### Sentiment Analysis
- Use special notes context when analyzing sentiment
- Customer with "dental anxiety" note → Be extra empathetic
- Customer with "likes detailed explanations" → Provide thorough responses

### Marketing Campaigns
- Filter by preferred services: "Target all customers who prefer massages"
- Filter by preferences: "Send evening availability to customers who prefer evenings"
- Personalize messages: "Hi Marie, your usual 6-month cleaning is due"

### Staff Dashboard
- Show customer preferences when they open conversation
- Alert staff to special needs: "⚠️ Customer has latex allergy"
- Display preferred staff member if available

## Success Metrics

Track these KPIs to measure CRM enrichment success:

- **Profile Completeness:** % of customers with filled preference fields
- **Repeat Booking Rate:** Customers with preferences should return more often
- **Customer Satisfaction:** Personalized service should increase sentiment scores
- **No-Show Reduction:** Better relationships = fewer no-shows
- **Staff Efficiency:** Time saved not re-collecting information

## Next Steps

1. **Deploy Database Schema:** New contact fields are backward-compatible
2. **Update AIService:** Implement data extraction logic in GPT responses
3. **Create CRM UI:** Display enhanced customer profiles in admin panel
4. **Train Staff:** Teach team how to use rich customer data
5. **Monitor & Refine:** Track which data points are most valuable

---

This intelligent CRM data extraction transforms your WhatsApp bot from a booking tool into a comprehensive customer intelligence system that builds stronger relationships and delivers superior service.
