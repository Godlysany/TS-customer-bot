# Multi-Team Member Booking System Guide

## Overview
Your WhatsApp CRM now supports multiple team members (doctors, instructors, therapists, etc.), each with their own calendar and service assignments. The bot intelligently selects team members based on customer preferences, service requirements, and availability.

## Why This Matters

**Traditional Single Calendar:** All appointments go to one generic calendar  
**Your Multi-Team System:** Each team member has their own calendar, bot matches customers to appropriate providers

**Business Benefits:**
- ✅ Support multiple doctors, instructors, therapists
- ✅ Customers can request preferred staff
- ✅ Bot respects customer-staff relationships
- ✅ Efficient calendar management per team member
- ✅ Better customer experience (consistency with same provider)
- ✅ Load balancing across team

---

## Database Architecture

### Team Members Table

**Single-Tenant Architecture (Current):**
```sql
team_members:
- id (UUID)
- name (VARCHAR) - "Dr. Sarah Weber", "Thomas Schmidt" - UNIQUE constraint
- role (VARCHAR) - "Dentist", "Driving Instructor"
- bio (TEXT) - Public description
- avatar_url (TEXT) - Profile picture
- email, phone - Internal contact

Calendar Integration:
- calendar_provider ('ical', 'google', 'caldav', 'outlook')
- calendar_source_url (TEXT) - iCal URL, Google Calendar ID, etc.
- calendar_secret_ref (VARCHAR) - Reference to secret in vault
- calendar_last_synced (TIMESTAMP)
- calendar_sync_status ('pending', 'active', 'error', 'disabled')
- calendar_sync_error (TEXT) - Error messages

Availability:
- is_active (BOOLEAN) - Accepting new bookings?
- is_bookable (BOOLEAN) - Has calendar + linked to services?
- default_priority (INTEGER 0-10) - Preference when multiple options
- working_hours (JSONB) - Optional override

Metadata:
- metadata (JSONB) - Certifications, specialties
- display_order (INTEGER) - Order in UI

Constraint: UNIQUE(name) - No duplicate names

**Future Multi-Tenant Enhancement:**
If supporting multiple businesses in the future, add:
- business_id UUID REFERENCES businesses(id) ON DELETE CASCADE
- Change UNIQUE(name) to UNIQUE(business_id, name)
- Add business_id to team_member_services for scoping
```

### Team Member Services Junction Table
```sql
team_member_services:
- id (UUID)
- team_member_id (UUID) → team_members
- service_id (UUID) → services

Priority & Configuration:
- is_primary (BOOLEAN) - Primary provider for this service?
- priority_order (INTEGER) - Order when multiple providers
- custom_duration_minutes (INTEGER) - Override service duration
- custom_cost_chf (DECIMAL) - Override service cost
- notes (TEXT) - Special approach notes

Constraint: UNIQUE(team_member_id, service_id) - No duplicates
```

### Enhanced Contacts Table
```sql
contacts additions:
- preferred_staff_member (VARCHAR) - DEPRECATED legacy field
- preferred_team_member_ids (UUID[]) - Array of preferred team member UUIDs
- preference_metadata (JSONB) - Context: detected_from, last_updated, ranking
```

### Enhanced Bookings Table
```sql
bookings additions:
- team_member_id (UUID) → team_members (nullable for backward compat)
- assigned_strategy (VARCHAR) - How selected: 'preference', 'availability', 'manual', 'auto'
- preference_snapshot (JSONB) - Customer preferences at booking time
```

---

## Calendar Integration Architecture

### Per-Team-Member iCal Strategy

**Why Per-Team-Member Calendars:**
- ✅ Respects staff autonomy (each manages own calendar)
- ✅ Accurate availability (no shared calendar collisions)
- ✅ Real-world parity (how businesses actually operate)
- ✅ Multiple providers (iCal, Google, Outlook, CalDav)

**Supported Calendar Providers:**

