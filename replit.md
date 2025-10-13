# WhatsApp CRM Bot

## Overview
This project is a professional B2B customer service platform integrating WhatsApp for communication, Supabase as its database, and OpenAI GPT for intelligent replies. It includes a robust CRM, calendar booking capabilities, and advanced features for customer analytics and marketing. The system aims to be a self-contained, scalable solution, transforming customer service operations. Its ambition is to provide comprehensive control over customer interactions, intelligent automation, and deep insights, targeting businesses that require efficient and professional client management.

## Recent Changes (October 13, 2025)

### WhatsApp QR Code Modal ✅
**Added Visual QR Code Display for WhatsApp Connection:**
- QR code modal pops up when "Connect WhatsApp" button is clicked
- Backend stores generated QR code in memory and exposes via `/api/settings/whatsapp/qr` endpoint
- Frontend polls for QR code every 2 seconds when modal is open
- QR code displayed as scannable image (not text)
- Modal auto-closes when WhatsApp connection succeeds
- Clear user instructions: "Open WhatsApp → Settings → Linked Devices → Link a Device"
- Resolves UX issue where QR code was only visible in backend logs

### Critical Auth Route Fix ✅
**Fixed Login 404 Error:**
- Corrected auth routes mounting from `/auth` to `/api/auth` (frontend expects `/api/auth/login`)
- Server now properly handles authentication requests
- Login works correctly with admin@crm.local / admin123
- Railway deployments will now function properly

**Frontend API Path Fix:**
- Changed from hardcoded `http://localhost:8080` to relative paths
- Frontend now connects to same domain as deployment (Railway/production)
- Fixed in: api.ts, AdminManagement.tsx, AuthContext.tsx
- Production login now works correctly

**Database Manual Fix Applied:**
- Ran SQL to add missing `password_hash`, `reset_token`, `reset_token_expires` columns
- Updated role constraint from ('admin','agent') to ('master','support')
- Created admin account with bcrypt password hash
- Settings table configured with all required keys

**GitHub Action Issue Identified:**
- GitHub Action creates tables but fails silently on ALTER TABLE statements
- Manual SQL fix applied to Supabase to complete schema deployment
- Database fully operational with all required columns and constraints

### Admin Authentication System & Functional Settings ✅
**Complete Authentication System Implemented:**
- JWT-based authentication with bcrypt password hashing (10 rounds)
- HttpOnly, secure cookies for session management (access token: 15min, refresh token: 7 days)
- Automatic token refresh via axios interceptor (prevents session expiration)
- Login page with email/password form
- Role-based access control: **Master** (full access) vs. **Support** (limited to conversations, bookings, analytics, dashboard)
- Protected routes enforce authentication and role permissions
- Admin Management page (master only) to create/edit/delete agents and assign roles

**Functional Settings Page:**
- WhatsApp connection controls (connect/disconnect buttons that actually work)
- API key inputs for: OpenAI, Deepgram, SendGrid (with from email), ElevenLabs
- Calendar settings with iCal URL input and provider selection
- Secretary email and daily summary time configuration
- Cancellation policy settings (hours and penalty fees)
- Bot enable/disable toggle
- All inputs save to database via API, masked secret fields
- Toast notifications for success/error feedback

**Database Changes:**
- Added `password_hash`, `reset_token`, `reset_token_expires` columns to agents table
- Changed role enum from ('admin', 'agent') to ('master', 'support')
- Added default settings for all API keys and configuration options
- Migration script provided for existing databases

**Security Features:**
- Production-ready authentication flow
- Password reset functionality with token expiration
- Role-based API route protection
- No exposed secrets or tokens
- Environment variable JWT_SECRET required for production

**Default Credentials:**
- Email: `admin@crm.local`
- Password: `admin123`
- ⚠️ **Change immediately after first login!**

## Recent Changes (October 13, 2025)

### Railway Production Fix ✅
**WhatsApp Connection Made Optional:**
- Removed auto-connect on server start (prevents crashes from 405 WebSocket errors)
- Added manual connection control via API: `/api/whatsapp/connect` and `/api/whatsapp/disconnect`
- Server now starts successfully even without WhatsApp connection
- Added 405 error handling to prevent reconnect loops
- QR timeout no longer kills server process
- Frontend static files now served by Express backend for Railway deployment
- Added Procfile to ensure Railway uses correct start command

