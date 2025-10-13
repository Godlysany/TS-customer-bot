# WhatsApp CRM Bot

## Recent Changes (October 13, 2025)

### CRM Enhancement: Customers & Questionnaire Views ✅
**Complete Customer Relationship Management:**
- **Customers Page**: Full customer list with search, sentiment tracking, interaction counts
  - Display: Name, email, phone, sentiment (positive/negative/neutral), conversation count
  - Analytics: Keywords, upsell potential, important notes
  - Quick access to customer details and conversations
- **Customer Detail Page**: Individual customer profiles with:
  - Contact information and analytics
  - Sentiment analysis and keywords
  - Questionnaire responses history
  - Quick stats (conversations, bookings, questionnaires)
  - Links to view conversations
- **Questionnaire Responses Page**: Centralized view of all submissions
  - Filter by type (anamnesis, feedback, custom)
  - Search by customer name/phone
  - Split-screen: List view + detailed response viewer
  - Quick access to customer profiles

### Workflow Enhancements ✅
**Improved Agent Experience:**
- **Waitlist Management**: Tab-based Bookings page with Appointments and Waitlist views
  - Waitlist table: Customer info, contact details, date requested, priority level
  - Remove functionality with proper API integration
  - Clean empty states for both appointments and waitlist
- **Quick Access Links**: Conversations page now includes:
  - Direct link to customer profile (context-aware)
  - Quick access to Questionnaires page
  - Proper icons and external link indicators for better UX

### Bot Configuration System ✅
**Complete Bot Configuration Infrastructure:**
- Business Context & FAQ, GPT Prompt Configuration, Questionnaire Builder, Advanced Controls
- Master-only access with authentication protection
- All settings persist to Supabase database

## Overview
This project is a professional B2B customer service platform integrating WhatsApp for communication, Supabase as its database, and OpenAI GPT for intelligent replies. It includes a robust CRM, calendar booking capabilities, and advanced features for customer analytics and marketing. The system aims to be a self-contained, scalable solution, transforming customer service operations by providing comprehensive control over customer interactions, intelligent automation, and deep insights.

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
The system employs a modular TypeScript architecture built on Node.js (v20+), separating concerns into adapters (external services), API (REST endpoints), core business logic, and infrastructure (configuration, clients).

```
src/
├── adapters/
├── api/
├── core/
├── infrastructure/
├── types/
└── server.ts
```

### UI/UX Decisions
The Admin CRM Frontend is developed using React, Vite, TypeScript, and Tailwind CSS v4, featuring a professional dashboard with five-page navigation (conversations, settings, customer analytics, marketing campaigns, bookings). A TypeScript API client with React Query hooks ensures type-safe interaction.

### Technical Implementations & Features
- **Bot Configuration System**: Comprehensive configuration for business context, GPT prompts (tone, style), escalation triggers, questionnaire builder, and advanced controls (auto-response, sentiment analysis, human approval workflows).
- **Direct GPT Integration**: Configurable OpenAI API key and prompt orchestration for intelligent replies.
- **Supabase CRM**: Stores conversation history, customer data, and escalation management in a PostgreSQL database.
- **Booking System**: Google iCal integration (extensible), penalty fee calculation, waitlist management, SendGrid email notifications, and automated reminders.
- **WhatsApp Integration**: Baileys for WhatsApp Web API, with message debouncing, bot on/off, connection status tracking, and manual takeover modes (pause_bot, write_between, full_control). Includes a QR code modal for easy connection.
- **Customer Analytics**: Tracks sentiment, keywords, upsell potential, and engagement.
- **Marketing Automation**: Filter-based campaigns targeting customers by sentiment, appointments, or interaction.
- **Anamnesis Questionnaires**: Builder for patient profiling questionnaires with various trigger types and response collection via WhatsApp.
- **Review & Feedback System**: Automated post-appointment review requests.
- **Admin Authentication**: JWT-based authentication with bcrypt hashing, HttpOnly cookies, automatic token refresh, and role-based access control (Master/Support).
- **Settings Page**: Manages WhatsApp connection, API keys (OpenAI, Deepgram, SendGrid, ElevenLabs), calendar settings, secretary email, daily summary time, cancellation policies, and bot toggles.
- **Security**: Supabase service role key for server-side operations, password reset, and role-based API protection.
- **Data Mapping**: Utilities for automatic camelCase to snake_case conversion between domain and database.

### System Design Choices
- **Optional WhatsApp Connection**: Server starts independently of WhatsApp status, allowing manual connection via API.
- **Database Deployment Automation**: GitHub Actions workflow for schema deployment via Supavisor pooler, ensuring all necessary tables and configurations are applied.

### Database Schema
Key tables include: `contacts`, `conversations`, `messages`, `agents`, `prompts`, `bookings`, `automations`, `escalations`, `settings`, `customer_analytics`, `conversation_takeovers`, `marketing_campaigns`, `waitlist`, `questionnaires`, `questionnaire_responses`, `reviews`, `email_logs`, `reminder_logs`, `cancellation_policies`.

## External Dependencies

- **Supabase**: PostgreSQL database and authentication.
- **OpenAI**: GPT for AI-powered customer replies and prompt management.
- **Baileys**: WhatsApp Web API for messaging integration.
- **Express**: Node.js web application framework.
- **Google Calendar**: For appointment booking and synchronization.
- **SendGrid**: For email notifications.
- **Deepgram** (optional): Voice transcription.
- **ElevenLabs** (optional): Text-to-speech capabilities.