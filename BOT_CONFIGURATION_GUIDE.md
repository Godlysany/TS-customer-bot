# Comprehensive Bot Configuration Guide

## Overview
Your WhatsApp CRM Bot uses a sophisticated **two-tier prompt system** combined with comprehensive business settings to provide high-quality, context-aware customer service.

## Two-Tier Prompt Architecture

### Tier 1: Master System Prompt (Fixed - Visible but Not Editable)
The master prompt contains **core instructions** that define the bot's capabilities and responsibilities. This ensures the bot always knows its duties regardless of business customization.

**What it includes:**
- Appointment booking duties and flow
- Questionnaire administration
- Promotion management
- Sentiment analysis rules
- Escalation triggers and logic
- Multi-language support
- Data collection guidelines
- Technical instructions for confirmations
- Error handling procedures

**Placeholders replaced dynamically:**
- `{BUSINESS_NAME}` - Your business name
- `{BUSINESS_LOCATION}` - Your physical address
- `{DIRECTIONS_TO_LOCATION}` - How to reach you
- `{OPENING_HOURS}` - Your operating hours
- `{AVAILABLE_SERVICES}` - List of services from database
- `{SERVICE_TRIGGER_WORDS}` - Keywords mapped to each service
- `{SERVICE_RESTRICTIONS}` - Time/day restrictions per service
- `{EMAIL_REQUIREMENT_INSTRUCTION}` - How to collect emails
- `{EMAIL_COLLECTION_INSTRUCTION}` - Mandatory vs gentle approach
- `{ESCALATION_TRIGGERS}` - Keywords that escalate to human
- `{WHATSAPP_CONFIRMATION_TEMPLATE}` - WhatsApp message format
- `{EMAIL_CONFIRMATION_TEMPLATE}` - Email message format
- `{BUSINESS_FINE_TUNING_PROMPT}` - Your custom tier 2 prompt

**Why it's fixed:**
Ensures the bot always understands its core responsibilities (booking, sentiment tracking, escalation, etc.) and never loses critical functionality during customization.

### Tier 2: Business Fine-Tuning Prompt (Editable with Defaults)
This is YOUR space to customize the bot's personality, tone, and business-specific nuances.

**Default Example:**
```
We are a professional service provider focused on quality and customer satisfaction. 
Maintain a friendly yet professional tone. Show empathy and patience with all customers.
Use clear, concise language. Always confirm customer understanding before proceeding with bookings.
If a customer seems uncertain, offer to explain options in more detail.
```

**What you can customize:**
- Tone of voice (formal, casual, warm, energetic)
- Brand personality traits
- Specific phrases or terminology you use
- How to handle special customer types
- Cultural considerations
- Level of emoji usage
- Response length preferences

**Best Practices:**
- Keep it concise (2-4 sentences)
- Focus on tone and style, not tasks (tasks are in master prompt)
- Use examples if helpful
- Update seasonally if needed

---

## Business Information Settings

### 1. Business Name
**Purpose:** Displayed to customers, used in confirmations and signatures  
**Example:** `"Swiss Wellness Center"`  
**Used in:** All customer-facing messages

### 2. Business Location
**Purpose:** Physical address where appointments take place  
**Example:** `"Bahnhofstrasse 123, 8001 Zürich, Switzerland"`  
**Used in:** Booking confirmations, when customers ask for location

### 3. Directions (Anfahrtsbeschreibung)
**Purpose:** How to reach your business  
**Example:**
```
From Zürich HB: Take Tram 6 towards Zoo, exit at Paradeplatz (3 stops). 
Walk 200m north on Bahnhofstrasse. We are in the building with the blue awning.
Parking: Public parking available at Parking Jelmoli (5 min walk).
```
**Used in:** Booking confirmations, when customers ask how to reach you

### 4. Opening Hours
**Format:** JSON object with hours per day  
**Example:**
```json
{
  "monday": "09:00-18:00",
  "tuesday": "09:00-18:00",
  "wednesday": "09:00-18:00",
  "thursday": "09:00-20:00",
  "friday": "09:00-18:00",
  "saturday": "10:00-14:00",
  "sunday": "closed"
}
```
**Used in:** Bot knows when to offer slots, rejects out-of-hours requests

---

## Service-Specific Configuration

For each service in your Services Management:

### Trigger Words
**Purpose:** Keywords the bot recognizes to identify this service  
**Format:** JSON array of strings  
**Example for "Deep Tissue Massage":**
```json
["massage", "deep tissue", "muscle pain", "tension", "sports massage", "therapy"]
```

