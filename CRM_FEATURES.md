# WhatsApp CRM Bot - Admin Features Documentation

## 🎯 Overview

This document describes all the CRM admin features and how to use them. The system has been completely transformed to provide a professional B2B customer service platform.

## 🔐 Settings Management

### API Key Configuration
**Location**: Settings page in CRM
- **OpenAI API Key**: Configure your GPT integration
- **Deepgram API Key** (optional): Voice transcription
- **ElevenLabs API Key** (optional): Text-to-speech
- **Calendar iCal URL**: Google Calendar integration

### Bot Controls
- **Global On/Off Switch**: Pause entire bot operation
- **WhatsApp Connection Status**: See if bot is connected
- **QR Code Display**: Connect WhatsApp directly from CRM settings
- **Reply Mode**: voice, voice-on-voice, or text

### API Endpoints
```
GET /api/settings?category=bot_control
PUT /api/settings/:key
POST /api/settings/bot/toggle
GET /api/settings/whatsapp/status
```

## 👥 Enhanced Customer Profiles

### Analytics Dashboard
Each customer profile includes:

1. **Sentiment Analysis**
   - Score from -1 (negative) to 1 (positive)
   - Based on recent message history
   - Auto-updated after each interaction

2. **Upsell Potential**
   - Categories: Low, Medium, High
   - Analyzed from conversation keywords
   - Helps identify sales opportunities

3. **Keyword Tracking**
   - Top 20 keywords with frequency
   - Understand customer interests
   - Identify recurring topics

4. **Appointment History**
   - Total bookings
   - Last appointment date
   - Upcoming vs. past appointments

5. **Engagement Metrics**
   - Total messages
   - Average response time
   - Last interaction date

### API Endpoints
```
GET /api/contacts/:id/analytics
POST /api/contacts/:id/analytics/refresh
```

## 💬 Conversation Takeover

### Manual Chat Control
Agents can intervene in bot conversations using three modes:

#### 1. **Pause Bot** (`pause_bot`)
- Completely pause automated responses
- Agent takes full control
- Customer only receives agent messages
- Bot resumes when takeover ends

#### 2. **Write Between** (`write_between`)
- Agent can send manual messages
- Bot continues to respond normally
- Useful for clarifications or special notes

#### 3. **Full Control** (`full_control`)
- Agent owns the conversation
- Bot is completely silent
- Full manual interaction

### How to Use
1. Open conversation in CRM
2. Click "Take Over Conversation"
3. Select takeover type
4. Add optional notes
5. End takeover to resume bot

### API Endpoints
```
POST /api/conversations/:id/takeover
  Body: { agentId, type, notes }

POST /api/conversations/:id/takeover/end
GET /api/conversations/:id/takeover/status
```

## 📧 Smart Marketing Campaigns

### Filter-Based Targeting
Create campaigns with intelligent audience filters:

#### Available Filters

1. **Last Interaction**
   - Target customers inactive for X days
   - Re-engagement campaigns
   ```json
   { "lastInteractionDays": 30 }
   ```

2. **Appointment Status**
   - **No Appointment**: Never booked
   - **Upcoming**: Has future appointments
   - **Past X Days**: Recent appointments
   ```json
   { "appointmentStatus": "no_appointment" }
   { "appointmentStatus": "past_x_days", "pastDaysCount": 7 }
   ```

3. **Sentiment-Based**
   - Target happy/unhappy customers
   ```json
   { "sentimentScore": { "min": 0.5, "max": 1 } }
   ```

4. **Upsell Potential**
   - Focus on high-value prospects
   ```json
   { "upsellPotential": ["high", "medium"] }
   ```

5. **Intent-Based** (future)
   - Target by conversation intent
   ```json
   { "intent": ["booking", "question"] }
   ```

### Campaign Creation
1. Define message template
2. Set filter criteria
3. Preview audience size
4. Schedule or send immediately

### API Endpoints
```
POST /api/marketing/filter
  Body: { filter criteria }
  Response: { contacts, count }

POST /api/marketing/campaigns
  Body: { name, messageTemplate, filterCriteria, scheduledAt }

GET /api/marketing/campaigns
```

## 🎨 Prompt & Context Management

### GPT Configuration
**Location**: Prompts section in CRM

Configure how your bot responds:

1. **System Prompt**
   - General AI behavior instructions
   - Tone and personality
   - Response guidelines

2. **Business Context**
   - Your company information
   - Products and services
   - Policies and procedures
   - Operating hours
   - Contact information

3. **Model Settings**
   - GPT Model (gpt-4o, gpt-4o-mini, etc.)
   - Temperature (0-1 for creativity)
   - Max tokens

### Multiple Prompts
- Create different prompts for various scenarios
- Only one active at a time
- Switch instantly via CRM
- Version control for prompts

### API Endpoints
```
GET /api/prompts
POST /api/prompts
PUT /api/prompts/:id/activate
```

## 📅 Calendar Integration

### Configurable Providers
**Default**: Google Calendar (iCal URL)

**Supported** (prepared for):
- Google Calendar API
- Outlook/Office 365
- CalDAV
- Custom API integrations

### Setup Process
1. Go to Settings page
2. Select calendar provider
3. Enter iCal URL or API credentials
4. Test connection
5. Configure availability rules

### Booking Features
- Create appointments via chat
- Modify existing bookings
- Cancel appointments
- Check availability
- Send confirmations

## 🔌 WhatsApp Connection

### Direct CRM Integration
**No console needed!** Everything from the CRM:

1. **QR Code Display**
   - Show QR directly in Settings page
   - Real-time connection status
   - Auto-refresh on disconnect

2. **Connection Status**
   - ✅ Connected: Green indicator
   - ❌ Disconnected: Red indicator
   - 🔄 Connecting: Yellow indicator

3. **Reconnection**
   - Automatic retry on disconnect
   - Manual reconnect button
   - Connection logs and history

### Implementation Notes
- QR code generated server-side
- WebSocket for real-time status
- Persistent session storage
- Multi-device support

## 🚀 Deployment Checklist

### Pre-Launch
- [ ] Configure OpenAI API key in Settings
- [ ] Set up Supabase database (run schema)
- [ ] Connect WhatsApp via QR code
- [ ] Create default GPT prompt
- [ ] Configure calendar integration
- [ ] Test bot on/off switch
- [ ] Set up admin agents

### Post-Launch Monitoring
- Customer sentiment trends
- Bot response accuracy
- Conversation takeover frequency
- Marketing campaign performance
- Booking conversion rates

## 📊 Admin Dashboard Pages

### Required Pages

1. **Dashboard** - Overview metrics
2. **Conversations** - Chat management
3. **Customers** - Profile analytics
4. **Settings** - All configurations
5. **Prompts** - GPT management
6. **Marketing** - Campaign builder
7. **Bookings** - Calendar view
8. **Analytics** - Business insights

## 🔒 Security Considerations

- **API Keys**: Stored encrypted in database
- **Service Role Key**: Server-side only (never exposed)
- **Agent Authentication**: Required for CRM access
- **Row Level Security**: Supabase RLS for data protection
- **Audit Logs**: Track all admin actions

## 📝 Notes

- All settings configurable via CRM (no code changes needed)
- Real-time updates for WhatsApp status
- Analytics update automatically after each message
- Marketing filters are combinable for precision targeting
- Bot respects conversation takeovers instantly
