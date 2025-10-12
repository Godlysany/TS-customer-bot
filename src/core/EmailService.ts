import { supabase } from '../infrastructure/supabase';
import { SettingsService } from './SettingsService';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  contactId?: string;
  bookingId?: string;
  emailType: 'booking_confirmation' | 'cancellation' | 'reminder' | 'daily_summary' | 'review_request';
}

export class EmailService {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const sendgridKey = await this.settingsService.get('sendgrid_api_key');
      const fromEmail = await this.settingsService.get('sendgrid_from_email');
      const fromName = await this.settingsService.get('sendgrid_from_name');

      if (!sendgridKey || !fromEmail) {
        console.log('SendGrid not configured, skipping email');
        return { success: false, error: 'SendGrid not configured' };
      }

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: options.to }] }],
          from: { email: fromEmail, name: fromName || 'CRM System' },
          subject: options.subject,
          content: [{ type: 'text/html', value: options.html }],
        }),
      });

      const messageId = response.headers.get('x-message-id');

      await this.logEmail({
        contactId: options.contactId,
        bookingId: options.bookingId,
        emailType: options.emailType,
        recipientEmail: options.to,
        subject: options.subject,
        body: options.html,
        status: response.ok ? 'sent' : 'failed',
        sendgridMessageId: messageId || undefined,
        errorMessage: response.ok ? undefined : await response.text(),
        sentAt: response.ok ? new Date() : undefined,
      });

      return {
        success: response.ok,
        messageId: messageId || undefined,
        error: response.ok ? undefined : await response.text(),
      };
    } catch (error: any) {
      console.error('Email send error:', error);
      
      await this.logEmail({
        contactId: options.contactId,
        bookingId: options.bookingId,
        emailType: options.emailType,
        recipientEmail: options.to,
        subject: options.subject,
        body: options.html,
        status: 'failed',
        errorMessage: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  async sendBookingConfirmation(bookingId: string, contactEmail: string, bookingDetails: any): Promise<void> {
    const html = `
      <h2>Appointment Confirmed</h2>
      <p>Dear ${bookingDetails.contactName},</p>
      <p>Your appointment has been confirmed:</p>
      <ul>
        <li><strong>Service:</strong> ${bookingDetails.title}</li>
        <li><strong>Date & Time:</strong> ${new Date(bookingDetails.startTime).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</li>
        ${bookingDetails.discountCode ? `<li><strong>Discount Applied:</strong> ${bookingDetails.discountCode} (-€${bookingDetails.discountAmount})</li>` : ''}
        ${bookingDetails.promoVoucher ? `<li><strong>Promo Voucher:</strong> ${bookingDetails.promoVoucher}</li>` : ''}
      </ul>
      <p>We look forward to seeing you!</p>
      <p style="color: #666; font-size: 12px;">Please arrive 10 minutes early. Cancellations within 24 hours may incur a fee.</p>
    `;

    await this.sendEmail({
      to: contactEmail,
      subject: `Appointment Confirmation - ${new Date(bookingDetails.startTime).toLocaleDateString()}`,
      html,
      bookingId,
      contactId: bookingDetails.contactId,
      emailType: 'booking_confirmation',
    });
  }

  async sendCancellationEmail(bookingId: string, contactEmail: string, cancellationDetails: any): Promise<void> {
    const html = `
      <h2>Appointment Cancelled</h2>
      <p>Dear ${cancellationDetails.contactName},</p>
      <p>Your appointment has been cancelled:</p>
      <ul>
        <li><strong>Service:</strong> ${cancellationDetails.title}</li>
        <li><strong>Date & Time:</strong> ${new Date(cancellationDetails.startTime).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</li>
        ${cancellationDetails.penaltyApplied ? `<li style="color: red;"><strong>Late Cancellation Fee:</strong> €${cancellationDetails.penaltyFee}</li>` : ''}
      </ul>
      ${cancellationDetails.reason ? `<p><strong>Reason:</strong> ${cancellationDetails.reason}</p>` : ''}
      ${cancellationDetails.penaltyApplied ? '<p style="color: #666;">Due to late cancellation (less than 24 hours notice), a cancellation fee has been applied.</p>' : ''}
      <p>We hope to see you again soon!</p>
    `;

    await this.sendEmail({
      to: contactEmail,
      subject: `Appointment Cancelled - ${new Date(cancellationDetails.startTime).toLocaleDateString()}`,
      html,
      bookingId,
      contactId: cancellationDetails.contactId,
      emailType: 'cancellation',
    });
  }

  async sendReminderEmail(bookingId: string, contactEmail: string, reminderDetails: any): Promise<void> {
    const html = `
      <h2>Appointment Reminder</h2>
      <p>Dear ${reminderDetails.contactName},</p>
      <p>This is a friendly reminder about your upcoming appointment:</p>
      <ul>
        <li><strong>Service:</strong> ${reminderDetails.title}</li>
        <li><strong>Date & Time:</strong> ${new Date(reminderDetails.startTime).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</li>
      </ul>
      <p>Please arrive 10 minutes early. If you need to cancel or reschedule, please contact us at least 24 hours in advance.</p>
      <p>We look forward to seeing you!</p>
    `;

    await this.sendEmail({
      to: contactEmail,
      subject: `Appointment Reminder - Tomorrow`,
      html,
      bookingId,
      contactId: reminderDetails.contactId,
      emailType: 'reminder',
    });
  }

  async sendReviewRequest(bookingId: string, contactEmail: string, reviewDetails: any): Promise<void> {
    const html = `
      <h2>How was your visit?</h2>
      <p>Dear ${reviewDetails.contactName},</p>
      <p>Thank you for visiting us! We'd love to hear about your experience.</p>
      <p>Please take a moment to share your feedback:</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${reviewDetails.reviewLink}" style="background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Leave a Review</a>
      </div>
      <p>Your feedback helps us improve our service!</p>
    `;

    await this.sendEmail({
      to: contactEmail,
      subject: 'We'd love your feedback!',
      html,
      bookingId,
      contactId: reviewDetails.contactId,
      emailType: 'review_request',
    });
  }

  async sendDailySummaryToSecretary(summaryData: any): Promise<void> {
    const secretaryEmail = await this.settingsService.get('secretary_email');
    
    if (!secretaryEmail) {
      console.log('Secretary email not configured');
      return;
    }

    const html = `
      <h2>Daily Booking Summary - ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}</h2>
      
      <h3>New Bookings (${summaryData.newBookings.length})</h3>
      ${this.renderBookingTable(summaryData.newBookings)}
      
      <h3>Cancellations (${summaryData.cancellations.length})</h3>
      ${this.renderBookingTable(summaryData.cancellations)}
      
      <h3>Changes (${summaryData.changes.length})</h3>
      ${this.renderBookingTable(summaryData.changes)}
      
      <h3>Summary</h3>
      <ul>
        <li>Total New: ${summaryData.newBookings.length}</li>
        <li>Total Cancelled: ${summaryData.cancellations.length}</li>
        <li>Total Changed: ${summaryData.changes.length}</li>
        <li>Penalty Fees Collected: €${summaryData.totalPenalties}</li>
        <li>Discounts Given: €${summaryData.totalDiscounts}</li>
      </ul>
    `;

    await this.sendEmail({
      to: secretaryEmail,
      subject: `Daily Summary - ${new Date().toLocaleDateString()}`,
      html,
      emailType: 'daily_summary',
    });
  }

  async sendSecretaryBookingNotification(booking: any, type: 'new' | 'cancelled' | 'changed'): Promise<void> {
    const secretaryEmail = await this.settingsService.get('secretary_email');
    
    if (!secretaryEmail) {
      return;
    }

    const actionText = {
      new: 'New Booking',
      cancelled: 'Booking Cancelled',
      changed: 'Booking Changed',
    }[type];

    const html = `
      <h2>${actionText}</h2>
      <p><strong>Patient:</strong> ${booking.contactName}</p>
      <p><strong>Service:</strong> ${booking.title}</p>
      <p><strong>Date & Time:</strong> ${new Date(booking.startTime).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>
      ${booking.discountCode ? `<p><strong>Discount:</strong> ${booking.discountCode} (-€${booking.discountAmount})</p>` : ''}
      ${booking.promoVoucher ? `<p><strong>Promo Voucher:</strong> ${booking.promoVoucher}</p>` : ''}
      ${booking.penaltyApplied ? `<p style="color: red;"><strong>Penalty Fee:</strong> €${booking.penaltyFee}</p>` : ''}
      ${booking.cancellationReason ? `<p><strong>Cancellation Reason:</strong> ${booking.cancellationReason}</p>` : ''}
    `;

    await this.sendEmail({
      to: secretaryEmail,
      subject: `${actionText} - ${booking.contactName}`,
      html,
      bookingId: booking.id,
      emailType: 'daily_summary',
    });
  }

  private renderBookingTable(bookings: any[]): string {
    if (bookings.length === 0) {
      return '<p>No bookings in this category.</p>';
    }

    return `
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <thead>
          <tr style="background: #f0f0f0;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Patient</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Service</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date/Time</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${bookings.map(b => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${b.contactName}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${b.title}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${new Date(b.startTime).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">
                ${b.discountCode ? `Discount: ${b.discountCode}<br>` : ''}
                ${b.promoVoucher ? `Voucher: ${b.promoVoucher}<br>` : ''}
                ${b.penaltyApplied ? `<span style="color: red;">Penalty: €${b.penaltyFee}</span>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  private async logEmail(data: {
    contactId?: string;
    bookingId?: string;
    emailType: string;
    recipientEmail: string;
    subject: string;
    body: string;
    status: 'pending' | 'sent' | 'failed' | 'bounced';
    sendgridMessageId?: string;
    errorMessage?: string;
    sentAt?: Date;
  }): Promise<void> {
    await supabase.from('email_logs').insert({
      contact_id: data.contactId,
      booking_id: data.bookingId,
      email_type: data.emailType,
      recipient_email: data.recipientEmail,
      subject: data.subject,
      body: data.body,
      status: data.status,
      sendgrid_message_id: data.sendgridMessageId,
      error_message: data.errorMessage,
      sent_at: data.sentAt?.toISOString(),
    });
  }
}
