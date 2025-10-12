import { supabase } from '../infrastructure/supabase';
import { Booking, CalendarProvider, CalendarEvent } from '../types';
import { toCamelCase } from '../infrastructure/mapper';

export class BookingService {
  private calendarProvider: CalendarProvider | null = null;

  setCalendarProvider(provider: CalendarProvider) {
    this.calendarProvider = provider;
  }

  async createBooking(contactId: string, conversationId: string, event: CalendarEvent): Promise<Booking> {
    if (!this.calendarProvider) {
      throw new Error('Calendar provider not initialized');
    }

    const calendarEventId = await this.calendarProvider.createEvent(event);

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        contact_id: contactId,
        conversation_id: conversationId,
        calendar_event_id: calendarEventId,
        title: event.title,
        start_time: event.startTime.toISOString(),
        end_time: event.endTime.toISOString(),
        status: 'confirmed',
      })
      .select()
      .single();

    if (error) throw error;
    return toCamelCase(data) as Booking;
  }

  async updateBooking(bookingId: string, updates: Partial<CalendarEvent>): Promise<void> {
    const { data: bookingData } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (!bookingData) throw new Error('Booking not found');

    const booking = toCamelCase(bookingData);

    if (this.calendarProvider) {
      await this.calendarProvider.updateEvent(booking.calendarEventId, updates);
    }

    const updateData: any = {};
    if (updates.title) updateData.title = updates.title;
    if (updates.startTime) updateData.start_time = updates.startTime.toISOString();
    if (updates.endTime) updateData.end_time = updates.endTime.toISOString();

    const { error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (error) throw error;
  }

  async cancelBooking(bookingId: string): Promise<void> {
    const { data: bookingData } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (!bookingData) throw new Error('Booking not found');

    const booking = toCamelCase(bookingData);

    if (this.calendarProvider) {
      await this.calendarProvider.deleteEvent(booking.calendarEventId);
    }

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);

    if (error) throw error;
  }

  async getAvailability(startDate: Date, endDate: Date) {
    if (!this.calendarProvider) {
      throw new Error('Calendar provider not initialized');
    }

    return this.calendarProvider.getAvailability(startDate, endDate);
  }
}

export default new BookingService();
