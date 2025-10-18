# Complete Testing Guide - Promotion & Payment System

## 🎯 What You Can Now Test

Your WhatsApp CRM now has **3 new fully functional pages** ready to test:

1. **Promotions Management** - Create and manage discounts
2. **Customer Management** - Add customers manually or via CSV
3. **Bot Discount Approvals** - Review bot-suggested discounts

---

## 🔐 Step 1: Login to CRM

1. Open your CRM dashboard (the webview should show automatically)
2. Login with default credentials:
   - Email: `admin@crm.local`
   - Password: `admin123`

**After login, you'll see the new menu items in the left sidebar:**
- ✅ **Promotions** (Master only)
- ✅ **Discount Approvals** (Master only)
- ✅ **Customer Management** (Master only)

---

## 📋 Test 1: Promotions Management

### Create Your First Promotion

1. Click **"Promotions"** in the sidebar
2. Click **"Create Promotion"** button
3. Fill in the form:
   - **Name**: "Summer Sale 2025"
   - **Description**: "20 CHF off all dental cleanings"
   - **Service**: Select "Dental Cleaning" (or leave empty for all services)
   - **Discount Type**: Choose "Fixed (CHF)"
   - **Discount Value**: `20`
   - **Voucher Code**: Click "Generate" or type `SUMMER2025`
   - **Valid From**: Today's date
   - **Valid Until**: One month from today
   - **Usage Limit**: `100` (optional)
   - **Bot autonomous**: Check this box

4. Click **"Save Promotion"**

**Expected Result:** ✅ Success toast, promotion appears in table with "Active" status

### Test Promotion Features

- **View Performance**: Top cards show usage stats (initially 0)
- **Edit Promotion**: Click edit icon (pencil) on any promotion
- **Deactivate**: Click trash icon to deactivate
- **Voucher Code**: Note the generated code - you'll use this later

---

## 👥 Test 2: Customer Management

### Manual Customer Creation

1. Click **"Customer Management"** in the sidebar
2. Click **"Add Contact"** button
3. Fill in the form:
   - **Phone Number**: `+41791234567` (required)
   - **Name**: `Max Müller`
   - **Email**: `max.mueller@example.com`
   - **Preferred Language**: Select `German (de)`
   - **Tags**: `vip, loyal`
   - **Notes**: `Long-time customer, prefers morning appointments`

4. Click **"Save Contact"**

**Expected Result:** ✅ Contact appears in table with "manual" source badge

### CSV Bulk Import

1. Click **"Download Template"** button
2. Open the CSV file in Excel/Numbers/Google Sheets
3. **Add 3-5 test customers** with this format:

```csv
phone_number,name,email,preferred_language,notes,tags
+41791234567,Sophie Dubois,sophie@example.com,fr,VIP customer,vip;loyal
+41797654321,Hans Meier,hans@example.com,de,New prospect,prospect
+41788123456,Maria Rossi,maria@example.com,it,Regular customer,regular
```

4. Save as `.csv` file
5. Click **"Upload CSV"** button in CRM
6. Select your CSV file

**Expected Result:** 
- ✅ Success message: "Successfully imported X contacts"
- ✅ Green import summary card appears showing successful/failed counts
- ✅ New contacts appear in table with "csv_import" badge

### Test Filters

- **Search**: Type a name/phone/email in search box
- **Source Filter**: Select "CSV Import" to see only uploaded customers
- **Edit Contact**: Click pencil icon to edit
- **Delete Contact**: Click trash icon (Master only)

---

## 🤖 Test 3: Bot Discount Approvals

This feature requires bot interaction, but you can test the approval interface:

### Understanding Bot Discount Logic

The bot automatically evaluates customers and suggests discounts when:
- **Negative sentiment** detected (threshold: -0.3)
- **Inactive** for 90+ days
- **High-value** retention opportunity

**Bot autonomy rules:**
- ≤20 CHF → Bot offers immediately
- >20 CHF → Flags for admin approval

### Simulating a Bot Discount Request

Since you need actual bot interactions to generate requests, here's what the page shows:

1. Click **"Discount Approvals"** in sidebar
2. **If no requests**: You'll see "All caught up! No pending discount requests"
3. **Analytics Cards** show:
   - Pending Requests: 0
   - Approval Rate: N/A (no data yet)
   - Avg Discount: N/A
   - Total Requests: 0

### How It Will Work (When Bot Generates Requests)

