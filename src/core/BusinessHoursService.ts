import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';

export interface BusinessOpeningHours {
  id: string;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  isClosed: boolean;
  openTime: string | null; // HH:MM format
  closeTime: string | null; // HH:MM format
  breakStart: string | null; // HH:MM format (optional)
  breakEnd: string | null; // HH:MM format (optional)
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBusinessHoursInput {
  dayOfWeek: number;
  isClosed: boolean;
  openTime?: string;
  closeTime?: string;
  breakStart?: string;
  breakEnd?: string;
  notes?: string;
}

export interface UpdateBusinessHoursInput {
  isClosed?: boolean;
  openTime?: string;
  closeTime?: string;
  breakStart?: string;
  breakEnd?: string;
  notes?: string;
}

export class BusinessHoursService {
  /**
   * Get all business opening hours (entire week schedule)
   */
  async getAll(): Promise<BusinessOpeningHours[]> {
    const { data, error } = await supabase
      .from('business_opening_hours')
      .select('*')
      .order('day_of_week', { ascending: true });

    if (error) {
      console.error('Failed to fetch business hours:', error);
      throw new Error(`Failed to fetch business hours: ${error.message}`);
    }

    return (data || []).map(toCamelCase) as BusinessOpeningHours[];
  }

  /**
   * Get business hours for a specific day
   */
  async getByDay(dayOfWeek: number): Promise<BusinessOpeningHours | null> {
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
    }

    const { data, error } = await supabase
      .from('business_opening_hours')
      .select('*')
      .eq('day_of_week', dayOfWeek)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch business hours for day:', error);
      throw new Error(`Failed to fetch business hours: ${error.message}`);
    }

    return data ? (toCamelCase(data) as BusinessOpeningHours) : null;
  }

  /**
   * Create or update business hours for a specific day
   */
  async upsert(input: CreateBusinessHoursInput): Promise<BusinessOpeningHours> {
    // Validate day of week
    if (input.dayOfWeek < 0 || input.dayOfWeek > 6) {
      throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
    }

    // Validate times if not closed
    if (!input.isClosed) {
      if (!input.openTime || !input.closeTime) {
        throw new Error('Open time and close time are required when not closed');
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(input.openTime)) {
        throw new Error('Invalid open time format. Expected HH:MM (24-hour)');
      }
      if (!timeRegex.test(input.closeTime)) {
        throw new Error('Invalid close time format. Expected HH:MM (24-hour)');
      }

      // Validate open < close
      if (input.openTime >= input.closeTime) {
        throw new Error('Open time must be before close time');
      }

      // Validate break times if provided
      if (input.breakStart || input.breakEnd) {
        if (!input.breakStart || !input.breakEnd) {
          throw new Error('Both break start and break end must be provided');
        }
        if (!timeRegex.test(input.breakStart) || !timeRegex.test(input.breakEnd)) {
          throw new Error('Invalid break time format. Expected HH:MM (24-hour)');
        }
        if (input.breakStart >= input.breakEnd) {
          throw new Error('Break start must be before break end');
        }
        if (input.breakStart < input.openTime || input.breakEnd > input.closeTime) {
          throw new Error('Break times must fall within business hours');
        }
      }
    }

    // Prepare data for upsert
    const hoursData: any = {
      day_of_week: input.dayOfWeek,
      is_closed: input.isClosed,
      open_time: input.isClosed ? null : input.openTime,
      close_time: input.isClosed ? null : input.closeTime,
      break_start: input.breakStart || null,
      break_end: input.breakEnd || null,
      notes: input.notes || null,
    };

    const { data, error } = await supabase
      .from('business_opening_hours')
      .upsert(hoursData, { onConflict: 'day_of_week' })
      .select()
      .single();

    if (error) {
      console.error('Failed to upsert business hours:', error);
      throw new Error(`Failed to save business hours: ${error.message}`);
    }

    console.log(`✅ Business hours updated for day ${input.dayOfWeek}`);
    return toCamelCase(data) as BusinessOpeningHours;
  }

  /**
   * Update business hours for a specific day
   */
  async update(dayOfWeek: number, input: UpdateBusinessHoursInput): Promise<BusinessOpeningHours> {
    const existing = await this.getByDay(dayOfWeek);
    if (!existing) {
      throw new Error(`Business hours not found for day ${dayOfWeek}`);
    }

    // Merge with existing data
    const mergedInput: CreateBusinessHoursInput = {
      dayOfWeek,
      isClosed: input.isClosed ?? existing.isClosed,
      openTime: input.openTime ?? existing.openTime ?? undefined,
      closeTime: input.closeTime ?? existing.closeTime ?? undefined,
      breakStart: input.breakStart ?? existing.breakStart ?? undefined,
      breakEnd: input.breakEnd ?? existing.breakEnd ?? undefined,
      notes: input.notes ?? existing.notes ?? undefined,
    };

    return this.upsert(mergedInput);
  }

  /**
   * Check if business is open at a specific date/time
   */
  async isOpen(dateTime: Date): Promise<boolean> {
    const dayOfWeek = dateTime.getDay();
    const hours = await this.getByDay(dayOfWeek);

    if (!hours || hours.isClosed) {
      return false;
    }

    const timeStr = `${String(dateTime.getHours()).padStart(2, '0')}:${String(dateTime.getMinutes()).padStart(2, '0')}`;

    // Check if within business hours
    if (!hours.openTime || !hours.closeTime) {
      return false;
    }

    if (timeStr < hours.openTime || timeStr >= hours.closeTime) {
      return false;
    }

    // Check if within break period
    if (hours.breakStart && hours.breakEnd) {
      if (timeStr >= hours.breakStart && timeStr < hours.breakEnd) {
        return false; // Business is on break
      }
    }

    return true;
  }

  /**
   * Get available time windows for a specific day (excluding breaks)
   */
  async getAvailableWindows(dayOfWeek: number): Promise<Array<{ start: string; end: string }>> {
    const hours = await this.getByDay(dayOfWeek);

    if (!hours || hours.isClosed || !hours.openTime || !hours.closeTime) {
      return [];
    }

    // If no break, return single window
    if (!hours.breakStart || !hours.breakEnd) {
      return [{ start: hours.openTime, end: hours.closeTime }];
    }

    // Split into two windows around break
    return [
      { start: hours.openTime, end: hours.breakStart },
      { start: hours.breakEnd, end: hours.closeTime },
    ];
  }
}

export default new BusinessHoursService();
