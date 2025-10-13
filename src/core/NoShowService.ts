import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';
import { sendProactiveMessage } from '../adapters/whatsapp';
import { EmailService } from './EmailService';
import { SettingsService } from './SettingsService';

export interface NoShowTracking {
  id: string;
  contactId: string;
  bookingId: string;
  noShowDate: string;
  penaltyApplied: boolean;
  penaltyFee: number;
  followUpSent: boolean;
  followUpSentAt?: string;
  strikeCount: number;
  suspensionUntil?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export class NoShowService {
  private emailService: EmailService;
  private settingsService: SettingsService;

  constructor() {
    this.emailService = new EmailService();
    this.settingsService = new SettingsService();
  }

  async markAsNoShow(
    bookingId: string,
    notes?: string
  ): Promise<{ tracking: NoShowTracking; suspended: boolean }> {
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, contacts(id, name, email, phone_number)')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      throw new Error('Booking not found');
    }

    const contact = booking.contacts as any;
    const penaltyEnabled = (await this.settingsService.getSetting('no_show_penalty_enabled')) === 'true';
    const penaltyType = await this.settingsService.getSetting('no_show_penalty_type') || 'fixed';
    const penaltyAmount = parseFloat(await this.settingsService.getSetting('no_show_penalty_amount') || '75');

    let penaltyFee = 0;
    if (penaltyEnabled) {
      penaltyFee = penaltyType === 'percentage' 
        ? (booking.total_cost || 0) * (penaltyAmount / 100)
        : penaltyAmount;
    }

    await supabase
      .from('bookings')
      .update({
        status: 'no_show',
        penalty_applied: penaltyEnabled,
        penalty_fee: penaltyFee,
      })
      .eq('id', bookingId);

    const totalStrikes = await this.getContactStrikeCount(contact.id);
    const strikeLimit = parseInt(await this.settingsService.getSetting('no_show_strike_limit') || '3');
    const suspensionDays = parseInt(await this.settingsService.getSetting('no_show_suspension_days') || '30');

    const newStrikeCount = totalStrikes + 1;
    const isSuspended = newStrikeCount >= strikeLimit;
    
    let suspensionUntil: Date | undefined;
    if (isSuspended) {
      suspensionUntil = new Date();
      suspensionUntil.setDate(suspensionUntil.getDate() + suspensionDays);
    }

    const { data: tracking, error } = await supabase
      .from('no_show_tracking')
      .insert(toSnakeCase({
        contactId: contact.id,
        bookingId,
        noShowDate: new Date(),
        penaltyApplied: penaltyEnabled,
        penaltyFee,
        strikeCount: newStrikeCount,
        suspensionUntil,
        notes,
      }))
      .select()
      .single();

    if (error) throw error;

    const followUpEnabled = (await this.settingsService.getSetting('no_show_follow_up_enabled')) === 'true';
    if (followUpEnabled) {
      await this.sendFollowUp(bookingId, contact, penaltyFee, isSuspended, suspensionUntil);
    }

    return {
      tracking: toCamelCase(tracking) as NoShowTracking,
      suspended: isSuspended,
    };
  }

  async getContactStrikeCount(contactId: string): Promise<number> {
    const { data, error } = await supabase
      .from('no_show_tracking')
      .select('strike_count')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return 0;
    return data[0].strike_count || 0;
  }

  async isContactSuspended(contactId: string): Promise<{ suspended: boolean; until?: Date }> {
    const { data } = await supabase
      .from('no_show_tracking')
      .select('suspension_until')
      .eq('contact_id', contactId)
      .not('suspension_until', 'is', null)
      .gte('suspension_until', new Date().toISOString())
      .order('suspension_until', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) {
      return { suspended: false };
    }

    return {
      suspended: true,
      until: new Date(data[0].suspension_until),
    };
  }

  async getNoShowHistory(contactId: string): Promise<NoShowTracking[]> {
    const { data, error } = await supabase
      .from('no_show_tracking')
      .select('*')
      .eq('contact_id', contactId)
      .order('no_show_date', { ascending: false });

    if (error) throw error;
    return data ? data.map(d => toCamelCase(d) as NoShowTracking) : [];
  }

  async processAutoDetection(): Promise<{ detected: number; failed: number }> {
    const detectionHours = parseInt(await this.settingsService.getSetting('no_show_detection_hours') || '2');
    
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - detectionHours);

