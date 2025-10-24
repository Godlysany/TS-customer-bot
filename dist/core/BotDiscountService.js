"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("../infrastructure/supabase");
const SettingsService_1 = __importDefault(require("./SettingsService"));
const PromotionService_1 = __importDefault(require("./PromotionService"));
class BotDiscountService {
    /**
     * Determine if bot can offer a discount autonomously
     */
    async evaluateDiscountEligibility(contactId, conversationId) {
        try {
            // Check if bot discount feature is enabled
            const enabled = await SettingsService_1.default.getSetting('bot_discount_enabled');
            if (enabled !== 'true') {
                return {
                    can_offer_autonomously: false,
                    requires_approval: false,
                    max_autonomous_chf: 0,
                    recommended_chf: 0,
                    reason: 'Bot discount feature disabled',
                };
            }
            // Get bot autonomy settings
            const maxAutonomousChf = parseFloat(await SettingsService_1.default.getSetting('bot_max_autonomous_discount_chf') || '20');
            const sentimentThreshold = parseFloat(await SettingsService_1.default.getSetting('bot_discount_sentiment_threshold') || '-0.3');
            const inactiveDaysThreshold = parseInt(await SettingsService_1.default.getSetting('bot_discount_inactive_days_threshold') || '90');
            // Analyze customer
            const analysis = await this.analyzeCustomer(contactId);
            // Decision logic
            let recommendedChf = 0;
            let reason = '';
            let canOfferAutonomously = false;
            // Check sentiment
            if (analysis.sentiment_score < sentimentThreshold) {
                recommendedChf = Math.min(15, maxAutonomousChf); // Offer 15 CHF for negative sentiment
                reason = `Negative sentiment detected (${analysis.sentiment_score.toFixed(2)}). Offering retention discount.`;
                canOfferAutonomously = recommendedChf <= maxAutonomousChf;
            }
            // Check inactivity
            else if (analysis.days_inactive >= inactiveDaysThreshold) {
                recommendedChf = Math.min(20, maxAutonomousChf); // Offer 20 CHF for reactivation
                reason = `Customer inactive for ${analysis.days_inactive} days. Offering reactivation discount.`;
                canOfferAutonomously = recommendedChf <= maxAutonomousChf;
            }
            // High-value customer special treatment
            else if (analysis.total_spent_chf > 500 && analysis.total_bookings > 5) {
                recommendedChf = 25; // Offer 25 CHF for VIP
                reason = `High-value customer (${analysis.total_bookings} bookings, ${analysis.total_spent_chf} CHF spent). Recommended VIP retention offer.`;
                canOfferAutonomously = recommendedChf <= maxAutonomousChf;
            }
            // New customer incentive
            else if (analysis.total_bookings === 0) {
                recommendedChf = Math.min(10, maxAutonomousChf); // Small first-time discount
                reason = 'New customer. Offering first-time booking incentive.';
                canOfferAutonomously = recommendedChf <= maxAutonomousChf;
            }
            return {
                can_offer_autonomously: canOfferAutonomously,
                requires_approval: recommendedChf > maxAutonomousChf,
                max_autonomous_chf: maxAutonomousChf,
                recommended_chf: recommendedChf,
                reason,
            };
        }
        catch (error) {
            console.error('Error evaluating discount eligibility:', error);
            return {
                can_offer_autonomously: false,
                requires_approval: false,
                max_autonomous_chf: 0,
                recommended_chf: 0,
                reason: 'Error during evaluation',
            };
        }
    }
    /**
     * Analyze customer behavior and history
     */
    async analyzeCustomer(contactId) {
        try {
            // Get contact analytics
            const { data: contact } = await supabase_1.supabase
                .from('contacts')
                .select('*')
                .eq('id', contactId)
                .single();
            // Get customer analytics
            const { data: analytics } = await supabase_1.supabase
                .from('customer_analytics')
                .select('*')
                .eq('contact_id', contactId)
                .single();
            // Get last interaction
            const { data: lastMessage } = await supabase_1.supabase
                .from('messages')
                .select('timestamp')
                .eq('sender', contact?.phone_number || '')
                .order('timestamp', { ascending: false })
                .limit(1)
                .single();
            // Calculate days inactive
            const lastInteraction = lastMessage?.timestamp ? new Date(lastMessage.timestamp) : null;
            const daysInactive = lastInteraction
                ? Math.floor((Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24))
                : 999;
            // Get total bookings and spent
            const { count: totalBookings } = await supabase_1.supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('contact_id', contactId)
                .in('status', ['confirmed', 'completed']);
            const { data: transactions } = await supabase_1.supabase
                .from('payment_transactions')
                .select('amount')
                .eq('contact_id', contactId)
                .eq('status', 'succeeded');
            const totalSpent = transactions?.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) || 0;
            return {
                sentiment_score: analytics?.sentiment_score || 0,
                days_inactive: daysInactive,
                total_bookings: totalBookings || 0,
                total_spent_chf: totalSpent,
                last_interaction_at: lastInteraction,
            };
        }
        catch (error) {
            console.error('Error analyzing customer:', error);
            return {
                sentiment_score: 0,
                days_inactive: 0,
                total_bookings: 0,
                total_spent_chf: 0,
                last_interaction_at: null,
            };
        }
    }
    /**
     * Create a bot discount request for admin approval
     */
    async createDiscountRequest(request) {
        try {
            const { data, error } = await supabase_1.supabase
                .from('bot_discount_requests')
                .insert({
                ...request,
                status: 'pending',
            })
                .select('id')
                .single();
            if (error)
                throw error;
            return data;
        }
        catch (error) {
            console.error('Error creating discount request:', error);
            throw error;
        }
    }
    /**
     * Approve a bot discount request and create promotion
     */
    async approveDiscountRequest(requestId, reviewedBy, adminNotes) {
        try {
            // Get request details
            const { data: request } = await supabase_1.supabase
                .from('bot_discount_requests')
                .select('*')
                .eq('id', requestId)
                .single();
            if (!request) {
                throw new Error('Discount request not found');
            }
            if (request.status !== 'pending') {
                throw new Error('Request already processed');
            }
            // Create a personalized promotion
            const promotion = await PromotionService_1.default.createPromotion({
                name: `Bot Discount - ${request.contact_id.slice(0, 8)}`,
                description: `Automated discount: ${request.reason}`,
                promotion_type: 'reactivation',
                service_id: request.recommended_service_id || null,
                applies_to_all_services: !request.recommended_service_id,
                discount_type: 'fixed_chf',
                discount_value: request.recommended_discount_chf,
                voucher_code: `BOT${Date.now().toString(36).toUpperCase()}`, // Generate unique code
                code_required: true,
                valid_from: new Date().toISOString(),
                valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
                max_uses: 1,
                max_uses_per_customer: 1,
                bot_can_offer: false,
                bot_max_chf: 0,
                requires_admin_approval: false,
                is_active: true,
            }, reviewedBy);
            // Update request status
            await supabase_1.supabase
                .from('bot_discount_requests')
                .update({
                status: 'approved',
                reviewed_by: reviewedBy,
                reviewed_at: new Date().toISOString(),
                admin_notes: adminNotes,
                created_promotion_id: promotion.id,
            })
                .eq('id', requestId);
            return { promotion_id: promotion.id };
        }
        catch (error) {
            console.error('Error approving discount request:', error);
            throw error;
        }
    }
    /**
     * Reject a bot discount request
     */
    async rejectDiscountRequest(requestId, reviewedBy, adminNotes) {
        try {
            await supabase_1.supabase
                .from('bot_discount_requests')
                .update({
                status: 'rejected',
                reviewed_by: reviewedBy,
                reviewed_at: new Date().toISOString(),
                admin_notes: adminNotes,
            })
                .eq('id', requestId);
        }
        catch (error) {
            console.error('Error rejecting discount request:', error);
            throw error;
        }
    }
    /**
     * Get all pending discount requests
     */
    async getPendingRequests() {
        try {
            const { data, error } = await supabase_1.supabase
                .from('bot_discount_requests')
                .select(`
          *,
          contacts:contact_id (name, phone_number, email),
          services:recommended_service_id (name)
        `)
                .eq('status', 'pending')
                .lt('expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
                .order('created_at', { ascending: false });
            if (error)
                throw error;
            return data || [];
        }
        catch (error) {
            console.error('Error fetching pending requests:', error);
            return [];
        }
    }
    /**
     * Get discount request history with analytics
     */
    async getRequestHistory(filters) {
        try {
            let query = supabase_1.supabase
                .from('bot_discount_requests')
                .select(`
          *,
          contacts:contact_id (name, phone_number),
          reviewers:reviewed_by (name, email)
        `);
            if (filters?.status) {
                query = query.eq('status', filters.status);
            }
            if (filters?.contactId) {
                query = query.eq('contact_id', filters.contactId);
            }
            if (filters?.limit) {
                query = query.limit(filters.limit);
            }
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error)
                throw error;
            return data || [];
        }
        catch (error) {
            console.error('Error fetching request history:', error);
            return [];
        }
    }
    /**
     * Get bot discount analytics
     */
    async getDiscountAnalytics() {
        try {
            const { data: analytics } = await supabase_1.supabase
                .from('bot_discount_analytics')
                .select('*')
                .order('request_date', { ascending: false })
                .limit(30); // Last 30 days
            if (!analytics || analytics.length === 0) {
                return {
                    total_requests: 0,
                    pending: 0,
                    approved: 0,
                    rejected: 0,
                    expired: 0,
                    avg_discount_chf: 0,
                    approval_rate: 0,
                };
            }
            const totals = analytics.reduce((acc, day) => {
                acc.total_requests += day.request_count || 0;
                acc.approved += day.approved_count || 0;
                acc.rejected += day.rejected_count || 0;
                acc.pending += day.status === 'pending' ? day.request_count : 0;
                acc.expired += day.status === 'expired' ? day.request_count : 0;
                acc.avg_discount_sum += (day.avg_recommended_chf || 0) * (day.request_count || 0);
                return acc;
            }, {
                total_requests: 0,
                approved: 0,
                rejected: 0,
                pending: 0,
                expired: 0,
                avg_discount_sum: 0,
            });
            const avgDiscountChf = totals.total_requests > 0 ? totals.avg_discount_sum / totals.total_requests : 0;
            const approvalRate = totals.approved + totals.rejected > 0
                ? (totals.approved / (totals.approved + totals.rejected)) * 100
                : 0;
            return {
                total_requests: totals.total_requests,
                pending: totals.pending,
                approved: totals.approved,
                rejected: totals.rejected,
                expired: totals.expired,
                avg_discount_chf: avgDiscountChf,
                approval_rate: approvalRate,
            };
        }
        catch (error) {
            console.error('Error fetching discount analytics:', error);
            return {
                total_requests: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
                expired: 0,
                avg_discount_chf: 0,
                approval_rate: 0,
            };
        }
    }
    /**
     * Auto-expire old pending requests
     */
    async expireOldRequests() {
        try {
            const { data, error } = await supabase_1.supabase
                .from('bot_discount_requests')
                .update({ status: 'expired' })
                .eq('status', 'pending')
                .lt('expires_at', new Date().toISOString())
                .select('id');
            if (error)
                throw error;
            return data?.length || 0;
        }
        catch (error) {
            console.error('Error expiring old requests:', error);
            return 0;
        }
    }
}
exports.default = new BotDiscountService();
