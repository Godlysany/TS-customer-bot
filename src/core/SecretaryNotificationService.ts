import { supabase } from '../infrastructure/supabase';
import { SettingsService } from './SettingsService';
import { EmailService } from './EmailService';
import { toCamelCase } from '../infrastructure/mapper';

export class SecretaryNotificationService {
  private settingsService: SettingsService;
  private emailService: EmailService;

  constructor() {
    this.settingsService = new SettingsService();
    this.emailService = new EmailService();
  }

  async sendDailySummary(): Promise<void> {
    const enabled = await this.settingsService.getSetting('daily_summary_enabled');
    if (enabled !== 'true') return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: newBookings } = await supabase
      .from('bookings')
      .select('*, contacts(name, phone_number)')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
      .neq('status', 'cancelled');

    const { data: cancellations } = await supabase
      .from('bookings')
      .select('*, contacts(name, phone_number)')
      .gte('cancelled_at', today.toISOString())
      .lt('cancelled_at', tomorrow.toISOString())
      .eq('status', 'cancelled');

    const { data: changes } = await supabase
      .from('bookings')
      .select('*, contacts(name, phone_number)')
      .gte('updated_at', today.toISOString())
      .lt('updated_at', tomorrow.toISOString())
      .neq('status', 'cancelled')
      .neq('created_at', 'updated_at');

    const totalPenalties = (cancellations || [])
      .filter((b: any) => b.penalty_applied)
      .reduce((sum: number, b: any) => sum + parseFloat(b.penalty_fee || 0), 0);

    const totalDiscounts = [...(newBookings || []), ...(changes || [])]
      .reduce((sum: number, b: any) => sum + parseFloat(b.discount_amount || 0), 0);

    const summaryData = {
      newBookings: (newBookings || []).map((b: any) => ({
        ...toCamelCase(b),
        contactName: b.contacts?.name || 'Unknown',
      })),
      cancellations: (cancellations || []).map((b: any) => ({
        ...toCamelCase(b),
        contactName: b.contacts?.name || 'Unknown',
      })),
      changes: (changes || []).map((b: any) => ({
        ...toCamelCase(b),
        contactName: b.contacts?.name || 'Unknown',
      })),
      totalPenalties: totalPenalties.toFixed(2),
      totalDiscounts: totalDiscounts.toFixed(2),
    };

    await this.emailService.sendDailySummaryToSecretary(summaryData);
  }

  async notifyBookingCreated(booking: any): Promise<void> {
    const { data: contact } = await supabase
      .from('contacts')
      .select('name')
      .eq('id', booking.contact_id)
      .single();

    await this.emailService.sendSecretaryBookingNotification({
      ...toCamelCase(booking),
      contactName: contact?.name || 'Unknown',
    }, 'new');
  }

  async notifyBookingCancelled(booking: any): Promise<void> {
    const { data: contact } = await supabase
      .from('contacts')
      .select('name')
      .eq('id', booking.contact_id)
      .single();

    await this.emailService.sendSecretaryBookingNotification({
      ...toCamelCase(booking),
      contactName: contact?.name || 'Unknown',
    }, 'cancelled');
  }

  async notifyBookingChanged(booking: any): Promise<void> {
    const { data: contact } = await supabase
      .from('contacts')
      .select('name')
      .eq('id', booking.contact_id)
      .single();

    await this.emailService.sendSecretaryBookingNotification({
      ...toCamelCase(booking),
      contactName: contact?.name || 'Unknown',
    }, 'changed');
  }

  async shouldSendDailySummary(): Promise<boolean> {
    const enabled = await this.settingsService.getSetting('daily_summary_enabled');
    if (enabled !== 'true') return false;

    const summaryTime = await this.settingsService.getSetting('daily_summary_time') || '09:00';
    const timezone = await this.settingsService.getSetting('timezone') || 'Europe/Berlin';
    
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: timezone 
    });

    return currentTime === summaryTime;
  }
}
