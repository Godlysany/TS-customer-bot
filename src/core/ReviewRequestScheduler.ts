import { ReviewService } from './ReviewService';
import { sendProactiveMessage } from '../adapters/whatsapp';

export class ReviewRequestScheduler {
  private reviewService: ReviewService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.reviewService = new ReviewService();
  }

  start(intervalMinutes: number = 60): void {
    if (this.intervalId) {
      console.log('⚠️  Review request scheduler is already running');
      return;
    }

    console.log(`⏰ Starting review request scheduler (checking every ${intervalMinutes} minutes)`);
    
    this.processReviewRequests().catch(err => 
      console.error('Error in initial review request processing:', err)
    );

    this.intervalId = setInterval(async () => {
      try {
        await this.processReviewRequests();
      } catch (error) {
        console.error('Error in review request scheduler:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Review request scheduler stopped');
    }
  }

  private async processReviewRequests(): Promise<{ sent: number; failed: number }> {
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
          await this.reviewService.sendReviewRequest(
            review.bookingId,
            async (phone: string, message: string) => {
              await sendProactiveMessage(phone, message, review.contactId);
            }
          );
          results.sent++;
          console.log(`⭐ ✅ Sent review request for booking ${review.bookingId}`);
        } catch (error: any) {
          console.error(`❌ Failed to send review request for booking ${review.bookingId}:`, error.message);
          results.failed++;
        }
      }

      console.log(`⭐ Review request processing complete: ${results.sent} sent, ${results.failed} failed`);
    } catch (error: any) {
      console.error('❌ Error in review request scheduler:', error);
    }

    return results;
  }
}

export default new ReviewRequestScheduler();