**Why This Matters:**
- Railway deployments no longer crash due to WhatsApp connection issues
- Server runs independently of WhatsApp status (production-safe)
- WhatsApp connection can be initiated when ready (after scanning QR code)
- Enables true separation of concerns: API server vs. WhatsApp bot

### Database Deployment Automation ✅
- **GitHub Actions workflow** successfully deploying schema via Supavisor pooler (IPv4-compatible)
- Fixed IPv6 network issues - uses `aws-1-eu-west-1.pooler.supabase.com:6543`
- All 18+ database tables deployed and verified
- Handles special characters in passwords via `PGPASSWORD` env var

### Railway Deployment Ready ✅
- Fixed TypeScript build error (removed unused import)
- Dual-port configuration: 5000 (Replit), 8080 (Railway)
- Build pipeline optimized: backend + frontend in single command
- All environment variables documented

## Previous Changes (October 12, 2025)

### Dentist CRM Complete Implementation
**6 New Services Built:**
- **EmailService**: SendGrid integration for booking confirmations, cancellations, reminders, secretary notifications
- **WaitlistService**: Queue management with WhatsApp notifications when slots open, priority matching
- **QuestionnaireService**: Anamnesis questionnaire builder with response collection
- **ReviewService**: Post-appointment feedback automation with rating statistics
- **ReminderService**: 24h and 1-week appointment reminders with upselling
- **SecretaryNotificationService**: Daily summaries and real-time booking alerts (CET timezone)

**Database Enhancements:**
- Added 7 new tables: waitlist, questionnaires, questionnaire_responses, reviews, email_logs, reminder_logs, cancellation_policies
- Enhanced bookings table with penalty_applied, penalty_fee, discount_amount fields
- Enhanced settings table with SendGrid config and secretary email settings

**BookingService Enhancements:**
- Penalty fee calculation based on admin-configurable policies
- Email notifications for all booking events
- Waitlist integration - automatically notifies queue when slots open
- Review trigger after appointment completion
- Stats method for dashboard reporting

**API Expansion:**
- 25+ new endpoints for dashboard stats, waitlist, questionnaires, reviews, penalties
- Time-filtered statistics (daily/weekly/monthly)
- Complete CRUD for all dentist practice workflows

**Frontend Updates:**
- Dashboard page with booking/review stats and time filtering
- API client updated with all new endpoints
- Navigation updated with Dashboard as home page

## User Preferences
- **Authentication**: Role-based access (Master/Support) with secure JWT sessions
- **OpenAI**: Own API key (configurable via CRM settings UI)
- **Calendar**: Google iCal as default, system prepared for other API providers (configurable via UI)
- **CRM Control**: All settings manageable from admin interface (no code changes)
- **Bot Management**: On/off switch and WhatsApp connection controls in CRM settings
- **Manual Intervention**: Agent takeover with pause, write-between, or full control modes
- **Marketing**: Smart filters based on intent, interaction, appointments, sentiment (Master only)
- **Customer Insights**: Enhanced profiles with sentiment, keywords, upsell potential
- **Focus**: B2B customer service with professional CRM requirements
- **User Roles**:
  - **Master**: Full access to all features including settings, marketing, and admin management
  - **Support**: Limited to conversations, bookings, analytics, and dashboard

## System Architecture

### Core Architecture
The system employs a modular TypeScript architecture built on Node.js (v20+). It features a clear separation of concerns with dedicated layers for adapters (external services), API (REST endpoints), core business logic, and infrastructure (configuration, clients).

```
src/
├── adapters/          # External service adapters (WhatsApp Baileys, GoogleCalendarProvider)
├── api/               # REST API endpoints (CRM routes)
├── core/              # Business logic services (AI, Booking, Conversation, Message)
├── infrastructure/    # Configuration & clients (config, mapper, openai, supabase)
├── types/             # TypeScript interfaces
└── server.ts          # Main Express server
```