**How it works:**
- Customer says: "I need a massage for my back pain"
- Bot matches: "massage" → Deep Tissue Massage service
- Bot confirms: "Great! I can book you for a Deep Tissue Massage..."

### Booking Time Restrictions
**Purpose:** Limit when this specific service can be booked  
**Format:** JSON object  
**Example:**
```json
{
  "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
  "hours": "09:00-17:00"
}
```
This service is only bookable Monday-Friday, 9 AM to 5 PM (even if business opens later other days).

**Common Use Cases:**
- Specialist only works certain days
- Equipment only available certain hours
- Longer treatments need full day slots
- Weekend-only services

---

## Emergency/Blocker Slots

**Purpose:** Times when the bot should NEVER book appointments  
**Use Cases:**
- Staff meetings
- Equipment maintenance
- Emergency procedures
- Personal time off
- Training sessions

**How to Configure:**
Via the Bookings/Calendar management interface:
1. Create blocker slot with title and time range
2. Mark as "Recurring" if it repeats weekly
3. Bot automatically excludes these times from availability

**Example Blocker:**
```
Title: "Weekly Team Meeting"
Time: Every Monday 08:00-09:00
Recurring: Yes
```

---

## Email Collection Settings

### Mandatory vs Gentle Mode

**booking_email_mandatory: false (Gentle Mode - Recommended)**
Bot behavior:
1. Asks for email: "May I have your email address for the confirmation?"
2. If customer provides: Great! Sends email confirmation
3. If customer ignores/declines: Proceeds with booking anyway
4. Still asks, but doesn't block the booking

**booking_email_mandatory: true (Mandatory Mode)**
Bot behavior:
1. Asks for email: "I'll need your email address to confirm this booking."
2. If customer provides: Great! Proceeds with booking
3. If customer ignores/declines: "I'm sorry, we require an email address to complete bookings. This helps us send you confirmation and important updates."
4. Repeats until email is provided or customer abandons

**Recommendation:** Start with gentle mode. Customers prefer optionality.

---

## Booking Confirmation Templates

### WhatsApp Confirmation Template
**Available Placeholders:**
- `{{name}}` - Customer's name
- `{{service}}` - Service name
- `{{datetime}}` - Full date and time
- `{{date}}` - Date only
- `{{time}}` - Time only
- `{{cost}}` - Service cost in CHF
- `{{location}}` - Business location
- `{{directions}}` - How to reach
- `{{business_name}}` - Your business name

**Default Template:**
```
✅ *Booking Confirmed*

Hello {{name}}!

Your appointment is confirmed:

📅 *Service:* {{service}}
🕐 *Date & Time:* {{datetime}}
💰 *Cost:* CHF {{cost}}
📍 *Location:* {{location}}

{{directions}}

We look forward to seeing you!
```

**Customization Tips:**
- Keep it concise for mobile viewing
- Use emojis sparingly for clarity
- Always include core info: what, when, where, how much
- Add cancellation policy if needed

### Email Confirmation Template
**Same placeholders as WhatsApp**

**Default Template:**
```
Dear {{name}},

Your appointment has been confirmed.

Service: {{service}}
Date & Time: {{datetime}}
Cost: CHF {{cost}}
Location: {{location}}

{{directions}}

If you need to cancel or reschedule, please contact us at least 24 hours in advance.

Best regards,
{{business_name}}
```

**Email Subject Template:**
```
Booking Confirmation - {{service}} on {{date}}
```

---

## Escalation Triggers

**Purpose:** Keywords that immediately escalate conversation to a human agent

**Default Trigger Words:**
```json
["complaint", "angry", "refund", "cancel subscription", "speak to manager", 
 "terrible", "awful", "disappointed", "lawyer", "legal action"]
```

**How it works:**
1. Customer says: "This is terrible, I want a refund!"
2. Bot detects: "terrible" + "refund" → Trigger
3. Bot responds: "I understand your frustration. Let me connect you with our team right away."
4. Conversation marked for immediate human review
5. Bot pauses automated responses

**Customize for your business:**
- Add industry-specific complaint terms
- Add your competitors' names (if customers mention switching)
- Add emergency medical keywords if applicable

---

## How the Bot Uses This Configuration

### On Every Customer Message:

1. **Load Master Prompt** with all placeholders filled from your settings
2. **Append Business Fine-Tuning Prompt** (your tier 2 customization)
3. **Check services database** for available services, trigger words, restrictions
4. **Check emergency_slots table** for blocked times
5. **Check opening_hours** from settings
6. **Analyze sentiment** and update customer profile
7. **Check escalation triggers** for keywords
8. **Generate contextual response** using GPT with full context

