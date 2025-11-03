"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../infrastructure/supabase");
const auth_1 = require("../middleware/auth");
const uuid_validator_1 = require("../utils/uuid-validator");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// Get all active recurring reminders with customer and service details
router.get('/', async (req, res) => {
    try {
        const { data: reminders, error } = await supabase_1.supabase
            .from('customer_recurring_reminders')
            .select(`
        *,
        contact:contacts(id, name, phone_number, email),
        service:services(id, name, recurring_interval_days, recurring_reminder_days_before, recurring_reminder_message),
        last_booking:bookings(id, start_time, status)
      `)
            .eq('is_active', true)
            .order('next_reminder_due_at', { ascending: true, nullsFirst: false });
        if (error)
            throw error;
        // Format response with effective values (custom or service default)
        const formattedReminders = (reminders || []).map((reminder) => ({
            id: reminder.id,
            contact_id: reminder.contact_id,
            service_id: reminder.service_id,
            contact: reminder.contact,
            service: reminder.service,
            last_booking: reminder.last_booking,
            // Effective configuration (custom overrides or service defaults)
            effective_interval_days: reminder.custom_interval_days ?? reminder.service?.recurring_interval_days,
            effective_reminder_days_before: reminder.custom_reminder_days_before ?? reminder.service?.recurring_reminder_days_before,
            effective_message: reminder.custom_message ?? reminder.service?.recurring_reminder_message,
            // Customer-specific customizations
            has_custom_interval: reminder.custom_interval_days !== null,
            has_custom_reminder_days: reminder.custom_reminder_days_before !== null,
            has_custom_message: reminder.custom_message !== null,
            custom_interval_days: reminder.custom_interval_days,
            custom_reminder_days_before: reminder.custom_reminder_days_before,
            custom_message: reminder.custom_message,
            // Scheduling metadata
            is_active: reminder.is_active,
            last_reminder_sent_at: reminder.last_reminder_sent_at,
            next_reminder_due_at: reminder.next_reminder_due_at,
            last_completed_booking_at: reminder.last_completed_booking_at,
            total_reminders_sent: reminder.total_reminders_sent,
            total_bookings_completed: reminder.total_bookings_completed,
            created_at: reminder.created_at,
            updated_at: reminder.updated_at
        }));
        res.json(formattedReminders);
    }
    catch (error) {
        console.error('Error fetching recurring reminders:', error);
        res.status(500).json({ error: 'Failed to fetch recurring reminders' });
    }
});
// Get recurring reminder by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid reminder ID format' });
        }
        const { data: reminder, error } = await supabase_1.supabase
            .from('customer_recurring_reminders')
            .select(`
        *,
        contact:contacts(id, name, phone_number, email),
        service:services(id, name, recurring_interval_days, recurring_reminder_days_before, recurring_reminder_message)
      `)
            .eq('id', id)
            .single();
        if (error)
            throw error;
        res.json(reminder);
    }
    catch (error) {
        console.error('Error fetching recurring reminder:', error);
        res.status(500).json({ error: 'Failed to fetch recurring reminder' });
    }
});
// Update customer-specific recurring reminder configuration
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active, custom_interval_days, custom_reminder_days_before, custom_message } = req.body;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid reminder ID format' });
        }
        const updateData = {};
        if (is_active !== undefined)
            updateData.is_active = is_active;
        if (custom_interval_days !== undefined)
            updateData.custom_interval_days = custom_interval_days;
        if (custom_reminder_days_before !== undefined)
            updateData.custom_reminder_days_before = custom_reminder_days_before;
        if (custom_message !== undefined)
            updateData.custom_message = custom_message;
        // If custom interval changed, recalculate next reminder due date
        if (custom_interval_days !== undefined) {
            const { data: reminder } = await supabase_1.supabase
                .from('customer_recurring_reminders')
                .select('last_completed_booking_at')
                .eq('id', id)
                .single();
            if (reminder?.last_completed_booking_at) {
                const lastBookingDate = new Date(reminder.last_completed_booking_at);
                const nextDueDate = new Date(lastBookingDate);
                nextDueDate.setDate(nextDueDate.getDate() + custom_interval_days);
                updateData.next_reminder_due_at = nextDueDate.toISOString();
            }
        }
        const { data, error } = await supabase_1.supabase
            .from('customer_recurring_reminders')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        res.json(data);
    }
    catch (error) {
        console.error('Error updating recurring reminder:', error);
        res.status(500).json({ error: 'Failed to update recurring reminder' });
    }
});
// Get booking history for a specific customer-service recurring reminder
router.get('/:id/history', async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid reminder ID format' });
        }
        // Get the reminder to find contact_id and service_id
        const { data: reminder, error: reminderError } = await supabase_1.supabase
            .from('customer_recurring_reminders')
            .select('contact_id, service_id')
            .eq('id', id)
            .single();
        if (reminderError)
            throw reminderError;
        // Get all completed bookings for this customer-service combination
        const { data: bookings, error: bookingsError } = await supabase_1.supabase
            .from('bookings')
            .select('id, scheduled_time, start_time, end_time, status, cost, notes, created_at')
            .eq('contact_id', reminder.contact_id)
            .eq('service_id', reminder.service_id)
            .in('status', ['completed', 'confirmed'])
            .order('scheduled_time', { ascending: false });
        if (bookingsError)
            throw bookingsError;
        res.json({ history: bookings || [] });
    }
    catch (error) {
        console.error('Error fetching reminder history:', error);
        res.status(500).json({ error: 'Failed to fetch reminder history' });
    }
});
exports.default = router;
