"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../infrastructure/supabase");
const auth_1 = require("../middleware/auth");
const uuid_validator_1 = require("../utils/uuid-validator");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', async (req, res) => {
    try {
        const { data: contacts, error } = await supabase_1.supabase
            .from('contacts')
            .select(`
        *,
        analytics:customer_analytics(*),
        conversations:conversations(count),
        bookings:bookings(count)
      `)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        const formattedContacts = contacts?.map((contact) => ({
            ...contact,
            analytics: contact.analytics?.[0] || null,
            conversation_count: contact.conversations?.[0]?.count || 0,
            booking_count: contact.bookings?.[0]?.count || 0,
        }));
        res.json(formattedContacts || []);
    }
    catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Validate UUID format
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid customer ID format' });
        }
        const { data: contact, error: contactError } = await supabase_1.supabase
            .from('contacts')
            .select(`
        *,
        analytics:customer_analytics(*)
      `)
            .eq('id', id)
            .single();
        if (contactError)
            throw contactError;
        const { data: conversations, error: convError } = await supabase_1.supabase
            .from('conversations')
            .select('id')
            .eq('contact_id', id);
        if (convError)
            throw convError;
        const { data: bookings, error: bookError } = await supabase_1.supabase
            .from('bookings')
            .select('id')
            .eq('contact_id', id);
        if (bookError)
            throw bookError;
        const formattedContact = {
            ...contact,
            analytics: contact.analytics?.[0] || null,
            conversation_count: conversations?.length || 0,
            booking_count: bookings?.length || 0,
        };
        res.json(formattedContact);
    }
    catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});
