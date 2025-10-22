import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';

export interface ServiceBookingWindow {
  id?: string;
  serviceId: string;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  isActive?: boolean;
  validFrom?: string; // Date string
  validUntil?: string; // Date string
  notes?: string;
}

export interface ServiceBlocker {
  id?: string;
  serviceId: string;
  title: string;
  startTime: string; // ISO 8601 timestamp
  endTime: string; // ISO 8601 timestamp
  reason?: string;
  isRecurring?: boolean;
  recurrencePattern?: 'weekly' | 'monthly' | 'yearly';
  recurrenceEndDate?: string; // ISO 8601 timestamp
  createdBy?: string;
}

export class ServiceAvailabilityService {
  /**
   * Get all booking windows for a service
   */
  async getBookingWindows(serviceId: string): Promise<ServiceBookingWindow[]> {
    const { data, error } = await supabase
      .from('service_booking_windows')
      .select('*')
      .eq('service_id', serviceId)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching booking windows:', error);
      throw new Error('Failed to fetch booking windows');
    }

    return (data?.map(toCamelCase) || []) as ServiceBookingWindow[];
  }

  /**
   * Create a booking window for a service
   */
  async createBookingWindow(window: ServiceBookingWindow): Promise<ServiceBookingWindow> {
    const { data, error } = await supabase
      .from('service_booking_windows')
      .insert(toSnakeCase(window))
      .select()
      .single();

    if (error) {
      console.error('Error creating booking window:', error);
      throw new Error('Failed to create booking window');
    }

    return toCamelCase(data) as ServiceBookingWindow;
  }

  /**
   * Update a booking window
   */
  async updateBookingWindow(id: string, updates: Partial<ServiceBookingWindow>): Promise<ServiceBookingWindow> {
    const { data, error } = await supabase
      .from('service_booking_windows')
      .update(toSnakeCase(updates))
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating booking window:', error);
      throw new Error('Failed to update booking window');
    }

    return toCamelCase(data) as ServiceBookingWindow;
  }

  /**
   * Delete a booking window
   */
  async deleteBookingWindow(id: string): Promise<void> {
    const { error } = await supabase
      .from('service_booking_windows')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting booking window:', error);
      throw new Error('Failed to delete booking window');
    }
  }

  /**
   * Bulk replace booking windows for a service
   * Deletes all existing windows and creates new ones
   */
  async replaceBookingWindows(serviceId: string, windows: ServiceBookingWindow[]): Promise<ServiceBookingWindow[]> {
    // Delete all existing windows for this service
    const { error: deleteError } = await supabase
      .from('service_booking_windows')
      .delete()
      .eq('service_id', serviceId);

    if (deleteError) {
      console.error('Error deleting old booking windows:', deleteError);
      throw new Error('Failed to delete old booking windows');
    }

    // Create new windows
    if (windows.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('service_booking_windows')
      .insert(windows.map(w => toSnakeCase({ ...w, serviceId })))
      .select();

    if (error) {
      console.error('Error creating booking windows:', error);
      throw new Error('Failed to create booking windows');
    }

    return (data?.map(toCamelCase) || []) as ServiceBookingWindow[];
  }

  /**
   * Get all blockers for a service
   */
  async getServiceBlockers(serviceId: string): Promise<ServiceBlocker[]> {
    const { data, error } = await supabase
      .from('service_blockers')
      .select('*')
      .eq('service_id', serviceId)
      .order('start_time', { ascending: true});

    if (error) {
      console.error('Error fetching service blockers:', error);
      throw new Error('Failed to fetch service blockers');
    }

    return (data?.map(toCamelCase) || []) as ServiceBlocker[];
  }

  /**
   * Create a blocker for a service
   */
  async createServiceBlocker(blocker: ServiceBlocker): Promise<ServiceBlocker> {
    const { data, error } = await supabase
      .from('service_blockers')
      .insert(toSnakeCase(blocker))
      .select()
      .single();

    if (error) {
      console.error('Error creating service blocker:', error);
      throw new Error('Failed to create service blocker');
    }

    return toCamelCase(data) as ServiceBlocker;
  }

  /**
   * Update a service blocker
   */
  async updateServiceBlocker(id: string, updates: Partial<ServiceBlocker>): Promise<ServiceBlocker> {
    const { data, error } = await supabase
      .from('service_blockers')
      .update(toSnakeCase(updates))
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating service blocker:', error);
      throw new Error('Failed to update service blocker');
    }

    return toCamelCase(data) as ServiceBlocker;
  }

  /**
   * Delete a service blocker
   */
  async deleteServiceBlocker(id: string): Promise<void> {
    const { error } = await supabase
      .from('service_blockers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting service blocker:', error);
      throw new Error('Failed to delete service blocker');
    }
  }

  /**
   * Check if a datetime conflicts with booking windows
   * Returns true if the datetime is WITHIN an allowed window
   */
  isDateTimeAllowed(dateTime: Date, windows: ServiceBookingWindow[]): boolean {
    if (windows.length === 0) {
      return true; // No restrictions = always allowed
    }

    const dayOfWeek = dateTime.getDay(); // 0=Sunday, 6=Saturday
    const timeStr = dateTime.toTimeString().slice(0, 5); // "HH:MM"

    // Check if there's a matching window for this day and time
    return windows.some(window => {
      if (window.dayOfWeek !== dayOfWeek || !window.isActive) {
        return false;
      }

      // Check valid_from / valid_until if present
      if (window.validFrom) {
        const validFrom = new Date(window.validFrom);
        if (dateTime < validFrom) return false;
      }

      if (window.validUntil) {
        const validUntil = new Date(window.validUntil);
        if (dateTime > validUntil) return false;
      }

      // Check if time falls within window
      return timeStr >= window.startTime && timeStr <= window.endTime;
    });
  }

  /**
   * Check if a datetime conflicts with blockers
   * Returns true if the datetime is BLOCKED
   */
  isDateTimeBlocked(dateTime: Date, blockers: ServiceBlocker[]): boolean {
    return blockers.some(blocker => {
      const startTime = new Date(blocker.startTime);
      const endTime = new Date(blocker.endTime);

      // Simple case: non-recurring blocker
      if (!blocker.isRecurring) {
        return dateTime >= startTime && dateTime <= endTime;
      }

      // Recurring blocker logic
      if (blocker.recurrenceEndDate) {
        const recurrenceEnd = new Date(blocker.recurrenceEndDate);
        if (dateTime > recurrenceEnd) return false; // Past recurrence end
      }

      // Check recurrence pattern
      if (blocker.recurrencePattern === 'weekly') {
        const dayOfWeek = dateTime.getDay();
        const blockerDayOfWeek = startTime.getDay();
        if (dayOfWeek !== blockerDayOfWeek) return false;

        const timeStr = dateTime.toTimeString().slice(0, 5);
        const startTimeStr = startTime.toTimeString().slice(0, 5);
        const endTimeStr = endTime.toTimeString().slice(0, 5);
        return timeStr >= startTimeStr && timeStr <= endTimeStr;
      }

      if (blocker.recurrencePattern === 'monthly') {
        // Check if day-of-month and time match
        const dayOfMonth = dateTime.getDate();
        const blockerDayOfMonth = startTime.getDate();
        if (dayOfMonth !== blockerDayOfMonth) return false;

        const timeStr = dateTime.toTimeString().slice(0, 5);
        const startTimeStr = startTime.toTimeString().slice(0, 5);
        const endTimeStr = endTime.toTimeString().slice(0, 5);
        return timeStr >= startTimeStr && timeStr <= endTimeStr;
      }

      if (blocker.recurrencePattern === 'yearly') {
        // Check if month, day, and time match
        const month = dateTime.getMonth();
        const dayOfMonth = dateTime.getDate();
        const blockerMonth = startTime.getMonth();
        const blockerDayOfMonth = startTime.getDate();
        
        if (month !== blockerMonth || dayOfMonth !== blockerDayOfMonth) return false;

        const timeStr = dateTime.toTimeString().slice(0, 5);
        const startTimeStr = startTime.toTimeString().slice(0, 5);
        const endTimeStr = endTime.toTimeString().slice(0, 5);
        return timeStr >= startTimeStr && timeStr <= endTimeStr;
      }

      return false;
    });
  }

  /**
   * Validate a booking time against windows and blockers
   * Returns { allowed: boolean, reason?: string }
   */
  async validateBookingTime(
    serviceId: string,
    dateTime: Date
  ): Promise<{ allowed: boolean; reason?: string }> {
    const windows = await this.getBookingWindows(serviceId);
    const blockers = await this.getServiceBlockers(serviceId);

    // Check if blocked
    if (this.isDateTimeBlocked(dateTime, blockers)) {
      return {
        allowed: false,
        reason: 'This time slot is blocked and unavailable for booking.',
      };
    }

    // Check if within allowed windows
    if (!this.isDateTimeAllowed(dateTime, windows)) {
      return {
        allowed: false,
        reason: 'This service is not available at the requested time. Please check available booking hours.',
      };
    }

    return { allowed: true };
  }
}

export default new ServiceAvailabilityService();