#### 1. iCal (Read-Only)
- **Use Case:** Team member maintains calendar elsewhere (Google, Outlook, Apple)
- **Setup:** Team member generates iCal secret URL from their calendar provider
- **Storage:** URL stored as reference, actual secret in Supabase Vault
- **Sync:** Periodic polling (every 15 minutes) + on-demand before booking

#### 2. Google Calendar API (Read-Write)
- **Use Case:** Full integration with Google Workspace
- **Setup:** OAuth flow to connect Google account
- **Capabilities:** Read availability + write bookings directly
- **Sync:** Real-time via webhook + periodic backup sync

#### 3. CalDav (Read-Write)
- **Use Case:** Self-hosted calendars (Nextcloud, etc.)
- **Setup:** CalDav URL + credentials
- **Capabilities:** Read/write via CalDav protocol

#### 4. Outlook Calendar API
- **Use Case:** Microsoft 365 / Outlook integration
- **Setup:** OAuth flow to connect Microsoft account
- **Capabilities:** Read availability + write bookings

### Secret Management (Security Critical)

**NEVER store raw calendar secrets in database!**

**Secure Pattern:**
```sql
team_members table:
- calendar_source_url: "https://calendar.google.com/calendar/ical/..."
- calendar_secret_ref: "TEAM_MEMBER_123_ICAL_SECRET"
  → This references a secret in Supabase Vault or environment
```

**Secret Storage Options:**

**Option 1: Supabase Vault (Recommended)**
```typescript
// Store secret
await supabase.vault.secrets.create({
  name: `team_member_${teamMemberId}_calendar_secret`,
  secret: actualCalendarUrl or credentials
});

// Retrieve for sync
const { data } = await supabase.vault.secrets.get(
  team_member.calendar_secret_ref
);
```

**Option 2: Environment Variables**
```env
TEAM_MEMBER_001_CALENDAR_SECRET=https://...
TEAM_MEMBER_002_CALENDAR_SECRET=https://...
```

**Never Log Secrets:**
```typescript
// ❌ BAD
console.log(`Syncing calendar: ${calendarUrl}`);

// ✅ GOOD
console.log(`Syncing calendar for team member: ${teamMember.name}`);
```

### Availability Caching Architecture

**Problem:** Checking 10 team members' calendars for every booking request is slow

**Solution:** Availability cache with smart invalidation

```sql
-- Availability cache table (recommended)
CREATE TABLE availability_cache (
    id UUID PRIMARY KEY,
    team_member_id UUID REFERENCES team_members(id),
    service_id UUID REFERENCES services(id),
    date DATE,
    time_slots JSONB, -- [{"start":"09:00","end":"10:00","available":true}, ...]
    last_synced TIMESTAMP WITH TIME ZONE,
    cache_version INTEGER
);

CREATE INDEX idx_availability_cache_lookup ON availability_cache(team_member_id, service_id, date);
```

**Caching Strategy:**

**Nightly Batch Sync:**
- Run daily at 2 AM
- Fetch next 30 days for all active team members
- Store in availability_cache
- Handles 90% of queries instantly

**Incremental Updates:**
- Webhook from calendar provider (if supported)
- On-demand refresh before confirming booking
- Invalidate cache when booking created

**Cache Validation:**
```typescript
function isCacheValid(cacheEntry) {
  const MAX_AGE_MINUTES = 15;
  const age = Date.now() - cacheEntry.last_synced;
  return age < MAX_AGE_MINUTES * 60 * 1000;
}

async function getAvailability(teamMemberId, date) {
  const cached = await db.availability_cache.findOne({
    team_member_id: teamMemberId,
    date: date
  });
  
  if (cached && isCacheValid(cached)) {
    return cached.time_slots; // Use cache
  }
  
  // Cache miss or stale - fetch fresh
  const fresh = await syncCalendarAvailability(teamMemberId, date);
  await updateCache(teamMemberId, date, fresh);
  return fresh;
}
```

---

## Team Member Selection Logic

### Priority Flow

