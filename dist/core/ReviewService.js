"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
const SettingsService_1 = require("./SettingsService");
const AIService_1 = require("./AIService");
class ReviewService {
    settingsService;
    constructor() {
        this.settingsService = new SettingsService_1.SettingsService();
    }
    async scheduleReviewRequest(bookingId, contactId) {
        const { data: review, error } = await supabase_1.supabase
            .from('reviews')
            .insert((0, mapper_1.toSnakeCase)({
            bookingId,
            contactId,
            reviewSubmitted: false,
        }))
            .select()
            .single();
        if (error)
            throw new Error(`Failed to schedule review: ${error.message}`);
        return (0, mapper_1.toCamelCase)(review);
    }
    async sendReviewRequest(bookingId, sendMessage) {
        const { data: booking } = await supabase_1.supabase
            .from('bookings')
            .select('*, contacts(name, phone_number)')
            .eq('id', bookingId)
            .single();
        if (!booking)
            return;
        const reviewDelayHours = parseInt(await this.settingsService.getSetting('review_request_delay_hours') || '24');
        const appointmentTime = new Date(booking.start_time);
        const now = new Date();
        const hoursSinceAppointment = (now.getTime() - appointmentTime.getTime()) / (1000 * 60 * 60);
        if (hoursSinceAppointment < reviewDelayHours) {
            return;
        }
        const contact = booking.contacts;
        const reviewLink = `https://g.page/r/YOUR_GOOGLE_REVIEW_LINK`;
        // Build template message
        const templateMessage = `Hi ${contact.name || 'there'}! 😊 Thank you for visiting us. We'd love to hear about your experience! Could you take a moment to leave us a review? ${reviewLink}`;
        // Personalize through GPT for natural, language-appropriate delivery
        const aiService = new AIService_1.AIService();
        const personalizedMessage = await aiService.personalizeMessage({
            templateMessage,
            contactId: booking.contact_id,
            contactName: contact.name,
            conversationContext: `Customer completed appointment: ${booking.title}. Requesting Google review`,
            messageType: 'review_request',
        });
        await sendMessage(contact.phone_number, personalizedMessage);
        await supabase_1.supabase
            .from('reviews')
            .update((0, mapper_1.toSnakeCase)({
            reminderSentAt: new Date(),
            reviewLink,
        }))
            .eq('booking_id', bookingId);
    }
    async recordReviewFeedback(data) {
        await supabase_1.supabase
            .from('reviews')
            .update((0, mapper_1.toSnakeCase)({
            rating: data.rating,
            feedbackText: data.feedbackText,
            collectedAt: new Date(),
        }))
            .eq('booking_id', data.bookingId);
    }
    async markReviewSubmitted(bookingId, reviewLink) {
        await supabase_1.supabase
            .from('reviews')
            .update((0, mapper_1.toSnakeCase)({
            reviewSubmitted: true,
            reviewLink,
            collectedAt: new Date(),
        }))
            .eq('booking_id', bookingId);
    }
    async getPendingReviews() {
        const reviewDelayHours = parseInt(await this.settingsService.getSetting('review_request_delay_hours') || '24');
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffTime.getHours() - reviewDelayHours);
        const { data, error } = await supabase_1.supabase
            .from('reviews')
            .select('*, bookings(start_time, title), contacts(name, phone_number)')
            .eq('review_submitted', false)
            .is('reminder_sent_at', null)
            .lte('created_at', cutoffTime.toISOString());
        if (error)
            throw new Error(`Failed to get pending reviews: ${error.message}`);
        return (data || []).map(mapper_1.toCamelCase);
    }
    async getReviewStats(startDate, endDate) {
        let query = supabase_1.supabase
            .from('reviews')
            .select('rating, review_submitted, collected_at');
        if (startDate) {
            query = query.gte('collected_at', startDate.toISOString());
        }
        if (endDate) {
            query = query.lte('collected_at', endDate.toISOString());
        }
        const { data, error } = await query;
        if (error)
            throw new Error(`Failed to get review stats: ${error.message}`);
        const reviews = data || [];
        const submitted = reviews.filter(r => r.review_submitted).length;
        const avgRating = reviews
            .filter(r => r.rating)
            .reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.filter(r => r.rating).length || 0;
        return {
            total: reviews.length,
            submitted,
            submissionRate: reviews.length > 0 ? (submitted / reviews.length) * 100 : 0,
            averageRating: avgRating.toFixed(1),
            ratings: {
                5: reviews.filter(r => r.rating === 5).length,
                4: reviews.filter(r => r.rating === 4).length,
                3: reviews.filter(r => r.rating === 3).length,
                2: reviews.filter(r => r.rating === 2).length,
                1: reviews.filter(r => r.rating === 1).length,
            },
        };
    }
}
exports.ReviewService = ReviewService;
