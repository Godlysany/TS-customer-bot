"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceAvailabilityService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
class ServiceAvailabilityService {
    /**
     * Get all booking windows for a service
     */
    async getBookingWindows(serviceId) {
        const { data, error } = await supabase_1.supabase
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
        return (data?.map(mapper_1.toCamelCase) || []);
    }
    /**
     * Create a booking window for a service
     */
    async createBookingWindow(window) {
        const { data, error } = await supabase_1.supabase
            .from('service_booking_windows')
            .insert((0, mapper_1.toSnakeCase)(window))
            .select()
            .single();
        if (error) {
            console.error('Error creating booking window:', error);
            throw new Error('Failed to create booking window');
        }
        return (0, mapper_1.toCamelCase)(data);
    }
    /**
     * Update a booking window
     */
    async updateBookingWindow(id, updates) {
        const { data, error } = await supabase_1.supabase
            .from('service_booking_windows')
            .update((0, mapper_1.toSnakeCase)(updates))
            .eq('id', id)
            .select()
            .single();
        if (error) {
            console.error('Error updating booking window:', error);
            throw new Error('Failed to update booking window');
        }
        return (0, mapper_1.toCamelCase)(data);
    }
    /**
     * Delete a booking window
     */
    async deleteBookingWindow(id) {
        const { error } = await supabase_1.supabase
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
    async replaceBookingWindows(serviceId, windows) {
        // Validate ALL windows before making any database changes
        for (const window of windows) {
            if (window.dayOfWeek === undefined || window.dayOfWeek === null) {
                throw new Error('All booking windows must have a day of week');
            }
            // Validate dayOfWeek is in valid range (0=Sunday, 6=Saturday)
            if (window.dayOfWeek < 0 || window.dayOfWeek > 6 || !Number.isInteger(window.dayOfWeek)) {
                throw new Error('Day of week must be a number between 0 (Sunday) and 6 (Saturday)');
            }
            if (!window.startTime || window.startTime.trim() === '') {
                throw new Error(`Booking window for ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][window.dayOfWeek]} is missing start time`);
            }
            if (!window.endTime || window.endTime.trim() === '') {
                throw new Error(`Booking window for ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][window.dayOfWeek]} is missing end time`);
            }
            // Validate time format (HH:MM)
            const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!timeRegex.test(window.startTime)) {
                throw new Error(`Invalid start time format for ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][window.dayOfWeek]}: ${window.startTime}. Expected HH:MM format.`);
            }
            if (!timeRegex.test(window.endTime)) {
                throw new Error(`Invalid end time format for ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][window.dayOfWeek]}: ${window.endTime}. Expected HH:MM format.`);
            }
            // Validate start < end
            if (window.startTime >= window.endTime) {
                throw new Error(`Start time must be before end time for ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][window.dayOfWeek]}`);
            }
        }
        // Delete all existing windows for this service
        const { error: deleteError } = await supabase_1.supabase
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
        // Prepare windows for insertion - filter out any undefined/null fields
        const validWindows = windows.map(w => {
            const windowData = {
                service_id: serviceId,
                day_of_week: w.dayOfWeek,
                start_time: w.startTime,
                end_time: w.endTime,
                is_active: w.isActive !== undefined ? w.isActive : true,
            };
            // Only add optional fields if they're defined
            if (w.validFrom)
                windowData.valid_from = w.validFrom;
            if (w.validUntil)
                windowData.valid_until = w.validUntil;
            if (w.notes)
                windowData.notes = w.notes;
            return windowData;
        });
        const { data, error } = await supabase_1.supabase
            .from('service_booking_windows')
            .insert(validWindows)
            .select();
        if (error) {
            console.error('Error creating booking windows:', error);
            throw new Error('Failed to create booking windows');
        }
        return (data?.map(mapper_1.toCamelCase) || []);
    }
    /**
     * Get all blockers for a service
     */
    async getServiceBlockers(serviceId) {
        const { data, error } = await supabase_1.supabase
            .from('service_blockers')
            .select('*')
            .eq('service_id', serviceId)
            .order('start_time', { ascending: true });
        if (error) {
            console.error('Error fetching service blockers:', error);
            throw new Error('Failed to fetch service blockers');
        }
        return (data?.map(mapper_1.toCamelCase) || []);
    }
    /**
     * Create a blocker for a service
     */
    async createServiceBlocker(blocker) {
        const { data, error } = await supabase_1.supabase
            .from('service_blockers')
            .insert((0, mapper_1.toSnakeCase)(blocker))
            .select()
            .single();
        if (error) {
            console.error('Error creating service blocker:', error);
            throw new Error('Failed to create service blocker');
        }
        return (0, mapper_1.toCamelCase)(data);
    }
    /**
     * Update a service blocker
     */
    async updateServiceBlocker(id, updates) {
        const { data, error } = await supabase_1.supabase
            .from('service_blockers')
            .update((0, mapper_1.toSnakeCase)(updates))
            .eq('id', id)
            .select()
            .single();
        if (error) {
            console.error('Error updating service blocker:', error);
            throw new Error('Failed to update service blocker');
        }
        return (0, mapper_1.toCamelCase)(data);
    }
    /**
     * Delete a service blocker
     */
    async deleteServiceBlocker(id) {
        const { error } = await supabase_1.supabase
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
    isDateTimeAllowed(dateTime, windows) {
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
                if (dateTime < validFrom)
                    return false;
            }
            if (window.validUntil) {
                const validUntil = new Date(window.validUntil);
                if (dateTime > validUntil)
                    return false;
            }
            // Check if time falls within window
            return timeStr >= window.startTime && timeStr <= window.endTime;
        });
    }
    /**
     * Check if a datetime conflicts with blockers
     * Returns true if the datetime is BLOCKED
     */
    isDateTimeBlocked(dateTime, blockers) {
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
                if (dateTime > recurrenceEnd)
                    return false; // Past recurrence end
            }
            // Check recurrence pattern
            if (blocker.recurrencePattern === 'weekly') {
                const dayOfWeek = dateTime.getDay();
                const blockerDayOfWeek = startTime.getDay();
                if (dayOfWeek !== blockerDayOfWeek)
                    return false;
                const timeStr = dateTime.toTimeString().slice(0, 5);
                const startTimeStr = startTime.toTimeString().slice(0, 5);
                const endTimeStr = endTime.toTimeString().slice(0, 5);
                return timeStr >= startTimeStr && timeStr <= endTimeStr;
            }
            if (blocker.recurrencePattern === 'monthly') {
                // Check if day-of-month and time match
                const dayOfMonth = dateTime.getDate();
                const blockerDayOfMonth = startTime.getDate();
                if (dayOfMonth !== blockerDayOfMonth)
                    return false;
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
                if (month !== blockerMonth || dayOfMonth !== blockerDayOfMonth)
                    return false;
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
    async validateBookingTime(serviceId, dateTime) {
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
exports.ServiceAvailabilityService = ServiceAvailabilityService;
exports.default = new ServiceAvailabilityService();