### UI/UX Decisions
The Admin CRM Frontend is developed using React, Vite, TypeScript, and Tailwind CSS v4. It features a professional dashboard layout with five-page navigation, including dedicated sections for conversations, settings, customer analytics, marketing campaigns, and bookings management. A TypeScript API client with React Query hooks ensures type-safe interaction with the backend.

### Technical Implementations & Features
- **Direct GPT Integration**: OpenAI API key is configurable via CRM settings. GPT orchestration is managed through configurable prompts for system prompts and business context.
- **Supabase CRM**: Full conversation history, customer data, and escalation management are stored in a PostgreSQL database (Supabase).
- **Booking System**: Foundation for Google iCal integration, extensible to other calendar providers. Includes penalty fee system, waitlist management, email notifications via SendGrid, and automated reminders.
- **WhatsApp Integration**: Utilizes Baileys for WhatsApp Web API, with features like message debouncing, bot on/off switch, connection status tracking, and manual takeover modes (pause_bot, write_between, full_control).
- **Customer Analytics**: Tracks sentiment, keywords, upsell potential, and engagement metrics.
- **Marketing Automation**: Filter-based campaigns allow targeting customers by sentiment, appointments, or last interaction.
- **Anamnesis Questionnaires**: A builder for creating patient profiling questionnaires with various trigger types and response collection via WhatsApp.
- **Review & Feedback System**: Automated post-appointment review requests with rating and comment collection.
- **Security**: Uses Supabase service role key for server-side operations.
- **Data Mapping**: Mapper utilities handle automatic conversion between camelCase (domain) and snake_case (database) for consistency.

### Database Schema
The Supabase database includes tables for:
- `contacts`, `conversations`, `messages`, `agents`
- `prompts` (GPT configuration), `bookings`, `automations`, `escalations`
- `settings` (CRM configuration, API keys, bot controls)
- `customer_analytics`, `conversation_takeovers`, `marketing_campaigns`
- `waitlist`, `questionnaires`, `questionnaire_responses`, `reviews`
- `email_logs`, `reminder_logs`, `cancellation_policies`

## External Dependencies

- **Supabase**: PostgreSQL database and authentication.
- **OpenAI**: GPT for AI-powered customer replies and prompt management.
- **Baileys**: WhatsApp Web API for messaging integration.
- **Express**: Node.js web application framework for building REST APIs.
- **Google Calendar**: Planned integration for appointment booking and synchronization.
- **SendGrid**: For email notifications (booking confirmations, cancellations, reminders, secretary notifications).
- **Deepgram** (optional): Voice transcription.
- **ElevenLabs** (optional): Text-to-speech capabilities.

## Deployment Instructions

### Database Setup (Automated via GitHub Actions)

The database schema is automatically applied when you push to the `main` branch:

1. **Add Supabase secrets to GitHub:**
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Add these secrets:
     - `SUPABASE_PROJECT_ID` - Your Supabase project reference ID
     - `SUPABASE_DB_PASSWORD` - Your Supabase database password
     - `SUPABASE_ACCESS_TOKEN` - Your Supabase access token

2. **Trigger deployment:**
   ```bash
   git add .
   git commit -m "Apply database schema"
   git push origin main
   ```

The GitHub Actions workflow (`.github/workflows/deploy-supabase.yml`) will automatically:
- Use Supabase CLI (handles IPv6/IPv4 compatibility via Supavisor pooler)
- Apply `supabase-schema.sql` to your Supabase database
- Create all 18+ tables needed for the dentist CRM

### Railway Deployment

**Port Configuration:**
- **Replit Development**: Frontend on port 5000, Backend on 8080
- **Railway Production**: Both configurable via `PORT` environment variable (default: 8080)

**Railway Environment Variables:**
```bash
PORT=8080
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
WHATSAPP_REPLY_MODE=text
RESET_AUTH=false
```

**Build Configuration** (`railway.json`):
- Builds both backend and frontend admin panel
- Starts backend API server
- Frontend served via Vite preview mode on same port

### Post-Deployment Configuration

After deployment, configure via CRM Settings page:
1. **SendGrid**: Add API key and from email
2. **Secretary Email**: Set email address for notifications
3. **Cancellation Policy**: Set hours and penalty amounts
4. **Daily Summary Time**: Configure time in CET timezone
5. **OpenAI**: Add API key for GPT features