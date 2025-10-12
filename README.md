# WhatsApp CRM Bot

A professional B2B customer service platform built with WhatsApp, Supabase, OpenAI, and Google Calendar integration.

## 🎯 Features

- **WhatsApp Bot Integration**: Automated customer service via WhatsApp using Baileys
- **GPT-Powered Replies**: Intelligent responses using OpenAI GPT models with configurable prompts
- **Supabase Database**: Full conversation history, customer data, and CRM functionality
- **Booking System**: Calendar integration for appointment scheduling (Google Calendar support)
- **Admin CRM Dashboard**: Web interface for managing conversations, escalations, and marketing
- **Voice Support**: Voice transcription (Deepgram) and text-to-speech (ElevenLabs)
- **Modular Architecture**: Clean, scalable TypeScript codebase

## 📋 Prerequisites

1. **Supabase Account** - [Sign up here](https://supabase.com)
2. **OpenAI API Key** - [Get your key](https://platform.openai.com/api-keys)
3. **Optional Services**:
   - Deepgram API key for voice transcription
   - ElevenLabs API key for text-to-speech
   - Google Calendar API for booking

## 🚀 Setup Instructions

### 1. Database Setup

1. Create a new project in [Supabase](https://supabase.com/dashboard)
2. Copy the SQL schema from `supabase-schema.sql`
3. Go to your Supabase project → SQL Editor → New Query
4. Paste and execute the schema
5. Get your Supabase URL and anon key from Project Settings → API

### 2. Environment Variables

1. Copy `.env.example` to `.env`
2. Fill in your credentials:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Found in Project Settings → API → service_role key
   OPENAI_API_KEY=sk-your-openai-api-key
   ```

   ⚠️ **Important**: Use the `service_role` key (not the `anon` key) for server-side operations to bypass Row Level Security.

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Application

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

**WhatsApp bot only:**
```bash
npm run whatsapp
```

## 🏗️ Project Structure

```
src/
├── adapters/          # External service adapters
│   ├── whatsapp.ts   # WhatsApp Baileys integration
│   └── GoogleCalendarProvider.ts
├── api/              # REST API endpoints
│   └── routes.ts     # CRM API routes
├── core/             # Business logic services
│   ├── AIService.ts
│   ├── BookingService.ts
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

## 🔧 API Endpoints

### Conversations
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:id/messages` - Get conversation messages
- `POST /api/conversations/:id/messages` - Send manual reply
- `POST /api/conversations/:id/escalate` - Escalate to human agent
- `POST /api/conversations/:id/resolve` - Mark as resolved

### Prompts (GPT Configuration)
- `GET /api/prompts` - List all prompts
- `POST /api/prompts` - Create new prompt
- `PUT /api/prompts/:id/activate` - Activate prompt

### Bookings
- `GET /api/bookings` - List all bookings
- `POST /api/bookings/:id/cancel` - Cancel booking

## 📱 WhatsApp Authentication

1. Run the application
2. A QR code will appear in the console
3. Scan with WhatsApp on your phone (Linked Devices)
4. The bot will connect and start processing messages

## 🎨 Customizing GPT Prompts

1. Access the CRM dashboard
2. Go to Prompts section
3. Create a new prompt with:
   - **System Prompt**: General instructions for the AI
   - **Business Context**: Your business-specific information
   - **Temperature**: Response creativity (0-1)
   - **Model**: GPT model to use (gpt-4o, gpt-4o-mini, etc.)
4. Activate the prompt to use it for customer replies

## 🗓️ Calendar Integration

The booking system supports Google Calendar integration. To set up:

1. Set up Google Calendar API credentials
2. Configure the calendar provider in the code
3. Customers can request appointments via WhatsApp
4. The bot will check availability and create calendar events

## 📊 Database Schema

Key tables:
- **contacts**: Customer contact information
- **conversations**: Conversation threads
- **messages**: All messages (inbound/outbound)
- **agents**: CRM users
- **prompts**: GPT configuration
- **bookings**: Appointment scheduling
- **automations**: Marketing triggers
- **escalations**: Human handoff tracking

## 🔐 Security Notes

- All API keys should be kept in `.env` (never commit)
- Use Supabase Row Level Security for production
- Implement authentication for the CRM dashboard
- WhatsApp auth tokens are stored in `./auth_info/`

## 🚀 Deployment

This application is designed to run on Railway or similar platforms:

1. Connect your GitHub repository
2. Set environment variables in the platform
3. The application will auto-deploy

## 📝 License

MIT

## 🤝 Support

For issues or questions, please open an issue on GitHub.