```
Booking Request Received
         ↓
[1] Load customer's preferred team members
    - Check preferred_team_member_ids array
    - Order by preference ranking
         ↓
[2] Filter by service compatibility
    - Which team members offer requested service?
    - Check team_member_services junction
    - Only include is_active AND is_bookable
         ↓
[3] Check customer override
    - Did customer say "anyone available"?
    - Did customer request specific team member?
    - Is this an urgent/emergency request?
         ↓
[4] Query availability
    - Check each candidate's calendar/cache
    - Filter by date/time constraints
    - Respect buffer times and restrictions
         ↓
[5] Score and rank candidates
    - Preference match: +100 points
    - Is primary for service: +50 points
    - Default priority: +priority_order points
    - Availability within 24h: +20 points
    - Recent booking history: -10 per recent booking (load balance)
         ↓
[6] Present options to customer
    - If top choice available: "Dr. Weber (your preferred dentist) has Tuesday at 2pm"
    - If preference unavailable: "Dr. Weber is booked. Dr. Schmidt has Friday at 10am, or wait for Dr. Weber next week?"
    - If no preference: "I have Tuesday at 2pm with Dr. Weber, or Wednesday at 3pm with Dr. Schmidt"
         ↓
[7] Confirm and book
    - Assign to selected team member
    - Record assigned_strategy
    - Snapshot preferences at booking time
    - Create event in team member's calendar
```

### Detailed Selection Examples

#### Example 1: Customer with Preference (Available)

**Setup:**
- Customer: Marie Schmidt
- Preferred team members: [Dr. Weber]
- Request: "I need a dental cleaning"
- Service: Dental Cleaning
- Team members offering Dental Cleaning: Dr. Weber, Dr. Schmidt, Dr. Müller

**Bot Logic:**
```
1. Check preferences: Marie prefers Dr. Weber ✓
2. Check service match: Dr. Weber offers Dental Cleaning ✓
3. Check availability: Dr. Weber available Tuesday 2pm ✓
4. Score:
   - Dr. Weber: 100 (preference) + 50 (primary) + 5 (priority) = 155
   - Dr. Schmidt: 0 (no preference) + 0 + 3 = 3
   - Dr. Müller: 0 + 0 + 2 = 2
5. Select: Dr. Weber
```

**Bot Response:**
```
"Great! I can book you for a dental cleaning with Dr. Weber (your preferred dentist) 
on Tuesday, March 5 at 2:00 PM. Does that work?"
```

**Booking Record:**
```json
{
  "team_member_id": "uuid-dr-weber",
  "assigned_strategy": "preference",
  "preference_snapshot": {
    "preferred_ids": ["uuid-dr-weber"],
    "detected_from": "conversation_history",
    "last_updated": "2025-03-01"
  }
}
```

#### Example 2: Customer with Preference (Unavailable)

**Setup:**
- Customer: Thomas Becker
- Preferred: Dr. Weber
- Request: "Dental appointment Friday morning"
- Dr. Weber: Fully booked Friday
- Dr. Schmidt: Available Friday 10am

**Bot Logic:**
```
1. Check preference: Thomas prefers Dr. Weber
2. Check availability: Dr. Weber NOT available Friday
3. Find alternatives:
   - Dr. Schmidt available Friday 10am
   - Dr. Weber available Monday 9am
4. Offer both options to customer
```

**Bot Response:**
```
"Your usual dentist, Dr. Weber, is fully booked Friday morning. I can offer:

📅 Dr. Schmidt on Friday, March 8 at 10:00 AM
📅 Dr. Weber on Monday, March 11 at 9:00 AM

Which would you prefer?"
```

**If Customer Chooses Dr. Schmidt:**
```json
{
  "team_member_id": "uuid-dr-schmidt",
  "assigned_strategy": "availability",
  "preference_snapshot": {
    "preferred_ids": ["uuid-dr-weber"],
    "override_reason": "preferred_unavailable",
    "alternatives_offered": ["uuid-dr-schmidt", "uuid-dr-weber-later"]
  }
}
```

#### Example 3: No Preference (First Booking)

