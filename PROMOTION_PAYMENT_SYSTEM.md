# Promotion & Payment System - Implementation Guide

## Overview
This document describes the comprehensive promotion, payment, and customer management system added to the WhatsApp CRM Bot.

---

## 1. Database Schema

### New Tables Created:

#### **promotions**
Stores all promotion campaigns with service-specific discounts, voucher codes, and validity rules.

**Key Features:**
- Service-specific or applies to all services
- Fixed CHF or percentage discounts with max caps
- Voucher code generation and validation
- Usage limits (total and per customer)
- Bot autonomy settings (max CHF bot can offer without approval)
- Target audience configuration (sentiment, inactivity, etc.)

#### **promotion_usage**
Tracks every time a promotion is applied to a booking.

**Key Features:**
- Links promotion → contact → booking
- Records discount amounts and final prices
- Tracks who offered it (bot_autonomous, bot_approved, agent, customer_entered)
- Auto-increments promotion.uses_count via trigger

#### **bot_discount_requests**
Admin approval queue for bot-suggested discounts exceeding autonomous limit.

**Key Features:**
- Bot recommendations with confidence scores
- Customer context (sentiment, inactivity, spending history)
- Auto-expires after 7 days if not reviewed
- Creates promotion upon admin approval
- Analytics views for approval rates

#### **payment_links**
Tracks Stripe checkout sessions for booking payments.

**Key Features:**
- Stripe session ID and checkout URL
- Amount with discount tracking
- 24-hour expiration
- WhatsApp message tracking
- Payment status updates via webhooks

#### **csv_import_batches**
Audit trail for bulk customer imports.

**Key Features:**
- Tracks successful vs failed imports
- Stores validation errors with row numbers
- Links to imported contacts via import_batch_id

### Updated Tables:

#### **contacts**
- Added: `source` (whatsapp | manual | csv_import)
- Added: `import_batch_id` (UUID reference)
- Added: `notes` (TEXT)
- Added: `tags` (TEXT[])

#### **bookings**
- Added: `promotion_id` (UUID reference)
- Added: `original_price_chf` (DECIMAL)
- Added: `final_price_chf` (DECIMAL)
- Added: `payment_link_sent` (BOOLEAN)
- Added: `payment_link_sent_at` (TIMESTAMP)

---

## 2. Business Logic & Security

### Bot Discount Autonomy - Balance Sheet Protection

**Three-Tier Permission System:**

1. **Autonomous (≤20 CHF by default)**
   - Bot can offer immediately without approval
   - Scenarios: negative sentiment, 90+ days inactive, new customer
   - Configurable via `bot_max_autonomous_discount_chf` setting

2. **Approval Required (>20 CHF)**
   - Bot flags customer for admin review
   - Admin sees full context: sentiment, inactivity, spending history
   - Admin can approve (creates promotion) or reject with notes

3. **Manual Only (Admin-created promotions)**
   - Direct promotion creation by Master admins
   - Full flexibility on discount amounts and rules

**Smart Decision Logic:**

```typescript
// BotDiscountService.evaluateDiscountEligibility()

if (sentiment_score < -0.3) {
  // Negative sentiment → 15 CHF retention offer
  recommendedChf = 15;
  reason = "Negative sentiment detected. Retention discount.";
}
else if (days_inactive >= 90) {
  // Long inactivity → 20 CHF reactivation
  recommendedChf = 20;
  reason = "Customer inactive for 90+ days. Reactivation offer.";
}
else if (total_spent > 500 CHF && bookings > 5) {
  // VIP customer → 25 CHF (requires approval)
  recommendedChf = 25;
  reason = "High-value customer. VIP retention offer.";
}
else if (total_bookings === 0) {
  // First-time → 10 CHF incentive
  recommendedChf = 10;
  reason = "New customer. First-time booking incentive.";
}
```

**Financial Safeguards:**
- ✅ Hard cap on bot autonomy (default 20 CHF, configurable)
- ✅ All discounts >20 CHF require admin approval
- ✅ Admin sees customer lifetime value before approving
- ✅ Usage limits prevent abuse (max uses per customer)
- ✅ Expiry dates on all promotions
- ✅ Comprehensive audit trail in promotion_usage table

