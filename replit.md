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

Run `supabase-schema.sql` in your Supabase project to set up.

## Configuration

### Required Environment Variables
```bash
# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (Required)
OPENAI_API_KEY=sk-your-openai-api-key

# Optional: Voice Features
DEEPGRAM_API_KEY=your-deepgram-api-key
ELEVENLABS_API_KEY=your-elevenlabs-api-key
ELEVENLABS_VOICE_ID=your-voice-id

# WhatsApp
REPLY_MODE=voice-on-voice  # voice | voice-on-voice | text
RESET_AUTH=false
```

### API Endpoints
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:id/messages` - Get messages
- `POST /api/conversations/:id/messages` - Send manual reply
- `POST /api/conversations/:id/escalate` - Escalate to agent
- `POST /api/conversations/:id/resolve` - Mark resolved
- `GET /api/prompts` - List GPT prompts
- `POST /api/prompts` - Create prompt
- `PUT /api/prompts/:id/activate` - Activate prompt
- `GET /api/bookings` - List bookings
- `POST /api/bookings/:id/cancel` - Cancel booking

## Features

### Core Capabilities
1. **Direct GPT Integration**: No Make.com needed - AI replies handled in code
2. **Supabase CRM**: Full conversation history, customer data, escalation management
3. **Configurable Prompts**: Customize GPT behavior via database (system prompts, business context)
4. **Booking System**: Google Calendar integration for appointments (create, modify, cancel)
5. **Admin API**: REST endpoints for CRM dashboard
6. **Message Debouncing**: 30-second buffer for message bursts
7. **Voice Support**: Transcription (Deepgram) and TTS (ElevenLabs)
8. **Intent Detection**: Automatic routing (booking, question, complaint, etc.)

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
- ✅ Supabase database schema designed
- ✅ Core services implemented (Message, Conversation, AI, Booking)
- ✅ WhatsApp adapter refactored (no Make.com dependency)
- ✅ GPT orchestration with configurable prompts
- ✅ REST API for CRM operations
- ✅ Database mapper for camelCase/snake_case conversion
- ⏳ Admin CRM frontend (planned)
- ⏳ Google Calendar integration (planned)
- ⏳ Marketing automation (planned)

## Recent Changes (October 12, 2025)
### Major Transformation
- **Removed Dependencies**: Make.com, Airtable completely removed
- **New Architecture**: Modular TypeScript structure with clean separation
- **Database**: Supabase PostgreSQL with comprehensive schema
- **AI Integration**: Direct OpenAI integration with prompt management
- **Service Layer**: MessageService, ConversationService, AIService, BookingService
- **API Layer**: REST endpoints for CRM dashboard
- **Mapper Utilities**: Handle DB column naming conversions
- **Security Fix**: Use service role key for server-side Supabase operations
- **Documentation**: Complete README, database schema, API docs

### Technical Improvements
- TypeScript for type safety
- Proper error handling and validation
- Intent detection for smart routing
- Booking system foundation
- Escalation management
- Marketing automation hooks

## User Preferences
- Prefers own OpenAI API key over Replit-managed endpoint
- B2B customer service focus
- Professional CRM requirements
- Calendar booking integration needed

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
