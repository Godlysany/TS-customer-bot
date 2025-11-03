# WhatsApp CRM Bot

## Overview
This project is a production-ready professional B2B customer service platform integrating WhatsApp for communication, Supabase for data management, and OpenAI GPT for intelligent replies. It provides a self-contained, scalable solution for customer service operations through comprehensive control over customer interactions, intelligent automation, and deep insights. Key capabilities include a robust CRM, multi-team member calendar booking with intelligent assignment, advanced customer analytics, and marketing features, transforming customer service with intelligent automation and in-depth insights into customer interactions. The business vision is to empower B2B customer service with intelligent automation and deep insights, targeting a market ripe for advanced CRM solutions.

**LATEST UPDATE (Nov 3, 2025):** **COMPLETE NURTURING AUTOMATION DEPLOYED** - ALL 9 automated schedulers now running in production: (1) Booking Reminders, (2) Proactive Engagement Campaigns, (3) Recurring Appointments, (4) Marketing Campaigns, (5) Service Documents, (6) No-Show Detection & Recovery, (7) Recurring Service Reminders, (8) Birthday Wishes, (9) Review Requests. Final automation gap closed with new `ReviewRequestScheduler` providing automated review collection with Google Review follow-up for positive feedback. All automated messages use `AIService.personalizeMessage()` for multilingual (DE/FR/IT/EN), context-aware, human-like professional communication. Production-ready with clean compilation, all workflows running without errors, Docker build verified.

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
The system utilizes a modular TypeScript architecture based on Node.js (v20+), separating concerns into `adapters`, `api`, `core`, and `infrastructure`. The Admin CRM Frontend is developed using React, Vite, TypeScript, and Tailwind CSS v4, featuring a professional dashboard with main navigation pages: conversations, settings, customer analytics, marketing campaigns, bookings (with full edit/create capabilities), and nurturing. A TypeScript API client with React Query hooks ensures type-safe interactions.

**Multi-Team Booking Architecture:**
- **Team Members Infrastructure**: PostgreSQL tables (`team_members`, `service_team_members` junction table) with JSONB availability schedules
- **BookingService Primitives**: Modular primitives pattern (validateAndPrepare → persistBooking → finalizeSideEffects → rollbackBooking)
- **Intelligent Team Selection**: Availability-based auto-assignment with customer preference and load balancing
- **Buffered Conflict Detection**: Uses `actual_start_time`/`actual_end_time` columns for precise double-booking prevention
- **Calendar Integration**: Team member-specific calendars via `calendar_id` with single-provider-per-instance architecture

**Admin UI Structure**:
- **Nurturing Page** (6 tabs): Questionnaires with 3 subtabs (Management, Customer Responses, Settings), Campaigns, Promotions, Birthday Wishes, Testimonials, Service Documents
- **Business Settings** (4 tabs): Business Details, Confirmation Templates, Services, Booking Configuration
- **Bot Configuration** (5 tabs): GPT Prompts & Tone, Escalation Rules, Email Collection, Voice & TTS, Advanced Controls

The Nurturing page features a 6-tab system:
- **Questionnaires**: Three subtabs - Questionnaire Management (create/edit questionnaires), Customer Responses (view submitted answers), Questionnaire Settings (triggers, activation, service linking)
- **Campaigns**: Marketing campaign management with delivery tracking
- **Promotions**: Special offer creation and management with discount configurations
- **Birthday Wishes**: Automated birthday message system with optional promotion attachments
- **Testimonials**: Testimonial request automation with Google Review follow-up for positive feedback
- **Service Documents**: Timing-based document delivery (as info, on confirmation, after booking)

Core features include:
- **Comprehensive Bot Configuration**: A two-tier prompt architecture (Master System Prompt, Business Fine-Tuning Prompt), 15+ business settings, confirmation templates, service-specific triggers, emergency blocker slots, user-friendly escalation configuration (5 modes), flexible email collection, intelligent CRM data extraction, multi-session booking support (3 strategies), and a multi-team member system with individual calendars and intelligent selection. AI-assisted prompt generation is available.
- **WhatsApp Integration**: Features message debouncing, bot toggles, connection status, manual takeover modes, and QR code connection. The server starts independently of WhatsApp status.
- **Payment System**: Production-ready end-to-end payment integration for WhatsApp booking flow, including Stripe checkout, payment link generation, webhook-based status tracking, penalty enforcement, and a comprehensive payment escalation dashboard for Master users. All financial transactions are standardized to CHF.
- **CRM & Customer Management**: Stores conversation history, customer data, manages escalations, provides enhanced customer profiles with sentiment, keywords, and upsell potential. Includes marketing automation with filter-based campaigns and a customer nurturing system for birthday wishes, review requests, and post-appointment follow-ups.
- **Booking System**: Integrates with Google iCal, handles penalty fees, waitlists, and sends email notifications. Supports multi-session bookings and features calendar payment indicators.
- **AI-Powered Capabilities**: Direct GPT integration for intelligent replies, AI-powered CRM extraction, AI-powered marketing personalization based on conversation and booking history, and AI-assisted prompt generation.
- **Voice & TTS System**: Comprehensive text-to-speech and voice-to-text integration with three reply modes, per-customer TTS preference overrides, Deepgram transcription, and ElevenLabs synthesis.
- **Document & Image Attachment System**: Supabase Storage integration for service documents and promotion images with timing-based delivery.
- **Security & Reliability**: JWT-based admin authentication with role-based access, comprehensive logging with Winston (structured, daily rotation), Redis for distributed locks to ensure message idempotency and prevent race conditions (with graceful degradation), and a message pre-approval system.
- **Database Deployment**: Utilizes GitHub Actions for schema deployment via a Supavisor pooler.

## External Dependencies
- **Supabase**: PostgreSQL database and authentication services.
- **OpenAI**: GPT models for AI-powered customer replies, CRM extraction, and prompt management.
- **Baileys**: WhatsApp Web API for messaging integration.
- **Express**: Node.js web application framework.
- **Google Calendar**: For appointment booking and synchronization.
- **SendGrid**: For email notifications.
- **Stripe**: For secure payment processing.
- **Deepgram**: Voice transcription services.
- **ElevenLabs**: Text-to-speech capabilities.
- **Redis**: Distributed locking and message idempotency.