---

## 3. Stripe Payment Links

### Flow:

1. **Booking Created** → Service price retrieved
2. **Promotion Applied** (optional) → Discount calculated
3. **Payment Link Generated** → Stripe checkout session created
4. **Link Sent to Customer** → Bot sends via WhatsApp
5. **Customer Pays** → Stripe webhook confirms payment
6. **Booking Confirmed** → Status updated to "confirmed"

### Key Features:
- Dynamic pricing per booking
- Promotion code integration
- 24-hour link expiration
- Success/cancel URL redirects
- Email receipts (if customer email provided)
- Webhook handling for payment events

### Webhook Events Handled:
- `checkout.session.completed` → Mark payment as paid, confirm booking
- `checkout.session.expired` → Mark link as expired
- `payment_intent.succeeded` → Update transaction record
- `payment_intent.payment_failed` → Mark payment as failed

---

## 4. Customer Management

### Manual Customer Creation:
- Form in CRM with phone, name, email, language, notes, tags
- Source automatically set to "manual"
- Duplicate phone number validation

### Bulk CSV Upload:
**Format:**
```csv
phone_number,name,email,preferred_language,notes,tags
+41791234567,John Doe,john@example.com,de,VIP customer,vip;loyal
+41797654321,Jane Smith,jane@example.com,en,First contact,prospect
```

**Validation:**
- Required: phone_number
- Optional: name, email, preferred_language, notes, tags
- Duplicate detection (skips existing numbers)
- Error reporting with row numbers
- Batch tracking with import_batch_id

**Post-Import:**
- Contacts selectable in marketing campaigns
- Filter option: "No conversation yet" (imported but not messaged)
- Source tracking for analytics

---

## 5. Marketing Promotions

### New Features:

**Service-Specific Promotions:**
- Link promotion to a specific service OR
- Apply to all services

**Discount Configuration:**
- Fixed CHF amount (e.g., 20 CHF off)
- Percentage with max cap (e.g., 15% up to 50 CHF)

**Voucher Codes:**
- Auto-generated or custom codes
- Optional: customer must enter code
- Single-use or multi-use with limits

**Validity:**
- Start date/time
- End date/time (optional = no expiry)
- Max total uses
- Max uses per customer

**Target Audience:**
```json
{
  "sentiment": ["negative", "neutral"],
  "inactive_days": 90,
  "no_conversation": true,
  "imported_only": true,
  "tags": ["vip", "prospect"]
}
```

**Campaign Execution:**
- Select audience → Generate contact list
- Send personalized messages with voucher codes
- Track redemption rates
- Analytics: conversion, revenue impact

---

## 6. API Endpoints

### Promotions (`/api/promotions/*`)
- `POST /api/promotions/create` - Create new promotion (Master only)
- `PUT /api/promotions/:id` - Update promotion (Master only)
- `GET /api/promotions` - List all promotions
- `GET /api/promotions/:id` - Get promotion details
- `POST /api/promotions/validate` - Validate voucher code for booking
- `POST /api/promotions/apply` - Apply promotion to booking
- `GET /api/promotions/performance` - Analytics
- `DELETE /api/promotions/:id/deactivate` - Deactivate promotion

### Contacts (`/api/contacts/*`)
- `POST /api/contacts/create` - Manual customer creation
- `PUT /api/contacts/:id` - Update customer
- `GET /api/contacts` - List with filters (source, hasConversation, tags)
- `GET /api/contacts/:id` - Get customer details
- `POST /api/contacts/bulk-upload` - CSV import (Master only)
- `GET /api/contacts/import-batches` - Import history
- `GET /api/contacts/stats` - Customer statistics
- `DELETE /api/contacts/:id` - Delete customer

### Payment Links (`/api/payments/*`)
- `POST /api/payments/create-link` - Generate Stripe checkout URL
- `POST /api/payments/webhook` - Stripe webhook handler (public)
- `GET /api/payments/links/:id` - Get payment link details
- `GET /api/payments/booking/:bookingId` - Get links for booking
- `POST /api/payments/mark-sent` - Mark link as sent via WhatsApp
- `DELETE /api/payments/cancel/:id` - Cancel/expire payment link