router.get('/:id/questionnaires', async (req, res) => {
    try {
        const { id } = req.params;
        // Validate UUID format
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid customer ID format' });
        }
        const { data: responses, error } = await supabase_1.supabase
            .from('questionnaire_responses')
            .select(`
        *,
        questionnaire:questionnaires(name, trigger_type)
      `)
            .eq('contact_id', id)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        const formattedResponses = responses?.map((r) => ({
            ...r,
            questionnaire_name: r.questionnaire?.name,
            questionnaire_type: r.questionnaire?.trigger_type,
        }));
        res.json(formattedResponses || []);
    }
    catch (error) {
        console.error('Error fetching customer questionnaires:', error);
        res.status(500).json({ error: 'Failed to fetch customer questionnaires' });
    }
});
router.get('/:id/analytics', async (req, res) => {
    try {
        const { id } = req.params;
        // Validate UUID format
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid customer ID format' });
        }
        // Get customer analytics data
        const { data: analytics, error: analyticsError } = await supabase_1.supabase
            .from('customer_analytics')
            .select('*')
            .eq('contact_id', id)
            .single();
        // Get conversation count
        const { count: conversationCount } = await supabase_1.supabase
            .from('conversations')
            .select('*', { count: 'exact', head: true })
            .eq('contact_id', id);
        // Get booking count
        const { count: bookingCount } = await supabase_1.supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('contact_id', id);
        // Format response - map DB columns to API response
        const sentimentScore = analytics?.sentiment_score || 0;
        const sentiment = sentimentScore > 0.3 ? 'positive' : sentimentScore < -0.3 ? 'negative' : 'neutral';
        const response = {
            sentiment,
            upsellPotential: analytics?.upsell_potential || 'low',
            lastEngagementScore: analytics?.sentiment_score || 0,
            keywords: analytics?.keywords || [],
            appointmentHistory: bookingCount || 0,
            conversationCount: conversationCount || 0,
            lastInteractionAt: analytics?.last_appointment_at || null,
        };
        res.json(response);
    }
    catch (error) {
        console.error('Error fetching customer analytics:', error);
        res.status(500).json({ error: 'Failed to fetch customer analytics' });
    }
});
// Get customer service/booking history
router.get('/:id/service-history', async (req, res) => {
    try {
        const { id } = req.params;
        // Validate UUID format
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid customer ID format' });
        }
        // Get all bookings for this customer with service and team member details
        const { data: bookings, error } = await supabase_1.supabase
            .from('bookings')
            .select(`
        id,
        start_time,
        status,
        cost,
        notes,
        created_at,
        services:service_id (
          id,
          name,
          description,
          duration_minutes
        ),
        team_members:team_member_id (
          id,
          name,
          role
        )
      `)
            .eq('contact_id', id)
            .order('start_time', { ascending: false });
        if (error)
            throw error;
        // Format the response
        const formattedHistory = (bookings || []).map((booking) => ({
            id: booking.id,
            scheduledTime: booking.start_time,
            status: booking.status,
            cost: booking.cost,
            notes: booking.notes,
            createdAt: booking.created_at,
            service: booking.services ? {
                id: booking.services.id,
                name: booking.services.name,
                description: booking.services.description,
                durationMinutes: booking.services.duration_minutes
            } : null,
            teamMember: booking.team_members ? {
                id: booking.team_members.id,
                name: booking.team_members.name,
                role: booking.team_members.role
            } : null
        }));
        res.json(formattedHistory);
    }
    catch (error) {
        console.error('Error fetching customer service history:', error);
        res.status(500).json({ error: 'Failed to fetch service history' });
    }
});
// Get payment transactions for a customer
router.get('/:id/transactions', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        // Validate UUID format
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid customer ID format' });
        }
        const { data: transactions, error } = await supabase_1.supabase
            .from('payment_transactions')
            .select(`
        *,
        booking:bookings!payment_transactions_booking_id_fkey(id, title, start_time),
        service:services(id, name)
      `)
            .eq('contact_id', id)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        // Calculate summary
        const totalPaid = transactions?.filter(t => t.status === 'succeeded')
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) || 0;
        const totalPending = transactions?.filter(t => t.status === 'pending')
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) || 0;
        const totalPenalties = transactions?.filter(t => t.is_penalty)
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) || 0;
        res.json({
            transactions: transactions || [],
            summary: {
                total_paid: totalPaid,
                total_pending: totalPending,
                total_penalties: totalPenalties,
            }
        });
    }
    catch (error) {
        console.error('Error fetching customer transactions:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get payment escalations for a customer
router.get('/:id/payment-escalations', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        // Validate UUID format
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid customer ID format' });
        }
        const { data: escalations, error } = await supabase_1.supabase
            .from('payment_escalations')
            .select('*')
            .eq('contact_id', id)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        res.json({ escalations: escalations || [] });
    }
    catch (error) {
        console.error('Error fetching payment escalations:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get all customers with outstanding balances (Admin Dashboard - MASTER ONLY)
router.get('/admin/outstanding-balances', auth_1.authMiddleware, async (req, res) => {
    try {
        // SECURITY: Master-only endpoint for financial data
        if (req.agent?.role !== 'master') {
            return res.status(403).json({ error: 'Master role required to access payment data' });
        }
        const { data: customers, error } = await supabase_1.supabase
            .from('contacts')
            .select(`
        id,
        name,
        phone_number,
        email,
        outstanding_balance_chf,
        payment_allowance_granted,
        created_at
      `)
            .gt('outstanding_balance_chf', 0)
            .order('outstanding_balance_chf', { ascending: false });
        if (error)
            throw error;
        const customersWithDetails = await Promise.all((customers || []).map(async (customer) => {
            const { data: pendingTransactions } = await supabase_1.supabase
                .from('payment_transactions')
                .select('id, amount, is_penalty, payment_type, created_at, due_date')
                .eq('contact_id', customer.id)
                .in('status', ['pending', 'failed'])
                .order('created_at', { ascending: false });
            const { data: escalations } = await supabase_1.supabase
                .from('payment_escalations')
                .select('id, escalation_level, status, created_at')
                .eq('contact_id', customer.id)
                .order('created_at', { ascending: false })
                .limit(1);
            return {
                ...customer,
                pending_transactions: pendingTransactions || [],
                latest_escalation: escalations?.[0] || null,
            };
        }));
        const totalOutstanding = customersWithDetails.reduce((sum, c) => sum + parseFloat(c.outstanding_balance_chf || 0), 0);
        res.json({
            customers: customersWithDetails,
            summary: {
                total_customers: customersWithDetails.length,
                total_outstanding: totalOutstanding,
            },
        });
    }
    catch (error) {
        console.error('Error fetching outstanding balances:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