    const { data: potentialNoShows } = await supabase
      .from('bookings')
      .select('id, start_time, contact_id')
      .eq('status', 'confirmed')
      .lt('start_time', cutoffTime.toISOString());

    if (!potentialNoShows || potentialNoShows.length === 0) {
      return { detected: 0, failed: 0 };
    }

    let detected = 0;
    let failed = 0;

    for (const booking of potentialNoShows) {
      try {
        await this.markAsNoShow(booking.id, 'Auto-detected no-show');
        detected++;
      } catch (error) {
        console.error(`Failed to mark booking ${booking.id} as no-show:`, error);
        failed++;
      }
    }

    return { detected, failed };
  }

  private async sendFollowUp(
    bookingId: string,
    contact: any,
    penaltyFee: number,
    isSuspended: boolean,
    suspensionUntil?: Date
  ): Promise<void> {
    const { data: booking } = await supabase
      .from('bookings')
      .select('title, start_time')
      .eq('id', bookingId)
      .single();

    if (!booking) return;

    let message = `We noticed you missed your appointment: *${booking.title}* scheduled for ${new Date(booking.start_time).toLocaleString()}.\n\n`;

    if (penaltyFee > 0) {
      message += `⚠️ A no-show penalty of $${penaltyFee.toFixed(2)} has been applied to your account.\n\n`;
    }

    if (isSuspended && suspensionUntil) {
      message += `Due to multiple missed appointments, your booking privileges have been temporarily suspended until ${suspensionUntil.toLocaleDateString()}.\n\n`;
      message += `Please contact us if you have any questions or need to discuss this matter.`;
    } else {
      message += `We'd love to reschedule your appointment. Please let us know when works best for you!\n\n`;
      message += `Reply to this message or contact us to rebook.`;
    }

    if (contact.phone_number) {
      try {
        await sendProactiveMessage(contact.phone_number, contact.id, message);
        await supabase
          .from('no_show_tracking')
          .update({
            follow_up_sent: true,
            follow_up_sent_at: new Date().toISOString(),
          })
          .eq('booking_id', bookingId);
      } catch (error) {
        console.error('Failed to send WhatsApp follow-up:', error);
      }
    }

    if (contact.email) {
      const subject = isSuspended 
        ? 'Booking Privileges Temporarily Suspended'
        : 'We Missed You - Let\'s Reschedule';

      let html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${contact.name || 'there'},</h2>
          <p>We noticed you missed your appointment:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>${booking.title}</strong><br>
            ${new Date(booking.start_time).toLocaleString()}
          </div>
      `;

      if (penaltyFee > 0) {
        html += `<p style="color: #EF4444;"><strong>⚠️ No-Show Penalty:</strong> A fee of $${penaltyFee.toFixed(2)} has been applied to your account.</p>`;
      }

      if (isSuspended && suspensionUntil) {
        html += `
          <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0;">
            <strong>Booking Suspension Notice</strong><br>
            Due to multiple missed appointments, your booking privileges have been temporarily suspended until ${suspensionUntil.toLocaleDateString()}.
          </div>
          <p>Please contact us if you have any questions or need to discuss this matter.</p>
        `;
      } else {
        html += `
          <p>We'd love to reschedule your appointment. Please contact us to find a time that works better for you!</p>
          <p><a href="mailto:${process.env.SECRETARY_EMAIL || 'support@yourcompany.com'}" style="display: inline-block; background: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Contact Us to Rebook</a></p>
        `;
      }

      html += `
          <p>Best regards,<br>Your Service Team</p>
        </div>
      `;

      try {
        await this.emailService.sendEmail({
          to: contact.email,
          subject,
          html,
          emailType: 'reminder',
        });
      } catch (error) {
        console.error('Failed to send email follow-up:', error);
      }
    }
  }

  async liftSuspension(contactId: string): Promise<void> {
    await supabase
      .from('no_show_tracking')
      .update({ suspension_until: null })
      .eq('contact_id', contactId)
      .not('suspension_until', 'is', null);
  }

  async resetStrikes(contactId: string): Promise<void> {
    const { data: latestTracking } = await supabase
      .from('no_show_tracking')
      .select('id')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (latestTracking && latestTracking.length > 0) {
      await supabase
        .from('no_show_tracking')
        .update({ strike_count: 0, suspension_until: null })
        .eq('id', latestTracking[0].id);
    }
  }
}

export default new NoShowService();