### Bot Discounts (`/api/bot-discounts/*` - Master only)
- `GET /api/bot-discounts/pending` - Pending approval queue
- `POST /api/bot-discounts/:id/approve` - Approve request (creates promotion)
- `POST /api/bot-discounts/:id/reject` - Reject request
- `GET /api/bot-discounts/history` - Request history
- `GET /api/bot-discounts/analytics` - Approval rates, avg discount

---

## 7. Settings

### New Bot Settings:
- `bot_discount_enabled` (true/false) - Enable autonomous discount offering
- `bot_max_autonomous_discount_chf` (default: 20) - Max CHF bot can offer without approval
- `bot_discount_sentiment_threshold` (default: -0.3) - Sentiment score to trigger discount
- `bot_discount_inactive_days_threshold` (default: 90) - Days inactive before reactivation offer

### Stripe Settings:
- `stripe_api_key` (secret) - Stripe secret key (sk_test_... or sk_live_...)
- `payments_enabled` (true/false) - Enable payment processing
- `base_url` (string) - Base URL for payment success/cancel redirects

---

## 8. Frontend Changes Required

### New Pages/Sections:

1. **Promotions Management** (Master only)
   - Create/edit promotions
   - Voucher code generator
   - Performance analytics
   - Deactivate promotions

2. **Bot Discount Requests** (Master only)
   - Pending approval queue
   - Customer context display
   - Approve/reject with notes
   - Analytics dashboard

3. **Customer Management** (All roles)
   - Manual customer add/edit form
   - CSV upload with preview/validation
   - Import batch history
   - Customer source filter

4. **Enhanced Marketing Page** (Master only)
   - Service selection dropdown
   - Discount voucher fields
   - Validity date pickers
   - Audience filters:
     - No conversation yet
     - Imported only
     - Tags
     - Sentiment
     - Inactivity days

### Enhanced Booking Flow:
- Promotion code input field
- Discount calculation display
- Payment link generation button
- Send payment link via WhatsApp button
- Payment status indicator

---

## 9. CSV Import Format

**Required Columns:**
- `phone_number` (required, unique)

**Optional Columns:**
- `name`
- `email`
- `preferred_language` (de, en, fr, it, etc.)
- `notes`
- `tags` (comma-separated: "vip,loyal,prospect")

**Example:**
```csv
phone_number,name,email,preferred_language,notes,tags
+41791234567,Max Müller,max@example.com,de,Long-time customer,vip;loyal
+41797654321,Sophie Dubois,sophie@example.com,fr,,prospect
+41794567890,Mario Rossi,mario@example.com,it,Referred by Max,referral;new
```

**Validation Rules:**
- Phone format not strictly enforced (international variance)
- Duplicate phone numbers are skipped with error message
- Empty required fields cause row rejection
- Errors reported with row numbers for easy fixing

---

## 10. Testing Checklist

### Promotion System:
- [ ] Create service-specific promotion
- [ ] Create all-services promotion
- [ ] Generate unique voucher codes
- [ ] Validate promotion expiry
- [ ] Test usage limits (total and per customer)
- [ ] Verify discount calculations (fixed CHF and percentage)
- [ ] Check max discount cap for percentages
- [ ] Test promotion deactivation

### Bot Discount Logic:
- [ ] Bot offers 15 CHF for negative sentiment
- [ ] Bot offers 20 CHF for 90+ days inactive
- [ ] Bot flags 25 CHF for admin approval (VIP)
- [ ] Admin approves request → promotion created
- [ ] Admin rejects request → no promotion
- [ ] Auto-expire requests after 7 days
- [ ] Analytics show approval rates

### Payment Links:
- [ ] Generate Stripe checkout URL
- [ ] Apply promotion to payment link
- [ ] Send link via WhatsApp
- [ ] Complete payment → booking confirmed
- [ ] Webhook updates payment status
- [ ] Expired link → status updated
- [ ] Failed payment → status updated

