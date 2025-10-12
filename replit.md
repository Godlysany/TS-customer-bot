# WhatsApp CRM Bot

## Overview
Professional B2B customer service platform with WhatsApp integration, Supabase database, OpenAI GPT, and calendar booking. This is a complete transformation from the original Make.com/Airtable setup to a self-contained, scalable CRM system.

## Project Architecture

### New Modular Structure (TypeScript)
```
src/
├── adapters/          # External service adapters
│   ├── whatsapp.ts   # WhatsApp Baileys integration (refactored)
│   └── GoogleCalendarProvider.ts
├── api/              # REST API endpoints
│   └── routes.ts     # CRM API routes
├── core/             # Business logic services
│   ├── AIService.ts         # GPT orchestration
│   ├── BookingService.ts    # Calendar management
│   ├── ConversationService.ts
│   └── MessageService.ts
├── infrastructure/   # Configuration & clients
│   ├── config.ts
│   ├── mapper.ts     # DB mapping utilities
│   ├── openai.ts
│   └── supabase.ts
├── types/            # TypeScript interfaces
│   └── index.ts
└── server.ts         # Main Express server
```

### Legacy Files (Preserved)
- **index.js**: Original WhatsApp bot (run with `npm run legacy`)
- **send.js**: Legacy outbound sender

### Technology Stack
- **TypeScript**: Type-safe codebase
- **Node.js** (v20+)
- **Baileys**: WhatsApp Web API
- **Supabase**: PostgreSQL database + auth
- **OpenAI**: GPT-powered customer replies
- **Express**: REST API server
- **Deepgram** (optional): Voice transcription
- **ElevenLabs** (optional): Text-to-speech
- **Google Calendar** (planned): Appointment booking

## Database Schema

### Tables
- **contacts**: Customer information (phone, name, email)
- **conversations**: Conversation threads with status tracking
- **messages**: All messages (inbound/outbound) with full history
- **agents**: CRM users (admin, agent roles)
- **prompts**: GPT configuration (system prompts, business context, temperature)
- **bookings**: Calendar appointments with Google Calendar sync
- **automations**: Marketing triggers and actions
- **escalations**: Human handoff tracking
- **settings**: CRM configuration (API keys, bot controls, calendar settings)
- **customer_analytics**: Sentiment, keywords, upsell potential, engagement metrics
- **conversation_takeovers**: Agent manual intervention tracking
- **marketing_campaigns**: Campaign management with filter-based targeting

Run `supabase-schema.sql` in your Supabase project to set up.

## Configuration

### Required Environment Variables
```bash
# Supabase (Required) - Only database credentials needed in env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # JWT format, NOT sb_secret_

# WhatsApp
RESET_AUTH=false

# Note: OpenAI and Deepgram are configured via CRM Settings page (not here)
```

### API Endpoints

**Conversations & Messages:**
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:id/messages` - Get messages
- `POST /api/conversations/:id/messages` - Send manual reply
- `POST /api/conversations/:id/escalate` - Escalate to agent
- `POST /api/conversations/:id/resolve` - Mark resolved

**Settings & Configuration:**
- `GET /api/settings` - Get all settings (with optional category filter)
- `PUT /api/settings/:key` - Update/create setting
- `POST /api/settings/bot/toggle` - Enable/disable bot
- `GET /api/settings/whatsapp/status` - WhatsApp connection status

**Customer Analytics:**
- `GET /api/contacts/:id/analytics` - Get customer analytics
- `POST /api/contacts/:id/analytics/refresh` - Update analytics

**Conversation Takeover:**
- `POST /api/conversations/:id/takeover` - Start agent takeover
- `POST /api/conversations/:id/takeover/end` - End takeover
- `GET /api/conversations/:id/takeover/status` - Get takeover status

**Marketing:**
- `POST /api/marketing/filter` - Filter contacts by criteria
- `POST /api/marketing/campaigns` - Create campaign
- `GET /api/marketing/campaigns` - List campaigns

**Prompts & Bookings:**
- `GET /api/prompts` - List GPT prompts
- `POST /api/prompts` - Create prompt
- `PUT /api/prompts/:id/activate` - Activate prompt
- `GET /api/bookings` - List bookings
- `POST /api/bookings/:id/cancel` - Cancel booking

## Features

### Core Capabilities
1. **Direct GPT Integration**: OpenAI API key configurable via CRM settings (not hardcoded)
2. **Supabase CRM**: Full conversation history, customer data, escalation management
3. **Configurable Prompts**: Customize GPT behavior via CRM (system prompts, business context)
4. **Booking System**: Google iCal (default), extensible to other calendar providers
5. **Admin API**: REST endpoints for complete CRM control
6. **Message Debouncing**: 30-second buffer for message bursts
7. **Voice Support**: Transcription (Deepgram) and TTS (ElevenLabs) - optional
8. **Intent Detection**: Automatic routing (booking, question, complaint, etc.)

### CRM-Specific Features
1. **Settings Management**: All API keys and bot controls in CRM settings page
2. **Bot On/Off Switch**: Global pause/resume for entire bot operation
3. **WhatsApp Connection**: QR code display and status directly in CRM
4. **Customer Analytics**: Sentiment, keywords, upsell potential, engagement metrics
5. **Manual Takeover**: Pause bot, write between messages, or take full control
6. **Smart Marketing**: Filter-based campaigns (sentiment, appointments, last interaction)
7. **Enhanced Profiles**: Complete customer history with analytics dashboard

### Data Mapping
- **Mapper Utilities**: Automatic conversion between camelCase (domain) and snake_case (database)
- **Timestamp Handling**: All date/time fields automatically converted to Date objects
- **Type Safety**: Full TypeScript support with comprehensive interfaces

## Setup Instructions

### 1. Database Setup
1. Create Supabase project: https://supabase.com/dashboard
2. Run `supabase-schema.sql` in SQL Editor
3. Get service role key from Project Settings → API

### 2. Environment Setup
1. Copy `.env.example` to `.env`
2. Fill in Supabase and OpenAI credentials
3. Add optional voice API keys if needed

### 3. Run Application
```bash
# Development (with auto-reload)
npm run dev

