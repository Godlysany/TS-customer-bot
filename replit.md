# WhatsApp CRM Bot

## Overview
This project is a professional B2B customer service platform integrating WhatsApp for communication, Supabase as its database, and OpenAI GPT for intelligent replies. It aims to provide a self-contained, scalable solution for customer service operations through comprehensive control over customer interactions, intelligent automation, and deep insights. Key capabilities include a robust CRM, calendar booking, advanced customer analytics, and marketing features. The system focuses on transforming customer service by offering intelligent automation and in-depth insights into customer interactions.

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
The system utilizes a modular TypeScript architecture based on Node.js (v20+). It separates concerns into `adapters` (external services), `api` (REST endpoints), `core` (business logic), and `infrastructure` (configuration, clients).

### UI/UX Decisions
The Admin CRM Frontend is developed using React, Vite, TypeScript, and Tailwind CSS v4. It features a professional dashboard with five main navigation pages: conversations, settings, customer analytics, marketing campaigns, and bookings. A TypeScript API client with React Query hooks ensures type-safe interactions.

### Technical Implementations & Features
- **Comprehensive Bot Configuration System (October 21, 2025)**: Two-tier prompt architecture with Master System Prompt (fixed, comprehensive core instructions) and Business Fine-Tuning Prompt (editable personality/tone customization). Includes 15+ business settings (name, location, directions, opening hours), confirmation templates with dynamic placeholders (WhatsApp/Email), service-specific trigger words and time restrictions, emergency blocker slots table, escalation keyword configuration, flexible email collection modes (mandatory/gentle), and complete documentation in MASTER_SYSTEM_PROMPT.md and BOT_CONFIGURATION_GUIDE.md. Database schema production-ready; runtime implementation in AIService and BookingChatHandler pending.
- **Direct GPT Integration**: Configurable OpenAI API key and prompt orchestration for intelligent replies.
- **Supabase CRM**: Stores conversation history, customer data, and manages escalations using a PostgreSQL database.
- **Booking System**: Integrates with Google iCal (extensible), handles penalty fee calculation, waitlist management, and sends email notifications via SendGrid with automated reminders.
- **WhatsApp Integration**: Uses Baileys for WhatsApp Web API, featuring message debouncing, bot on/off toggles, connection status tracking, manual takeover modes (pause_bot, write_between, full_control), and a QR code modal for easy connection. Includes auto-reconnect and connection monitoring.
- **Customer Analytics**: Tracks sentiment, keywords, upsell potential, and engagement.
- **Marketing Automation**: Enables filter-based campaigns targeting customers by sentiment, appointments, or interaction.
- **Anamnesis Questionnaires**: Provides a builder for creating patient profiling questionnaires with various trigger types and collects responses via WhatsApp.
- **Review & Feedback System**: Automates post-appointment review requests.
- **Admin Authentication**: Employs JWT-based authentication with bcrypt hashing, HttpOnly cookies, automatic token refresh, and role-based access control (Master/Support).
- **Settings Page**: Centralized management for WhatsApp connection, API keys (OpenAI, Deepgram, SendGrid, ElevenLabs), calendar settings, secretary email, daily summary time, cancellation policies, and bot toggles.
- **Message Pre-Approval System**: Prevents race conditions and ensures idempotency for sending messages, with a "sending" status to manage atomic approvals.
- **No-Show Protection**: Automated detection and penalty system for no-shows, including a strike system and configurable suspension.
- **Document Sharing**: Automated delivery of service-specific documents (PDF, image, link, text) via WhatsApp or email, with configurable timing (pre/post-booking/appointment).
- **Stripe Payment Integration**: Secure payment processing with payment intent creation, confirmation, full/partial refunds, and transaction tracking.
- **Language Preference System**: Allows unlimited language support with `preferred_language` stored per contact, enabling the bot to adapt and remember customer language choices.
- **Currency Standardization**: All financial transactions and settings are standardized to CHF (Swiss Francs).
- **Promotion & Payment System (October 16, 2025)**: Complete B2B marketing platform with 8 new database tables (promotions, promotion_usage, bot_discount_requests, payment_links, csv_import_batches), 4 core services (PromotionService, ContactService, PaymentLinkService, BotDiscountService), 34 API endpoints, production-safe Stripe webhook with signature verification, smart bot discount autonomy (≤20 CHF configurable cap), admin approval queue for high-value discounts, bulk CSV customer import with validation, service-specific promotions, voucher code generation, balance sheet protection via usage limits and audit trails, comprehensive analytics dashboards. Backend production-ready, frontend API clients complete, UI implementation pending.

### System Design Choices
- **Optional WhatsApp Connection**: The server starts independently of WhatsApp status, allowing manual connection via API.
- **Database Deployment Automation**: Utilizes GitHub Actions for schema deployment via a Supavisor pooler, ensuring consistent database configuration.

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