"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
class MarketingService {
    async getFilteredContacts(filters) {
        let query = supabase_1.supabase
            .from('contacts')
            .select(`
        *,
        conversations(*),
        customer_analytics(*),
        bookings(*)
      `);
        const { data, error } = await query;
        if (error)
            throw error;
        let filtered = data || [];
        // Handle interaction filters with clear logic
        if (filters.interactionType === 'never') {
            // Target contacts with NO conversations (e.g., CSV imports)
            filtered = filtered.filter(contact => !contact.conversations || contact.conversations.length === 0);
        }
        else if (filters.lastInteractionDays) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - filters.lastInteractionDays);
            if (filters.interactionType === 'active') {
                // Active in last X days: last message was AFTER cutoffDate
                filtered = filtered.filter(contact => {
                    const lastConversation = contact.conversations?.[0];
                    if (!lastConversation)
                        return false;
                    return new Date(lastConversation.last_message_at) > cutoffDate;
                });
            }
            else {
                // Inactive for X+ days: last message was BEFORE cutoffDate (default behavior)
                filtered = filtered.filter(contact => {
                    const lastConversation = contact.conversations?.[0];
                    if (!lastConversation)
                        return false;
                    return new Date(lastConversation.last_message_at) <= cutoffDate;
                });
            }
        }
        // Handle hasAppointment boolean (from frontend)
        if (filters.hasAppointment !== undefined) {
            if (filters.hasAppointment) {
                // Has at least one booking
                filtered = filtered.filter(contact => contact.bookings && contact.bookings.length > 0);
            }
            else {
                // No bookings
                filtered = filtered.filter(contact => !contact.bookings || contact.bookings.length === 0);
            }
        }
        // Handle appointmentStatus (advanced filter)
        if (filters.appointmentStatus === 'no_appointment') {
            filtered = filtered.filter(contact => !contact.bookings || contact.bookings.length === 0);
        }
        if (filters.appointmentStatus === 'upcoming') {
            const now = new Date();
            filtered = filtered.filter(contact => contact.bookings?.some((b) => new Date(b.start_time) > now));
        }
        if (filters.appointmentStatus === 'past_x_days' && filters.pastDaysCount) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - filters.pastDaysCount);
            filtered = filtered.filter(contact => contact.bookings?.some((b) => new Date(b.start_time) >= cutoffDate && new Date(b.start_time) <= new Date()));
        }
        if (filters.upsellPotential) {
            filtered = filtered.filter(contact => contact.customer_analytics &&
                filters.upsellPotential.includes(contact.customer_analytics.upsell_potential));
        }
        // Handle simplified sentiment from frontend (string)
        if (filters.sentiment) {
            filtered = filtered.filter(contact => {
                if (!contact.customer_analytics?.sentiment_score)
                    return false;
                const score = contact.customer_analytics.sentiment_score;
                if (filters.sentiment === 'positive') {
                    return score >= 0.3;
                }
                else if (filters.sentiment === 'negative') {
                    return score < -0.3;
                }
                else { // neutral
                    return score >= -0.3 && score < 0.3;
                }
            });
        }
        // Handle advanced sentimentScore filter (min/max ranges)
        if (filters.sentimentScore) {
            filtered = filtered.filter(contact => {
                if (!contact.customer_analytics?.sentiment_score)
                    return false;
                const score = contact.customer_analytics.sentiment_score;
                if (filters.sentimentScore.min !== undefined && score < filters.sentimentScore.min)
                    return false;
                if (filters.sentimentScore.max !== undefined && score > filters.sentimentScore.max)
                    return false;
                return true;
            });
        }
        return (0, mapper_1.toCamelCaseArray)(filtered);
    }
    async createCampaign(name, messageTemplate, filterCriteria, promotionId, questionnaireId, promotionAfterCompletion, scheduledAt, // Accept both Date and ISO string
    status, // Accept status from frontend
    createdBy) {
        const contacts = await this.getFilteredContacts(filterCriteria);
        // Convert scheduledAt to ISO string if it's a Date object
        let scheduledAtISO = null;
        if (scheduledAt) {
            scheduledAtISO = typeof scheduledAt === 'string' ? scheduledAt : scheduledAt.toISOString();
        }
        // Use provided status or infer from scheduledAt
        const campaignStatus = status || (scheduledAt ? 'scheduled' : 'draft');
        const { data, error } = await supabase_1.supabase
            .from('marketing_campaigns')
            .insert({
            name,
            message_template: messageTemplate,
            filter_criteria: filterCriteria,
            promotion_id: promotionId || null,
            questionnaire_id: questionnaireId || null,
            promotion_after_completion: promotionAfterCompletion || false,
            scheduled_at: scheduledAtISO,
            total_recipients: contacts.length,
            created_by: createdBy,
            status: campaignStatus
        })
            .select()
            .single();
        if (error)
            throw error;
        return (0, mapper_1.toCamelCase)(data);
    }
    async getCampaigns() {
        const { data, error } = await supabase_1.supabase
            .from('marketing_campaigns')
            .select('*')
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return (0, mapper_1.toCamelCaseArray)(data || []);
    }
}
exports.MarketingService = MarketingService;
exports.default = new MarketingService();
