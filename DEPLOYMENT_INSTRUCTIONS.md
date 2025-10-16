# Deployment Instructions

## 1. Database Schema Deployment (REQUIRED)

**You must run these commands to deploy the database schema changes:**

```bash
# In your local terminal (not Replit):
git add -A
git commit -m "feat: Message pre-approval system with WhatsApp auto-reconnect

Database schema updates:
- Add questionnaires.type column (default: 'anamnesis')
- Add messages.whatsapp_message_id for idempotency
- Add messages.approval_status 'sending' state

Backend improvements:
- WhatsApp auto-reconnect on server startup
- Actual socket connection status (not stale database setting)
- Global error banner when WhatsApp disconnected

Message pre-approval features:
- Atomic approval with race condition prevention
- Idempotency protection against duplicate sends
- Metadata fallback for delivery confirmation
- Manual recovery workflow for partial failures"

git push origin main
```

**What this fixes:**
- ✅ "column questionnaires_1.type does not exist" error
- ✅ "invalid input syntax for type uuid: 'undefined'" in customers page
- ✅ Message pre-approval database requirements
- ✅ WhatsApp message delivery idempotency

**Verify deployment:**
- Go to your GitHub repo → Actions tab
- Watch "Deploy to Supabase" workflow complete
- Check for green checkmark ✓

---

## 2. WhatsApp Connection Setup

After server restarts, WhatsApp **auto-reconnects if credentials exist**.

**First-time setup:**
1. Go to CRM → Settings → WhatsApp Connection
2. Click "Connect WhatsApp"
3. Scan QR code with your phone
4. Connection persists across server restarts

**If connection lost:**
- Red banner appears at top: "WhatsApp Disconnected"
- Go to Settings → WhatsApp Connection → Connect
- Scan new QR code

---

## 3. Message Pre-Approval Feature

**To enable human approval for bot messages:**

1. Go to Settings → Bot Configuration
2. Enable "Require Human Approval for Messages"
3. Save settings

**How it works:**
- Bot creates message with `pending_approval` status
- Message appears in Conversations with yellow badge
- Agent clicks "Approve" → sends to WhatsApp
- Agent clicks "Reject" → message discarded

**Safety features:**
- ✅ Atomic approval prevents duplicate sends
- ✅ Idempotency protection on retry
- ✅ Metadata fallback if database update fails
- ✅ Clear error messages for operators

---

## 4. Stripe Payment Integration Setup

**Environment Variables (Railway):**
```
STRIPE_API_KEY=sk_test_... (or sk_live_... for production)
```

**Database Settings (via CRM):**
1. Go to Settings → System Settings
2. Add setting:
   - Key: `payments_enabled`
   - Value: `true`
3. Add setting:
   - Key: `stripe_api_key`
   - Value: Your Stripe secret key

**Payment Flow UX:**
1. Customer books appointment via WhatsApp
2. Bot creates booking in database
3. **TODO: Bot sends Stripe payment link** (not implemented yet)
4. Customer pays via Stripe
5. Webhook confirms payment
6. Booking marked as paid

**Missing Implementation:**
- [ ] Bot doesn't auto-send payment links yet
- [ ] Webhook endpoint for payment confirmation
- [ ] Payment status sync with bookings

**Manual workaround:**
- Use CRM → Bookings → Create payment manually
- Or use Stripe API directly

---

## 5. Production Checklist

**Before going live:**
- [ ] Deploy database schema (step 1 above)
- [ ] Connect WhatsApp (step 2 above)
- [ ] Test message pre-approval flow
- [ ] Configure OpenAI API key (Settings)
- [ ] Configure SendGrid for emails (Settings)
- [ ] Set up Google Calendar OAuth (Settings)
- [ ] Configure cancellation policies (Settings)
- [ ] Add at least one admin agent
- [ ] Test booking creation end-to-end
- [ ] Test questionnaire responses
- [ ] Configure Stripe (if using payments)

**Known limitations:**
- Stripe payment links not auto-sent by bot yet
- Customer CRM only populates when they message the bot
- Analytics empty until conversations happen

---

## 6. Troubleshooting

**"WhatsApp Disconnected" banner:**
→ Go to Settings → WhatsApp Connection → Connect

**"column questionnaires_1.type does not exist":**
→ Run git push (step 1 above) to deploy schema

**Customer page shows "Unknown Customer":**
→ Normal if no conversations yet. Customers populate when they message the bot.

**Messages not appearing in CRM:**
→ Check WhatsApp connection status
→ Check bot_enabled setting is true
→ Check Railway logs for errors

---

## 7. Recommended Next Steps

1. **Complete Stripe integration:**
   - Auto-send payment links via bot
   - Webhook for payment confirmation
   - Payment status sync

2. **Add booking form in CRM:**
   - Direct booking creation without WhatsApp
   - Manual service assignment

3. **Enhanced analytics:**
   - Revenue tracking
   - Conversion rates
   - Bot performance metrics

4. **Notification improvements:**
   - SMS fallback for critical notifications
   - Email templates customization
   - Multi-language support
