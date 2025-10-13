"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../infrastructure/supabase");
const auth_1 = require("../middleware/auth");
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
        const { data: responses, error } = await supabase_1.supabase
            .from('questionnaire_responses')
            .select(`
        *,
        questionnaire:questionnaires(name, type)
      `)
            .eq('contact_id', id)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        const formattedResponses = responses?.map((r) => ({
            ...r,
            questionnaire_name: r.questionnaire?.name,
            questionnaire_type: r.questionnaire?.type,
        }));
        res.json(formattedResponses || []);
    }
    catch (error) {
        console.error('Error fetching customer questionnaires:', error);
        res.status(500).json({ error: 'Failed to fetch customer questionnaires' });
    }
});
exports.default = router;