**Setup:**
- Customer: Lisa Hoffmann (new customer)
- No preferences set
- Request: "I need a massage"
- Service: Deep Tissue Massage
- Team members: Sarah (priority 5), Michael (priority 3)

**Bot Logic:**
```
1. No preferences found
2. Service match: Sarah and Michael both offer Deep Tissue Massage
3. Check availability: Both available Tuesday
   - Sarah: 2pm
   - Michael: 3pm
4. Score by default priority:
   - Sarah: 5 points (higher priority)
   - Michael: 3 points
5. Select: Sarah (higher priority)
```

**Bot Response:**
```
"I have Tuesday, March 5 at 2:00 PM available with Sarah. 
She's excellent with deep tissue massage. Shall I book it?"
```

**After Booking - Ask About Preference:**
```
"Your appointment is confirmed with Sarah! 
Would you like to book with Sarah for future massages as well?"

Customer: "Yes, she was great!"
→ Bot stores Sarah in preferred_team_member_ids
```

#### Example 4: Customer Override ("Anyone Available")

**Setup:**
- Customer: Anna Müller
- Preferred: Dr. Weber
- Request: "I'm in severe pain, need earliest appointment possible!"
- Urgency detected: TRUE
- Earliest available: Dr. Schmidt today 4pm

**Bot Logic:**
```
1. Detect urgency: "severe pain", "earliest possible"
2. Override preferences: Prioritize AVAILABILITY
3. Search all team members for earliest slot
4. Find: Dr. Schmidt today 4pm
5. Bypass preference scoring
```

**Bot Response:**
```
"I understand this is urgent. The earliest available appointment is with 
Dr. Schmidt today at 4:00 PM. Shall I book it right away?"

Customer: "Yes please!"
→ Books with Dr. Schmidt despite preferring Dr. Weber
```

**Booking Record:**
```json
{
  "team_member_id": "uuid-dr-schmidt",
  "assigned_strategy": "manual",
  "preference_snapshot": {
    "preferred_ids": ["uuid-dr-weber"],
    "override_reason": "urgent_request",
    "customer_statement": "severe pain, earliest possible"
  }
}
```

#### Example 5: Explicit Team Member Request

**Setup:**
- Customer: Marc Schneider
- Preferred: Sarah
- Request: "Can I try a massage with Michael this time? I've heard good things"

**Bot Logic:**
```
1. Detect explicit request: "with Michael"
2. Override normal preference logic
3. Check if Michael offers massage: YES
4. Check Michael's availability
5. Book with Michael
6. Update preferences to include Michael
```

**Bot Response:**
```
"Absolutely! Michael has great reviews. I have Wednesday at 3pm available with Michael. 
Does that work?"

Customer: "Perfect!"
```

**After Booking:**
```
- Updates preferred_team_member_ids to include both Sarah and Michael
- Notes preference expansion in metadata
```

---

## Implementation Roadmap

### Phase 1: Database & Backend (Week 1-2)

**Tasks:**
1. Deploy schema changes (team_members, team_member_services, enhanced contacts/bookings)
2. Create default "General Calendar" team member for backward compatibility
3. Implement CalendarSyncService for fetching availability
4. Build AvailabilityCacheService for caching
5. Update BookingService with team member selection logic

### Phase 2: Admin UI (Week 3)

**Team Member Management:**
- CRUD interface for team members
- Calendar configuration (provider, URL, secret upload)
- Service assignment (multi-select with priority)
- Calendar sync status dashboard
- Test sync button

**Service Management Enhancement:**
- Show which team members offer each service
- Bulk assign team members to services

**Customer Profile Enhancement:**
- Display preferred team members (multi-select)
- Show booking history by team member
- Edit preferences

### Phase 3: Bot Integration (Week 4)

**AIService Updates:**
- Load team members list for prompt
- Load customer preferences for prompt
- Hydrate TEAM_MEMBERS_LIST placeholder
- Hydrate CUSTOMER_PREFERRED_TEAM_MEMBERS placeholder

