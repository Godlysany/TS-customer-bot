# WhatsApp CRM Bot

## Overview
This project is a professional B2B customer service platform integrating WhatsApp for communication, Supabase as its database, and OpenAI GPT for intelligent replies. It includes a robust CRM, calendar booking capabilities, and advanced features for customer analytics and marketing. The system aims to be a self-contained, scalable solution, transforming customer service operations. Its ambition is to provide comprehensive control over customer interactions, intelligent automation, and deep insights, targeting businesses that require efficient and professional client management.

## Recent Changes (October 12, 2025)

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
- **OpenAI**: Own API key (configurable via CRM settings, not Replit integration)
- **Calendar**: Google iCal as default, system prepared for other API providers
- **CRM Control**: All settings manageable from admin interface (no code changes)
- **Bot Management**: On/off switch and WhatsApp QR connection in CRM settings
- **Manual Intervention**: Agent takeover with pause, write-between, or full control modes
- **Marketing**: Smart filters based on intent, interaction, appointments, sentiment
- **Customer Insights**: Enhanced profiles with sentiment, keywords, upsell potential
- **Focus**: B2B customer service with professional CRM requirements

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