### Customer Management:
- [ ] Manual customer creation
- [ ] Edit customer details
- [ ] Bulk CSV upload (100+ contacts)
- [ ] Validation errors reported correctly
- [ ] Import batch tracking
- [ ] Filter contacts by source
- [ ] Filter contacts without conversations

### Marketing Campaigns:
- [ ] Select service-specific audience
- [ ] Filter by sentiment
- [ ] Filter by inactivity days
- [ ] Filter imported-only contacts
- [ ] Filter no-conversation contacts
- [ ] Send campaign with voucher code
- [ ] Track redemption rates

---

## 11. Security Considerations

**Balance Sheet Protection:**
- ✅ Bot autonomy capped at configurable CHF limit
- ✅ Admin approval required for larger discounts
- ✅ Customer lifetime value visible before approval
- ✅ Usage limits prevent abuse
- ✅ Audit trail for all promotions applied

**Access Control:**
- ✅ Master role required for promotion creation
- ✅ Master role required for bot discount approval
- ✅ Master role required for CSV import
- ✅ Support role can view but not modify

**Data Integrity:**
- ✅ Duplicate phone number prevention
- ✅ Voucher code uniqueness enforced
- ✅ Promotion validation before application
- ✅ Transaction-safe payment processing
- ✅ Webhook signature verification (Stripe)

**Privacy:**
- ✅ Customer data encrypted at rest (Supabase)
- ✅ Stripe API keys stored as secrets
- ✅ No PII in logs
- ✅ GDPR-compliant deletion cascade

---

## 12. Deployment Steps

1. **Deploy Database Schema:**
   ```bash
   git add supabase-schema.sql
   git commit -m "feat: Promotion & payment system schema"
   git push origin main
   ```
   → GitHub Actions deploys to Supabase

2. **Configure Stripe:**
   - Settings → `stripe_api_key` → sk_test_... or sk_live_...
   - Settings → `payments_enabled` → true
   - Set up webhook endpoint in Stripe Dashboard:
     - URL: `https://your-domain.com/api/payments/webhook`
     - Events: checkout.session.*, payment_intent.*

3. **Enable Bot Discounts:**
   - Settings → `bot_discount_enabled` → true
   - Settings → `bot_max_autonomous_discount_chf` → 20 (or your limit)
   - Settings → `bot_discount_sentiment_threshold` → -0.3
   - Settings → `bot_discount_inactive_days_threshold` → 90

4. **Test Payment Flow:**
   - Create booking → Generate payment link → Pay → Verify confirmation

5. **Import Customer List:**
   - Prepare CSV file
   - CRM → Customers → Upload CSV
   - Review import batch results

6. **Create First Promotion:**
   - CRM → Promotions → Create
   - Set service, discount, validity
   - Test voucher code application

---

## 13. Analytics & Reporting

**Promotion Performance:**
- Total uses vs max uses
- Revenue generated (final_price_chf)
- Average discount per use
- Conversion rates
- Most popular promotions

**Bot Discount Analytics:**
- Total requests by status
- Approval/rejection rates
- Average discount amount
- Confidence score trends
- ROI on bot-offered discounts

**Customer Segmentation:**
- Total by source (whatsapp, manual, csv_import)
- With/without conversations
- By tags
- By sentiment
- By spending tier

**Payment Analytics:**
- Total revenue via Stripe
- Conversion rate (link sent → paid)
- Average payment time
- Expired link rate

---

## Summary

This system provides:
- ✅ **Flexible Promotion Management** - Service-specific discounts with voucher codes
- ✅ **Smart Bot Autonomy** - Intelligent discount offering within safe limits
- ✅ **Balance Sheet Protection** - Admin approval for larger discounts
- ✅ **Seamless Payment Processing** - Stripe checkout with promotion integration
- ✅ **Bulk Customer Import** - CSV upload with validation
- ✅ **Marketing Precision** - Advanced audience filtering
- ✅ **Comprehensive Analytics** - ROI tracking and performance metrics
- ✅ **Production-Ready Security** - Access control, audit trails, data protection

The system is designed for Swiss market (CHF currency, CET timezone) with production-grade reliability and admin control.