**BookingChatHandler Updates:**
- Implement team member selection logic
- Query multiple calendars
- Handle customer overrides
- Store assigned_strategy

### Phase 4: Testing & Rollout (Week 5)

**Testing Scenarios:**
- Single team member (backward compat)
- Multiple team members, no preferences
- Customer with single preference
- Customer with multiple preferences
- Preference unavailable scenarios
- Urgent override scenarios

**Rollout:**
- Feature flag: require_team_member_assignment
- Gradual enable per business
- Monitor booking success rates

---

## Admin Configuration Guide

### Setting Up Team Members

**Step 1: Add Team Member**
```
Name: Dr. Sarah Weber
Role: Dentist
Bio: Experienced dentist specializing in cosmetic procedures and nervous patients.
Email: sarah.weber@clinic.com
Phone: +41 79 123 4567
```

**Step 2: Configure Calendar**
```
Provider: iCal
Source URL: [Team member provides their iCal secret URL]
Secret Reference: TEAM_MEMBER_SARAH_CALENDAR

Or:

Provider: Google Calendar
[OAuth flow to connect Google account]
```

**Step 3: Link to Services**
```
Assign Dr. Weber to:
✓ Dental Cleaning (Primary provider, Priority 1)
✓ Tooth Filling (Priority 1)
✓ Dental Implant (Primary provider, Priority 1)
✓ Teeth Whitening (Priority 2)
```

**Step 4: Test Calendar Sync**
```
[Test Sync Button]
✅ Last synced: 2 minutes ago
✅ Status: Active
✅ Next 7 days: 23 available slots found
```

**Step 5: Activate**
```
is_active: true
is_bookable: true (automatically set when calendar + services configured)
```

### Managing Customer Preferences

**Automatic Detection:**
- Bot automatically stores preferences when customer requests specific team member
- Shows in customer profile: "Prefers Dr. Weber (detected from 3 bookings)"

**Manual Override:**
- Admin can manually set/edit preferred team members
- Useful for VIP customers or special arrangements

**Analytics:**
- Track booking distribution per team member
- Identify under-utilized team members
- Monitor preference satisfaction rate

---

## Security & Best Practices

### Calendar Secret Security

**✅ DO:**
- Store secrets in Supabase Vault or secure environment variables
- Use calendar_secret_ref as pointer to secret
- Never log raw URLs or credentials
- Rotate secrets periodically (quarterly)
- Use read-only iCal URLs when possible

**❌ DON'T:**
- Store raw iCal URLs in database
- Log calendar URLs in application logs
- Expose secrets in API responses
- Share secrets across team members

### Rate Limiting & Performance

**Calendar API Limits:**
- Google Calendar: 1M queries/day
- iCal: No official limit, but polling every 15min is respectful

**Best Practices:**
- Use availability cache to minimize real-time queries
- Batch sync during off-hours
- Implement exponential backoff on errors
- Monitor sync failure rates

### Error Handling

**Calendar Sync Failures:**
```
1. Log error to calendar_sync_error field
2. Set calendar_sync_status to 'error'
3. Notify admin via email/dashboard alert
4. Fallback: Mark team member as temporarily unbookable
5. Retry: Exponential backoff (1min, 5min, 15min, 1hr)
```

**Booking Conflicts:**
```
1. Re-check availability immediately before confirming
2. If slot taken: Offer next available
3. Never double-book
4. Lock calendar slot during booking process
```

---

## Success Metrics

Track these KPIs to measure multi-team member system success:

- **Preference Satisfaction Rate:** % of bookings with preferred team member
- **Team Member Utilization:** Even distribution vs overload
- **Calendar Sync Success Rate:** % of successful syncs
- **Booking Time:** Speed of availability queries
- **Customer Satisfaction:** Feedback on team member assignments
- **Repeat Booking Rate:** Customers returning to same team member

---

This multi-team member system transforms your WhatsApp CRM from a simple booking tool into a sophisticated staff-aware platform that respects customer relationships while optimizing team utilization.
