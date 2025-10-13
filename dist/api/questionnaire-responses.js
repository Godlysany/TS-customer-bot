"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../infrastructure/supabase");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', async (req, res) => {
    try {
        const { data: responses, error } = await supabase_1.supabase
            .from('questionnaire_responses')
            .select(`
        *,
        contact:contacts(name, phone, email),
        questionnaire:questionnaires(name, type)
      `)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        const formattedResponses = responses?.map((r) => ({
            ...r,
            contact_name: r.contact?.name,
            contact_phone: r.contact?.phone,
            contact_email: r.contact?.email,
            questionnaire_name: r.questionnaire?.name,
            questionnaire_type: r.questionnaire?.type,
        }));
        res.json(formattedResponses || []);
    }
    catch (error) {
        console.error('Error fetching questionnaire responses:', error);
        res.status(500).json({ error: 'Failed to fetch questionnaire responses' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: response, error } = await supabase_1.supabase
            .from('questionnaire_responses')
            .select(`
        *,
        contact:contacts(name, phone, email),
        questionnaire:questionnaires(name, type)
      `)
            .eq('id', id)
            .single();
        if (error)
            throw error;
        const formattedResponse = {
            ...response,
            contact_name: response.contact?.name,
            contact_phone: response.contact?.phone,
            contact_email: response.contact?.email,
            questionnaire_name: response.questionnaire?.name,
            questionnaire_type: response.questionnaire?.type,
        };
        res.json(formattedResponse);
    }
    catch (error) {
        console.error('Error fetching questionnaire response:', error);
        res.status(500).json({ error: 'Failed to fetch questionnaire response' });
    }
});
exports.default = router;