### On Booking Attempt:

1. Identify service from trigger words
2. Check if time is within opening hours
3. Check service-specific time restrictions
4. Check for emergency blocker slots
5. Check calendar availability
6. Collect email based on your mandatory/gentle setting
7. Confirm booking details
8. Send confirmations using your templates (WhatsApp + Email if enabled)

---

## Setup Checklist for Production

### Initial Configuration (One-Time):
- [ ] Set business name
- [ ] Set business location
- [ ] Write clear directions (Anfahrtsbeschreibung)
- [ ] Configure opening hours JSON
- [ ] Customize business fine-tuning prompt (tone & personality)
- [ ] Set email collection mode (mandatory vs gentle)
- [ ] Customize WhatsApp confirmation template
- [ ] Customize email confirmation template
- [ ] Set escalation trigger words

### Per Service (In Services Management):
- [ ] Add trigger words for each service (3-6 keywords minimum)
- [ ] Set booking time restrictions if needed
- [ ] Test bot recognizes service from various customer phrasings

### Ongoing Maintenance:
- [ ] Add emergency slots when needed (meetings, vacations, etc.)
- [ ] Update opening hours for holidays
- [ ] Refine trigger words based on customer conversations
- [ ] Adjust fine-tuning prompt seasonally if desired
- [ ] Review escalation triggers monthly

---

## Testing Your Configuration

### Test Booking Flow:
1. Message bot: "I want to book a [SERVICE]"
2. Verify bot recognizes service from trigger words
3. Verify bot only offers times within opening hours
4. Verify bot respects service time restrictions
5. Verify bot skips emergency blocker slots
6. Verify email collection matches your setting
7. Verify confirmation messages use your templates

### Test Escalation:
1. Message bot with an escalation trigger word
2. Verify bot escalates immediately
3. Verify conversation marked for human review

### Test Multi-Language:
1. Message bot in German
2. Verify bot responds in German
3. Try French, Italian, English - verify adaptation

---

## Best Practices

### Writing Effective Trigger Words:
- Include obvious keywords: "massage", "haircut", "consultation"
- Include colloquial terms: "cut my hair", "need a trim"
- Include problem descriptions: "back pain" for physiotherapy
- Avoid overly generic words that match multiple services
- Test with real customer language (review past conversations)

### Crafting Your Fine-Tuning Prompt:
✅ **Good Example:**
```
We're a luxury spa focused on relaxation and wellness. Use a warm, calming tone.
Be patient and encouraging. Emphasize the benefits of self-care.
```

❌ **Bad Example:**
```
Book appointments and answer questions. Be professional. Tell customers about our services.
```
(Too generic, too task-focused - tasks are in master prompt)

### Opening Hours JSON:
- Use 24-hour format: "09:00-18:00"
- Use "closed" for non-operating days
- Support lunch breaks: "09:00-12:00,14:00-18:00"
- Match your actual availability

### Emergency Slots:
- Create blocker for any non-bookable time
- Use recurring for weekly patterns
- Be specific in titles for internal clarity
- Review and remove expired blockers monthly

---

## Troubleshooting

**Bot not recognizing a service?**
→ Add more trigger words to that service

**Bot offering wrong time slots?**
→ Check opening hours and service time restrictions

**Bot not escalating when it should?**
→ Add missing trigger words to escalation settings

**Confirmations missing information?**
→ Check template placeholders match available data

**Email confirmations not sending?**
→ Verify SendGrid API key and `email_confirmation_enabled` setting

---

## Advanced: Understanding the Full Flow

```
Customer Message Received
         ↓
[Load Master System Prompt]
         ↓
[Fill all {PLACEHOLDERS} from DB]
         ↓
[Append Business Fine-Tuning Prompt]
         ↓
[Retrieve message history (last 10)]
         ↓
[Analyze sentiment → Update score]
         ↓
[Check escalation triggers]
         ↓
[If escalate → Pause bot, notify staff]
         ↓
[Otherwise → Generate GPT response]
         ↓
[If booking intent → BookingChatHandler]
         ↓
[Check service triggers, restrictions, calendar]
         ↓
[Collect required info (name, email per setting)]
         ↓
[Confirm booking → Create in DB]
         ↓
[Send confirmations using templates]
         ↓
[Response sent to customer]
```

This comprehensive configuration system ensures your bot provides professional, context-aware service while giving you full control over business personality and rules.