# Production
npm run build
npm start

# WhatsApp bot only
npm run whatsapp

# Legacy bot
npm run legacy
```

## Current State
- ✅ Modular TypeScript architecture
- ✅ Supabase database schema with all CRM tables
- ✅ Core services (Message, Conversation, AI, Booking, Settings, Analytics, Takeover, Marketing)
- ✅ WhatsApp adapter with bot controls and takeover support
- ✅ GPT orchestration with configurable prompts from CRM
- ✅ Complete REST API for all CRM operations
- ✅ Database mapper for camelCase/snake_case conversion
- ✅ Settings management system with upsert support
- ✅ Customer analytics with sentiment and keyword tracking
- ✅ Conversation takeover system (3 modes)
- ✅ Smart marketing filters and campaign management
- ✅ Bot enabled/disabled check in message handler
- ✅ WhatsApp connection status tracking
- ✅ **Admin CRM Frontend** (React + Vite + TypeScript + Tailwind v4)
  - Dashboard layout with navigation
  - Conversations page with takeover controls
  - Settings page with API key management and bot controls
  - Customer Analytics with sentiment/keywords/upsell
  - Marketing Campaigns with smart filters
  - Bookings management
- ⏳ Backend-Frontend integration testing
- ⏳ Google Calendar full integration (foundation ready)

## Recent Changes (October 12, 2025)
### Major Transformation - Phase 1
- **Removed Dependencies**: Make.com, Airtable completely removed
- **New Architecture**: Modular TypeScript structure with clean separation
- **Database**: Supabase PostgreSQL with comprehensive schema
- **AI Integration**: Direct OpenAI integration with prompt management
- **Service Layer**: MessageService, ConversationService, AIService, BookingService
- **API Layer**: REST endpoints for CRM dashboard
- **Mapper Utilities**: Handle DB column naming conversions
- **Security Fix**: Use service role key for server-side Supabase operations
- **Documentation**: Complete README, database schema, API docs

### CRM Enhancement - Phase 2 (Today)
- **Settings System**: CRM-configurable API keys, bot controls, calendar settings
- **Customer Analytics**: Sentiment analysis, keyword tracking, upsell potential
- **Conversation Takeover**: 3 modes (pause_bot, write_between, full_control)
- **Smart Marketing**: Filter-based campaigns (sentiment, appointments, interaction)
- **Bot Controls**: Global on/off switch, takeover respect, analytics updates
- **WhatsApp Integration**: Connection status tracking in settings
- **Enhanced Database**: Added settings, customer_analytics, conversation_takeovers, marketing_campaigns tables
- **Complete API**: Settings, analytics, takeover, and marketing endpoints
- **Upsert Fix**: Settings service now properly creates/updates configuration

### Technical Improvements
- TypeScript for type safety
- Proper error handling and validation
- Intent detection for smart routing
- Booking system foundation
- Escalation management
- Marketing automation with smart filters
- Real-time analytics updates
- Agent intervention system

## User Preferences
- **OpenAI**: Own API key (configurable via CRM settings, not Replit integration)
- **Calendar**: Google iCal as default, system prepared for other API providers
- **CRM Control**: All settings manageable from admin interface (no code changes)
- **Bot Management**: On/off switch and WhatsApp QR connection in CRM settings
- **Manual Intervention**: Agent takeover with pause, write-between, or full control modes
- **Marketing**: Smart filters based on intent, interaction, appointments, sentiment
- **Customer Insights**: Enhanced profiles with sentiment, keywords, upsell potential
- **Focus**: B2B customer service with professional CRM requirements

## Next Steps
1. **Admin CRM Frontend**: React/Vite dashboard for conversation management
2. **Google Calendar Setup**: Complete booking integration
3. **Marketing Features**: Customer segmentation and campaigns
4. **Testing**: End-to-end flow validation
5. **Deployment**: Railway configuration

## Notes
- WhatsApp auth requires QR scan on first run
- Supabase service role key is required (not anon key)
- Voice features are optional but recommended
- Legacy bot available via `npm run legacy`
- All data persists in Supabase (no external webhooks needed)
