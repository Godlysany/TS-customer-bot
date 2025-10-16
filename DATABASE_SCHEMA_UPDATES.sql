-- WhatsApp CRM Bot - Promotion & Payment System Schema Updates
-- Date: October 16, 2025

-- ============================================
-- 1. UPDATE CONTACTS TABLE FOR MANUAL/CSV IMPORT
-- ============================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'whatsapp' CHECK (source IN ('whatsapp', 'manual', 'csv_import'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS import_batch_id UUID;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags TEXT[]; -- For segmentation

CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts(source);
CREATE INDEX IF NOT EXISTS idx_contacts_import_batch ON contacts(import_batch_id);

-- ============================================
-- 2. PROMOTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    promotion_type VARCHAR(50) NOT NULL CHECK (promotion_type IN ('service_discount', 'voucher', 'reactivation')),
    
    -- Service linkage
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    applies_to_all_services BOOLEAN DEFAULT false,
    
    -- Discount configuration
    discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('fixed_chf', 'percentage')),
    discount_value DECIMAL(10,2) NOT NULL, -- CHF amount or percentage
    max_discount_chf DECIMAL(10,2), -- Cap for percentage discounts
    
    -- Voucher code
    voucher_code VARCHAR(100) UNIQUE,
    code_required BOOLEAN DEFAULT false, -- If true, customer must enter code
    
    -- Validity
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER, -- NULL = unlimited
    uses_count INTEGER DEFAULT 0,
    max_uses_per_customer INTEGER DEFAULT 1,
    
    -- Audience targeting (for marketing campaigns)
    target_audience JSONB, -- {sentiment: ['negative'], inactive_days: 90, no_conversation: true, etc}
    
    -- Bot autonomy settings
    bot_can_offer BOOLEAN DEFAULT false, -- Bot can autonomously offer this
    bot_max_chf DECIMAL(10,2) DEFAULT 0, -- Max CHF bot can offer without admin approval
    requires_admin_approval BOOLEAN DEFAULT true,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES agents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_service ON promotions(service_id);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(voucher_code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, valid_from, valid_until);

-- ============================================
-- 3. PROMOTION USAGE TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS promotion_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    discount_applied_chf DECIMAL(10,2) NOT NULL,
    original_price_chf DECIMAL(10,2) NOT NULL,
    final_price_chf DECIMAL(10,2) NOT NULL,
    offered_by VARCHAR(50) CHECK (offered_by IN ('bot_autonomous', 'bot_approved', 'agent', 'customer_entered')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion ON promotion_usage(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_contact ON promotion_usage(contact_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_booking ON promotion_usage(booking_id);

-- ============================================
-- 4. BOT DISCOUNT REQUESTS (Admin Approval Queue)
-- ============================================

CREATE TABLE IF NOT EXISTS bot_discount_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Bot's recommendation
    recommended_discount_chf DECIMAL(10,2) NOT NULL,
    recommended_service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    reason TEXT NOT NULL, -- Bot explains why (sentiment, inactivity, etc)
    bot_confidence DECIMAL(3,2), -- 0.00-1.00 confidence score
    
    -- Context for admin
    customer_sentiment VARCHAR(50), -- negative, neutral, positive
    days_inactive INTEGER,
    total_bookings INTEGER DEFAULT 0,
    total_spent_chf DECIMAL(10,2) DEFAULT 0,
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    
    -- Admin decision
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    reviewed_by UUID REFERENCES agents(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT,
    
    -- If approved, track the created promotion
    created_promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL,
    
    -- Auto-expire after 7 days
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_discount_status ON bot_discount_requests(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_bot_discount_contact ON bot_discount_requests(contact_id);

-- ============================================
-- 5. STRIPE PAYMENT LINKS
-- ============================================

CREATE TABLE IF NOT EXISTS payment_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Stripe data
    stripe_checkout_session_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    checkout_url TEXT NOT NULL,
    
    -- Pricing
    amount_chf DECIMAL(10,2) NOT NULL,
    original_amount_chf DECIMAL(10,2), -- Before discount
    promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL,
    discount_applied_chf DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'expired', 'cancelled')),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Tracking
    sent_via_whatsapp BOOLEAN DEFAULT false,
    whatsapp_message_id VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_links_booking ON payment_links(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_stripe_session ON payment_links(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_status ON payment_links(payment_status);

-- ============================================
-- 6. UPDATE BOOKINGS TABLE
-- ============================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS original_price_chf DECIMAL(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_price_chf DECIMAL(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_link_sent BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_link_sent_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_bookings_promotion ON bookings(promotion_id);

-- ============================================
-- 7. CSV IMPORT BATCHES (Track bulk uploads)
-- ============================================

CREATE TABLE IF NOT EXISTS csv_import_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    total_rows INTEGER NOT NULL,
    successful_imports INTEGER DEFAULT 0,
    failed_imports INTEGER DEFAULT 0,
    errors JSONB, -- Store validation errors
    status VARCHAR(50) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_csv_batches_uploaded_by ON csv_import_batches(uploaded_by);

-- ============================================
-- 8. BOT SETTINGS FOR DISCOUNT AUTONOMY
-- ============================================

-- Add to settings table (already exists, just insert defaults)
INSERT INTO settings (key, value, description) VALUES
('bot_max_autonomous_discount_chf', '20', 'Maximum CHF the bot can offer autonomously without admin approval')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, description) VALUES
('bot_discount_sentiment_threshold', '-0.3', 'Sentiment score threshold for bot to consider offering discount (-1 to 1)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, description) VALUES
('bot_discount_inactive_days_threshold', '90', 'Days of inactivity before bot considers reactivation discount')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, description) VALUES
('bot_discount_enabled', 'false', 'Enable bot autonomous discount offering')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 9. ANALYTICS VIEWS
-- ============================================

-- View for promotion performance
CREATE OR REPLACE VIEW promotion_performance AS
SELECT 
    p.id,
    p.name,
    p.voucher_code,
    p.discount_type,
    p.discount_value,
    p.uses_count,
    p.max_uses,
    COUNT(pu.id) as actual_uses,
    SUM(pu.discount_applied_chf) as total_discount_given_chf,
    SUM(pu.final_price_chf) as total_revenue_chf,
    AVG(pu.discount_applied_chf) as avg_discount_chf,
    p.is_active,
    p.valid_from,
    p.valid_until
FROM promotions p
LEFT JOIN promotion_usage pu ON p.id = pu.promotion_id
GROUP BY p.id, p.name, p.voucher_code, p.discount_type, p.discount_value, 
         p.uses_count, p.max_uses, p.is_active, p.valid_from, p.valid_until;

-- View for bot discount request analytics
CREATE OR REPLACE VIEW bot_discount_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as request_date,
    status,
    COUNT(*) as request_count,
    AVG(recommended_discount_chf) as avg_recommended_chf,
    AVG(bot_confidence) as avg_confidence,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
FROM bot_discount_requests
GROUP BY DATE_TRUNC('day', created_at), status
ORDER BY request_date DESC;

-- ============================================
-- 10. FUNCTIONS AND TRIGGERS
-- ============================================

-- Auto-increment promotion usage count
CREATE OR REPLACE FUNCTION increment_promotion_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE promotions 
    SET uses_count = uses_count + 1,
        updated_at = NOW()
    WHERE id = NEW.promotion_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_promotion_usage
AFTER INSERT ON promotion_usage
FOR EACH ROW
EXECUTE FUNCTION increment_promotion_usage();

-- Auto-expire old bot discount requests
CREATE OR REPLACE FUNCTION expire_old_bot_requests()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'pending' AND NEW.expires_at < NOW() THEN
        NEW.status := 'expired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_expire_bot_requests
BEFORE UPDATE ON bot_discount_requests
FOR EACH ROW
EXECUTE FUNCTION expire_old_bot_requests();

-- ============================================
-- DEPLOYMENT NOTES
-- ============================================

-- This schema adds:
-- 1. Full promotion system with service-specific discounts
-- 2. Bot autonomous discount offering with admin approval queue
-- 3. Payment link tracking for Stripe checkout
-- 4. CSV import support for customer lists
-- 5. Comprehensive promotion usage analytics
-- 6. Security: Bot autonomy capped at configurable CHF limit
-- 7. Balance sheet protection through admin approval workflow

-- Deploy via: GitHub Actions → .github/workflows/deploy-supabase.yml
