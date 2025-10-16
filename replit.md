# WhatsApp CRM Bot

## Recent Changes (October 16, 2025)

### Calendar Integration Note
- **iCal URL**: Currently configured for read-only calendar availability checking
- **Limitation**: Cannot create or edit calendar events directly (read-only)
- **Future Enhancement**: Google Calendar connector integration available but not configured
  - User dismissed connector setup - if full calendar management needed, can configure later
  - Alternative: Use Google Calendar API credentials as secrets

## Recent Changes (October 14, 2025)

### Feature 9: Stripe Payment Integration ✅ COMPLETE
**Secure Payment Processing & Automated Refunds:**
- **PaymentService**: Complete Stripe integration for payment processing
  - Payment intent creation with customizable amounts and metadata
  - Secure payment confirmation with latest_charge expansion
  - Full and partial refund support with reason tracking
  - Transaction-safe operations with proper error handling
- **Payment Transactions**: Comprehensive tracking in payment_transactions table
  - Status tracking: pending, succeeded, failed, refunded
  - Payment method recording (card, bank_transfer, etc.)
  - Stripe charge ID and payment intent linking
  - Failure reason capture for debugging
- **API Endpoints**: /api/payments/* (create-intent, confirm, refund, transactions)
  - Authenticated access for all payment operations
  - Master-only refund capability for security
  - Transaction history by contact or booking
  - Individual transaction retrieval
- **Booking Integration**: Seamless payment flow with bookings
  - Payment status tracking: not_required, pending, paid, refunded
  - Automatic refund on early cancellations (before policy hours)
  - No refund for late cancellations (penalty applied instead)
  - Booking payment status synced with transaction status
- **Cancellation Refund Logic**: Smart refund processing
  - Full refund for cancellations outside policy window
  - No refund for late cancellations (within policy hours)
  - Transaction updates on successful refunds
  - Error handling with fallback to manual processing
- **Security & Configuration**: Production-ready setup
  - Stripe client uses account default API version
  - Settings-based enabling (payments_enabled, stripe_api_key)
  - Secure API key management via Supabase settings
  - Proper authentication and authorization checks

### Feature 8: No-Show Protection ✅ COMPLETE
**Automated No-Show Detection & Penalty System:**
- **NoShowService**: Complete detection, tracking, and penalty management
  - Auto-detection: 2 hours after appointment start (configurable)
  - Strike system: 3 strikes = 30-day suspension (configurable)
  - Penalty fees: Fixed or percentage-based (configurable)
  - Transaction-safe: Tracking insert before booking update with rollback
- **NoShowScheduler**: Automated processing at 60-minute intervals
  - Detects confirmed bookings past detection window
  - Recovers orphaned no-show bookings (idempotency protection)
  - Reports: detected, recovered, failed counts
- **API Endpoints**: /api/no-show/* (mark, history, status, lift, reset)
  - Manual no-show marking with notes
  - Contact no-show history and strike count
  - Master-only suspension override and strike reset
- **Booking Integration**: Pre-booking suspension check
  - Blocks booking creation for suspended customers
  - Clear error message with suspension end date
  - Prevents abuse from repeat offenders
- **Follow-up System**: Automated re-engagement messages
  - WhatsApp + Email delivery (auto-detected from contact info)
  - Personalized messages with penalty information
  - Rebooking options for non-suspended customers
- **Database**: no_show_tracking table with proper indexes
  - Strike counting across multiple no-shows
  - Suspension date tracking
  - Penalty and follow-up status

### Feature 7: Document Sharing ✅ COMPLETE
**Automated Document Delivery System:**
- **DocumentService**: Complete CRUD operations for service-specific documents
  - Document types: PDF, image, link, or text
  - Timing options: pre_booking, post_booking, pre_appointment, post_appointment
  - Delivery methods: WhatsApp, email, or both (auto-detected from customer contact info)
- **DocumentScheduler**: Automated delivery at 60-minute intervals
  - Pre-appointment: Delivers 24h before appointment
  - Post-appointment: Delivers within 24h after completion
  - Idempotency protection: Prevents duplicate deliveries on re-runs
- **API Endpoints**: /api/documents (GET/POST/PUT/DELETE)
  - Master-only access for document management
  - Full CRUD with order position support
- **Booking Integration**: Auto-schedules documents on booking creation
  - Pre-booking documents delivered immediately
  - Post-booking documents delivered immediately
  - Pre/post-appointment handled by scheduler
- **Delivery Tracking**: document_deliveries table monitors all sends
  - Status tracking: pending, sent, failed, acknowledged
  - Accurate delivery method recording on success and failure
  - Database indexes on booking_id and sent_at for performance

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