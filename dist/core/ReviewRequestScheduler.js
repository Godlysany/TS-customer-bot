"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewRequestScheduler = void 0;
const ReviewService_1 = require("./ReviewService");
const whatsapp_1 = require("../adapters/whatsapp");
class ReviewRequestScheduler {
    reviewService;
    intervalId = null;
    constructor() {
        this.reviewService = new ReviewService_1.ReviewService();
    }
    start(intervalMinutes = 60) {
        if (this.intervalId) {
            console.log('⚠️  Review request scheduler is already running');
            return;
        }
        console.log(`⏰ Starting review request scheduler (checking every ${intervalMinutes} minutes)`);
        this.processReviewRequests().catch(err => console.error('Error in initial review request processing:', err));
        this.intervalId = setInterval(async () => {
            try {
                await this.processReviewRequests();
            }
            catch (error) {
                console.error('Error in review request scheduler:', error);
            }
        }, intervalMinutes * 60 * 1000);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('🛑 Review request scheduler stopped');
        }
    }
    async processReviewRequests() {
        console.log('⭐ Processing pending review requests...');
        const results = {
            sent: 0,
            failed: 0,
        };
        try {
            const pendingReviews = await this.reviewService.getPendingReviews();
            if (pendingReviews.length === 0) {
                console.log('⭐ No pending review requests');
                return results;
            }
            console.log(`⭐ Found ${pendingReviews.length} pending review request(s)`);
            for (const review of pendingReviews) {
                try {
                    await this.reviewService.sendReviewRequest(review.bookingId, async (phone, message) => {
                        await (0, whatsapp_1.sendProactiveMessage)(phone, message, review.contactId);
                    });
                    results.sent++;
                    console.log(`⭐ ✅ Sent review request for booking ${review.bookingId}`);
                }
                catch (error) {
                    console.error(`❌ Failed to send review request for booking ${review.bookingId}:`, error.message);
                    results.failed++;
                }
            }
            console.log(`⭐ Review request processing complete: ${results.sent} sent, ${results.failed} failed`);
        }
        catch (error) {
            console.error('❌ Error in review request scheduler:', error);
        }
        return results;
    }
}
exports.ReviewRequestScheduler = ReviewRequestScheduler;
exports.default = new ReviewRequestScheduler();
