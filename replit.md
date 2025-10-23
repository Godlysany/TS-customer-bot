# WhatsApp CRM Bot

## Overview
This project is a professional B2B customer service platform integrating WhatsApp for communication, Supabase as its database, and OpenAI GPT for intelligent replies. It aims to provide a self-contained, scalable solution for customer service operations through comprehensive control over customer interactions, intelligent automation, and deep insights. Key capabilities include a robust CRM, calendar booking, advanced customer analytics, and marketing features, transforming customer service with intelligent automation and in-depth insights into customer interactions.

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
The system utilizes a modular TypeScript architecture based on Node.js (v20+), separating concerns into `adapters`, `api`, `core`, and `infrastructure`.

### UI/UX Decisions
The Admin CRM Frontend is developed using React, Vite, TypeScript, and Tailwind CSS v4, featuring a professional dashboard with five main navigation pages: conversations, settings, customer analytics, marketing campaigns, and bookings. A TypeScript API client with React Query hooks ensures type-safe interactions.

### Technical Implementations & Features
- **WhatsApp Payment Integration**: Production-ready end-to-end payment integration for WhatsApp booking flow across multi-session strategies, including Stripe checkout, payment link generation, and webhook-based status tracking.
- **Production Readiness**: Implemented email collection enforcement, dynamic template placeholder replacement, extended contacts table with CRM columns, and AI-powered CRM extraction from conversations using GPT-4.
- **Comprehensive Bot Configuration System**: Features a two-tier prompt architecture (Master System Prompt, Business Fine-Tuning Prompt), 15+ business settings, confirmation templates, service-specific triggers, emergency blocker slots, user-friendly escalation configuration (5 modes), flexible email collection, intelligent CRM data extraction, multi-session booking support (3 strategies), and a multi-team member system with individual calendars and intelligent selection.
- **Marketing Campaign System**: Enhanced audience filtering supports various interaction types, corrected frontend-backend filter misalignment, and resolved runtime bugs for scheduled campaigns.
- **Multi-Session Booking**: Backend infrastructure supports services requiring multiple sequential appointments, with database schema extensions, admin UI for strategy selection and configuration, and a `MultiSessionBookingLogic` service.
- **Confidence Logic & Escalations System**: Redesigned intent-based confidence scoring and a comprehensive Escalations CRM with CRUD operations, 7 REST API endpoints, and a full-featured admin page.
- **Bot Configuration Restructure**: Restructured UI and backend to eliminate duplication and support Calendly-style service availability using `service_booking_windows` and `service_blockers` tables.
- **Direct GPT Integration**: Configurable OpenAI API key and prompt orchestration for intelligent replies.
- **Supabase CRM**: Stores conversation history, customer data, and manages escalations.
- **Booking System**: Integrates with Google iCal, handles penalty fees, waitlists, and sends email notifications.
- **WhatsApp Integration**: Uses Baileys, featuring message debouncing, bot toggles, connection status, manual takeover modes, and QR code connection.
- **Customer Analytics**: Tracks sentiment, keywords, upsell potential, and engagement.
- **Marketing Automation**: Enables filter-based campaigns targeting customers.
- **Anamnesis Questionnaires**: Builder for patient profiling questionnaires.
- **Review & Feedback System**: Automates post-appointment review requests.
- **Admin Authentication**: JWT-based authentication with bcrypt, HttpOnly cookies, token refresh, and role-based access.
- **Settings Page**: Centralized management for WhatsApp, API keys, calendar, and bot toggles.
- **Message Pre-Approval System**: Prevents race conditions and ensures idempotency for sending messages.
- **No-Show Protection**: Automated detection and penalty system for no-shows.
- **Document Sharing**: Automated delivery of service-specific documents via WhatsApp or email.
- **Stripe Payment Integration**: Secure payment processing with intent creation, confirmation, and refunds.
- **Intelligent Multi-Language System**: Ensures customer-friendly, deliberate language selection and persistence, only changing language on explicit customer request with GPT-powered detection.
- **Currency Standardization**: All financial transactions and settings are standardized to CHF.
- **Promotion & Payment System**: Features a B2B marketing platform with promotions, smart bot discounts, admin approval queues for high-value discounts, bulk CSV customer import, service-specific promotions, and voucher code generation.

### System Design Choices
- **Optional WhatsApp Connection**: The server starts independently of WhatsApp status.
- **Database Deployment Automation**: Utilizes GitHub Actions for schema deployment via a Supavisor pooler.

## External Dependencies

- **Supabase**: PostgreSQL database and authentication services.
- **OpenAI**: GPT models for AI-powered customer replies and prompt management.
- **Baileys**: WhatsApp Web API for messaging integration.
- **Express**: Node.js web application framework.
- **Google Calendar**: For appointment booking and synchronization.
- **SendGrid**: For email notifications.
- **Stripe**: For secure payment processing.
- **Deepgram** (optional): Voice transcription services.
- **ElevenLabs** (optional): Text-to-speech capabilities.