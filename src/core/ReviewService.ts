import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';
import { SettingsService } from './SettingsService';
import { AIService } from './AIService';

interface Review {
  id: string;
  bookingId: string;
  contactId: string;
  rating?: number;
  feedbackText?: string;
  reviewLink?: string;
  reviewSubmitted: boolean;
  reminderSentAt?: Date;
  collectedAt?: Date;
  createdAt: Date;
}

export class ReviewService {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  async scheduleReviewRequest(bookingId: string, contactId: string): Promise<Review> {
    const { data: review, error } = await supabase
      .from('reviews')
      .insert(toSnakeCase({
        bookingId,
        contactId,
        reviewSubmitted: false,
      }))
      .select()
      .single();

    if (error) throw new Error(`Failed to schedule review: ${error.message}`);
    return toCamelCase(review) as Review;
  }

  async sendReviewRequest(
    bookingId: string,
    sendMessage: (phone: string, message: string) => Promise<void>
  ): Promise<void> {
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, contacts(name, phone_number)')
      .eq('id', bookingId)
      .single();

    if (!booking) return;

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
    const aiService = new AIService();
    const personalizedMessage = await aiService.personalizeMessage({
      templateMessage,
      contactId: booking.contact_id,
      contactName: contact.name,
      conversationContext: `Customer completed appointment: ${booking.title}. Requesting Google review`,
      messageType: 'review_request',
    });

    await sendMessage(contact.phone_number, personalizedMessage);

    await supabase
      .from('reviews')
      .update(toSnakeCase({
        reminderSentAt: new Date(),
        reviewLink,
      }))
      .eq('booking_id', bookingId);
  }

  async recordReviewFeedback(data: {
    bookingId: string;
    rating?: number;
    feedbackText?: string;
  }): Promise<void> {
    await supabase
      .from('reviews')
      .update(toSnakeCase({
        rating: data.rating,
        feedbackText: data.feedbackText,
        collectedAt: new Date(),
      }))
      .eq('booking_id', data.bookingId);
  }

  async markReviewSubmitted(bookingId: string, reviewLink?: string): Promise<void> {
    await supabase
      .from('reviews')
      .update(toSnakeCase({
        reviewSubmitted: true,
        reviewLink,
        collectedAt: new Date(),
      }))
      .eq('booking_id', bookingId);
  }

  async getPendingReviews(): Promise<Review[]> {
    const reviewDelayHours = parseInt(await this.settingsService.getSetting('review_request_delay_hours') || '24');
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - reviewDelayHours);

    const { data, error } = await supabase
      .from('reviews')
      .select('*, bookings(start_time, title), contacts(name, phone_number)')
      .eq('review_submitted', false)
      .is('reminder_sent_at', null)
      .lte('created_at', cutoffTime.toISOString());

    if (error) throw new Error(`Failed to get pending reviews: ${error.message}`);
    return (data || []).map(toCamelCase) as Review[];
  }

  async getReviewStats(startDate?: Date, endDate?: Date): Promise<any> {
    let query = supabase
      .from('reviews')
      .select('rating, review_submitted, collected_at');

    if (startDate) {
      query = query.gte('collected_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('collected_at', endDate.toISOString());
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get review stats: ${error.message}`);

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