When a customer interaction triggers bot evaluation:
1. Bot analyzes sentiment, inactivity, lifetime value
2. If discount >20 CHF → Request appears in approval queue
3. You see:
   - Customer name, phone, lifetime value
   - Suggested discount amount
   - Sentiment score
   - Days inactive
   - Bot reasoning

4. You can **Approve** (creates time-limited promotion) or **Reject**

---

## 🧪 Test 4: End-to-End Flow

Let's test the complete journey:

### Scenario: Create Promotion → Import Customers → Apply to Booking

#### Step 1: Create a Test Promotion
1. Go to **Promotions**
2. Create: "New Customer Welcome" - 15 CHF off, code `WELCOME15`
3. ✅ Verify it appears as "Active"

#### Step 2: Import Test Customers
1. Go to **Customer Management**
2. Upload CSV with 3 customers
3. ✅ Verify all 3 appear in table

#### Step 3: Apply Promotion to Booking (Future Integration)
This will work when you:
- Go to **Bookings** page
- Create a new booking
- Enter promotion code `WELCOME15`
- See 15 CHF discount applied

---

## 📊 Expected Backend Data

### Database Tables Created

You can verify in your Supabase dashboard:

1. **`promotions`** - Should show your created promotions
2. **`contacts`** - Should show manually added + CSV imported customers
3. **`csv_import_batches`** - Should show import history
4. **`bot_discount_requests`** - Empty (until bot generates requests)
5. **`promotion_usage`** - Tracks when promotions are applied
6. **`payment_links`** - Will populate when you create Stripe payment links

---

## ✅ Verification Checklist

### Promotions Page
- [ ] Page loads without errors
- [ ] "Create Promotion" button works
- [ ] Form validates required fields
- [ ] Voucher code generator works
- [ ] Created promotion appears in table
- [ ] Edit and deactivate buttons work
- [ ] Performance cards display (even with 0 values)

### Customer Management Page
- [ ] Page loads without errors
- [ ] "Add Contact" form works
- [ ] Phone number validation works
- [ ] Manual contact appears with "manual" badge
- [ ] CSV template downloads
- [ ] CSV upload processes successfully
- [ ] Import summary shows correct counts
- [ ] Imported contacts appear with "csv_import" badge
- [ ] Search filter works
- [ ] Source filter works
- [ ] Edit contact works
- [ ] Delete contact works (Master only)

### Bot Discount Approvals Page
- [ ] Page loads without errors
- [ ] Analytics cards display
- [ ] "All caught up" message shows (if no requests)
- [ ] Approve/reject buttons appear (when requests exist)

---

## 🐛 Troubleshooting

### "Failed to create promotion"
- Check that you filled in required fields (Name, Discount Value)
- Verify you're logged in as Master role
- Check browser console for specific error

### "CSV upload failed"
- Verify CSV format matches template exactly
- Check phone numbers start with `+` (e.g., `+41791234567`)
- Ensure no duplicate phone numbers in CSV
- Check file is saved as `.csv` (not `.xlsx`)

### "Page not found"
- Clear browser cache and hard refresh (Cmd/Ctrl + Shift + R)
- Verify you're logged in as Master role
- Check that frontend rebuilt successfully

### Navigation items missing
- Verify you're logged in with Master role (not Support)
- Check authentication token is valid (re-login if needed)

---

## 🎉 Success Indicators

You'll know everything is working when:

1. ✅ All 3 new menu items appear in sidebar
2. ✅ Promotions page shows your created discounts
3. ✅ Customer Management shows manually added + CSV imported contacts
4. ✅ Bot Discount Approvals page loads (even if empty)
5. ✅ No console errors in browser
6. ✅ All forms submit successfully
7. ✅ Data persists after page refresh

---

## 🔜 Next: Testing Payment Links

To fully test the payment system:

1. **Configure Stripe** (in Settings):
   - Add `stripe_api_key`
   - Add `stripe_webhook_secret`
   - Set `payments_enabled = true`

2. **Create a Booking**:
   - Go to Bookings page
   - Create booking with promotion code
   - Generate payment link
   - Complete payment with Stripe test card: `4242 4242 4242 4242`

3. **Verify Webhook**:
   - Check that payment status updates to "confirmed"
   - View `payment_transactions` table in Supabase

---

## 📞 Ready to Test!

**Start with:**
1. Login to CRM
2. Create 2-3 promotions
3. Upload CSV with 5 customers
4. Verify everything saves and displays correctly

**The backend is production-ready. Frontend pages are now fully integrated and testable!** 🚀

---

*If you encounter any issues, check the browser console for errors and let me know what you see.*
