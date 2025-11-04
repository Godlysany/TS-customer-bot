"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../infrastructure/supabase");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All bot-config routes require master role
router.use(auth_1.authMiddleware);
router.use((0, auth_1.requireRole)('master'));
// Business Details
router.get('/business-details', async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('settings')
            .select('*')
            .in('key', ['business_name', 'business_description', 'business_hours', 'contact_email', 'contact_phone']);
        if (error)
            throw error;
        res.json({
            businessName: data?.find(s => s.key === 'business_name')?.value || '',
            businessDescription: data?.find(s => s.key === 'business_description')?.value || '',
            businessHours: data?.find(s => s.key === 'business_hours')?.value || '',
            contactEmail: data?.find(s => s.key === 'contact_email')?.value || '',
            contactPhone: data?.find(s => s.key === 'contact_phone')?.value || '',
        });
    }
    catch (error) {
        console.error('Error fetching business details:', error);
        res.status(500).json({ error: 'Failed to fetch business details' });
    }
});
router.post('/business-details', async (req, res) => {
    try {
        const { businessName, businessDescription, businessHours, contactEmail, contactPhone } = req.body;
        const updates = [
            { key: 'business_name', value: businessName || '', is_secret: false },
            { key: 'business_description', value: businessDescription || '', is_secret: false },
            { key: 'business_hours', value: businessHours || '', is_secret: false },
            { key: 'contact_email', value: contactEmail || '', is_secret: false },
            { key: 'contact_phone', value: contactPhone || '', is_secret: false },
        ];
        for (const update of updates) {
            const { error } = await supabase_1.supabase
                .from('settings')
                .upsert(update, { onConflict: 'key' });
            if (error)
                throw error;
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error saving business details:', error);
        res.status(500).json({ error: 'Failed to save business details' });
    }
});
// Prompt Configuration
router.get('/prompt-config', async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('settings')
            .select('*')
            .in('key', ['business_fine_tuning_prompt', 'tone_of_voice', 'response_style']);
        if (error)
            throw error;
        res.json({
            fineTuningPrompt: data?.find(s => s.key === 'business_fine_tuning_prompt')?.value || '',
            toneOfVoice: data?.find(s => s.key === 'tone_of_voice')?.value || 'professional',
            responseStyle: data?.find(s => s.key === 'response_style')?.value || 'concise',
        });
    }
    catch (error) {
        console.error('Error fetching prompt config:', error);
        res.status(500).json({ error: 'Failed to fetch prompt config' });
    }
});
router.post('/prompt-config', async (req, res) => {
    try {
        const { fineTuningPrompt, toneOfVoice, responseStyle } = req.body;
        const updates = [
            { key: 'business_fine_tuning_prompt', value: fineTuningPrompt || '', is_secret: false },
            { key: 'tone_of_voice', value: toneOfVoice || 'professional', is_secret: false },
            { key: 'response_style', value: responseStyle || 'concise', is_secret: false },
        ];
        for (const update of updates) {
            const { error } = await supabase_1.supabase
                .from('settings')
                .upsert(update, { onConflict: 'key' });
            if (error)
                throw error;
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error saving prompt config:', error);
        res.status(500).json({ error: 'Failed to save prompt config' });
    }
});
// Master Prompt (read-only)
router.get('/master-prompt', async (req, res) => {
    try {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        const promptPath = path.join(process.cwd(), 'MASTER_SYSTEM_PROMPT.md');
        const content = await fs.readFile(promptPath, 'utf-8');
        res.json({ content });
    }
    catch (error) {
        console.error('Error reading master prompt:', error);
        res.status(500).json({ error: 'Failed to read master prompt' });
    }
});
// Escalation Configuration
router.get('/escalation', async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('settings')
            .select('*')
            .in('key', ['escalation_mode', 'escalation_keywords', 'escalation_confidence_threshold']);
        if (error)
            throw error;
        res.json({
            mode: data?.find(s => s.key === 'escalation_mode')?.value || 'keyword',
            keywords: JSON.parse(data?.find(s => s.key === 'escalation_keywords')?.value || '[]'),
            confidenceThreshold: parseFloat(data?.find(s => s.key === 'escalation_confidence_threshold')?.value || '0.3'),
        });
    }
    catch (error) {
        console.error('Error fetching escalation config:', error);
        res.status(500).json({ error: 'Failed to fetch escalation config' });
    }
});
router.post('/escalation', async (req, res) => {
    try {
        const { mode, keywords, confidenceThreshold } = req.body;
        const updates = [
            { key: 'escalation_mode', value: mode || 'keyword', is_secret: false },
            { key: 'escalation_keywords', value: JSON.stringify(keywords || []), is_secret: false },
            { key: 'escalation_confidence_threshold', value: String(confidenceThreshold || 0.3), is_secret: false },
        ];
        for (const update of updates) {
            const { error } = await supabase_1.supabase
                .from('settings')
                .upsert(update, { onConflict: 'key' });
            if (error)
                throw error;
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error saving escalation config:', error);
        res.status(500).json({ error: 'Failed to save escalation config' });
    }
});
router.post('/escalation/test', async (req, res) => {
    try {
        const { message } = req.body;
        // Simple test logic - just check if keywords match
        const { data } = await supabase_1.supabase
            .from('settings')
            .select('value')
            .eq('key', 'escalation_keywords')
            .maybeSingle();
        const keywords = JSON.parse(data?.value || '[]');
        const shouldEscalate = keywords.some((kw) => message.toLowerCase().includes(kw.toLowerCase()));
        res.json({ shouldEscalate, matchedKeywords: shouldEscalate ? keywords : [] });
    }
    catch (error) {
        res.status(500).json({ error: 'Test failed' });
    }
});
// Confirmation Templates
router.get('/confirmations', async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('settings')
            .select('*')
            .in('key', ['booking_confirmation_template', 'cancellation_confirmation_template']);
        if (error)
            throw error;
        res.json({
            bookingTemplate: data?.find(s => s.key === 'booking_confirmation_template')?.value || '',
            cancellationTemplate: data?.find(s => s.key === 'cancellation_confirmation_template')?.value || '',
        });
    }
    catch (error) {
        console.error('Error fetching confirmations:', error);
        res.status(500).json({ error: 'Failed to fetch confirmations' });
    }
});
router.post('/confirmations', async (req, res) => {
    try {
        const { bookingTemplate, cancellationTemplate } = req.body;
        const updates = [
            { key: 'booking_confirmation_template', value: bookingTemplate || '', is_secret: false },
            { key: 'cancellation_confirmation_template', value: cancellationTemplate || '', is_secret: false },
        ];
        for (const update of updates) {
            const { error } = await supabase_1.supabase
                .from('settings')
                .upsert(update, { onConflict: 'key' });
            if (error)
                throw error;
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error saving confirmations:', error);
        res.status(500).json({ error: 'Failed to save confirmations' });
    }
});
// Email Collection
router.get('/email-collection', async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('settings')
            .select('*')
            .in('key', ['email_collection_enabled', 'email_collection_message']);
        if (error)
            throw error;
        res.json({
            enabled: data?.find(s => s.key === 'email_collection_enabled')?.value === 'true',
            message: data?.find(s => s.key === 'email_collection_message')?.value || '',
        });
    }
    catch (error) {
        console.error('Error fetching email config:', error);
        res.status(500).json({ error: 'Failed to fetch email config' });
    }
});
router.post('/email-collection', async (req, res) => {
    try {
        const { enabled, message } = req.body;
        const updates = [
            { key: 'email_collection_enabled', value: String(enabled), is_secret: false },
            { key: 'email_collection_message', value: message || '', is_secret: false },
        ];
        for (const update of updates) {
            const { error } = await supabase_1.supabase
                .from('settings')
                .upsert(update, { onConflict: 'key' });
            if (error)
                throw error;
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error saving email config:', error);
        res.status(500).json({ error: 'Failed to save email config' });
    }
});
router.get('/context', async (req, res) => {
    try {
        const { data: context, error } = await supabase_1.supabase
            .from('settings')
            .select('*')
            .in('key', ['business_info', 'faq_items']);
        if (error)
            throw error;
        const businessInfo = context?.find(s => s.key === 'business_info')?.value || '';
        const faqItems = context?.find(s => s.key === 'faq_items')?.value || '[]';
        res.json({
            businessInfo,
            faqItems: JSON.parse(faqItems),
        });
    }
    catch (error) {
        console.error('Error fetching bot context:', error);
        res.status(500).json({ error: 'Failed to fetch bot context' });
    }
});
router.post('/context', async (req, res) => {
    try {
        const { businessInfo, faqItems } = req.body;
        const updates = [
            {
                key: 'business_info',
                value: businessInfo || '',
                is_secret: false,
            },
            {
                key: 'faq_items',
                value: JSON.stringify(faqItems || []),
                is_secret: false,
            },
        ];
        for (const update of updates) {
            const { error } = await supabase_1.supabase
                .from('settings')
                .upsert(update, { onConflict: 'key' });
            if (error)
                throw error;
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error saving bot context:', error);
        res.status(500).json({ error: 'Failed to save bot context' });
    }
});
router.get('/prompts', async (req, res) => {
    try {
        const { data: settings, error } = await supabase_1.supabase
            .from('settings')
            .select('*')
            .in('key', ['system_prompt', 'tone_of_voice', 'escalation_triggers', 'response_style']);
        if (error)
            throw error;
        const systemPrompt = settings?.find(s => s.key === 'system_prompt')?.value || '';
        const toneOfVoice = settings?.find(s => s.key === 'tone_of_voice')?.value || 'professional';
        const escalationTriggers = settings?.find(s => s.key === 'escalation_triggers')?.value || '[]';
        const responseStyle = settings?.find(s => s.key === 'response_style')?.value || 'concise';
        res.json({
            systemPrompt,
            toneOfVoice,
            escalationTriggers: JSON.parse(escalationTriggers),
            responseStyle,
        });
    }
    catch (error) {
        console.error('Error fetching prompts:', error);
        res.status(500).json({ error: 'Failed to fetch prompts' });
    }
});
router.post('/prompts', async (req, res) => {
    try {
        const { systemPrompt, toneOfVoice, escalationTriggers, responseStyle } = req.body;
        const updates = [
            {
                key: 'system_prompt',
                value: systemPrompt || '',
                is_secret: false,
            },
            {
                key: 'tone_of_voice',
                value: toneOfVoice || 'professional',
                is_secret: false,
            },
            {
                key: 'escalation_triggers',
                value: JSON.stringify(escalationTriggers || []),
                is_secret: false,
            },
            {
                key: 'response_style',
                value: responseStyle || 'concise',
                is_secret: false,
            },
        ];
        for (const update of updates) {
            const { error } = await supabase_1.supabase
                .from('settings')
                .upsert(update, { onConflict: 'key' });
            if (error)
                throw error;
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error saving prompts:', error);
        res.status(500).json({ error: 'Failed to save prompts' });
    }
});
router.get('/questionnaires', async (req, res) => {
    try {
        const { data: questionnaires, error } = await supabase_1.supabase
            .from('questionnaires')
            .select('*')
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        res.json(questionnaires || []);
    }
    catch (error) {
        console.error('Error fetching questionnaires:', error);
        res.status(500).json({ error: 'Failed to fetch questionnaires' });
    }
});
router.post('/questionnaires', async (req, res) => {
    try {
        const { name, type, triggerType, questions } = req.body;
        const { data, error } = await supabase_1.supabase
            .from('questionnaires')
            .insert({
            name,
            type,
            trigger_type: triggerType,
            questions: JSON.stringify(questions),
            is_active: true,
        })
            .select()
            .single();
        if (error)
            throw error;
        res.json(data);
    }
    catch (error) {
        console.error('Error saving questionnaire:', error);
        res.status(500).json({ error: 'Failed to save questionnaire' });
    }
});
router.get('/controls', async (req, res) => {
    try {
        const { data: settings, error } = await supabase_1.supabase
            .from('settings')
            .select('*')
            .in('key', [
            'enable_auto_response',
            'enable_questionnaires',
            'enable_booking',
            'require_human_approval',
            'max_response_length',
            'confidence_threshold',
            'enable_sentiment_analysis',
            'enable_fallback',
            'fallback_message',
        ]);
        if (error)
            throw error;
        const controls = {
            enableAutoResponse: settings?.find(s => s.key === 'enable_auto_response')?.value === 'true',
            enableQuestionnaires: settings?.find(s => s.key === 'enable_questionnaires')?.value === 'true',
            enableBooking: settings?.find(s => s.key === 'enable_booking')?.value === 'true',
            requireHumanApproval: settings?.find(s => s.key === 'require_human_approval')?.value === 'true',
            maxResponseLength: parseInt(settings?.find(s => s.key === 'max_response_length')?.value || '300'),
            confidenceThreshold: parseFloat(settings?.find(s => s.key === 'confidence_threshold')?.value || '0.7'),
            enableSentimentAnalysis: settings?.find(s => s.key === 'enable_sentiment_analysis')?.value === 'true',
            enableFallback: settings?.find(s => s.key === 'enable_fallback')?.value === 'true',
            fallbackMessage: settings?.find(s => s.key === 'fallback_message')?.value || "I'm not sure about that. Let me connect you with a team member who can help.",
        };
        res.json(controls);
    }
    catch (error) {
        console.error('Error fetching controls:', error);
        res.status(500).json({ error: 'Failed to fetch controls' });
    }
});
router.post('/controls', async (req, res) => {
    try {
        const { enableAutoResponse, enableQuestionnaires, enableBooking, requireHumanApproval, maxResponseLength, confidenceThreshold, enableSentimentAnalysis, enableFallback, fallbackMessage, } = req.body;
        const updates = [
            { key: 'enable_auto_response', value: String(enableAutoResponse), is_secret: false },
            { key: 'enable_questionnaires', value: String(enableQuestionnaires), is_secret: false },
            { key: 'enable_booking', value: String(enableBooking), is_secret: false },
            { key: 'require_human_approval', value: String(requireHumanApproval), is_secret: false },
            { key: 'max_response_length', value: String(maxResponseLength), is_secret: false },
            { key: 'confidence_threshold', value: String(confidenceThreshold), is_secret: false },
            { key: 'enable_sentiment_analysis', value: String(enableSentimentAnalysis), is_secret: false },
            { key: 'enable_fallback', value: String(enableFallback), is_secret: false },
            { key: 'fallback_message', value: fallbackMessage, is_secret: false },
        ];
        for (const update of updates) {
            const { error } = await supabase_1.supabase
                .from('settings')
                .upsert(update, { onConflict: 'key' });
            if (error)
                throw error;
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error saving controls:', error);
        res.status(500).json({ error: 'Failed to save controls' });
    }
});
// AI Prompt Generation (using OpenAI to help admins write better prompts)
router.post('/ai-generate-prompt', async (req, res) => {
    try {
        const { instruction } = req.body;
        const getOpenAI = (await Promise.resolve().then(() => __importStar(require('../infrastructure/openai')))).default;
        const openai = await getOpenAI();
        const systemPrompt = `You are an expert at writing Business Fine-Tuning Prompts for sophisticated AI customer service bots.

CRITICAL: This is a Business Fine-Tuning Prompt that layers on top of a Master System Prompt containing core booking logic, escalation rules, and CRM functionality.

Your job: Generate a structured, professional prompt that defines the bot's PERSONALITY, TONE, CULTURAL NUANCES, and BUSINESS-SPECIFIC BEHAVIOR.

Required Structure (use emojis for visual clarity):

## Rolle & Identität
🏢 Business Context: (what type of business, location, specialization)
👤 Role: (how bot introduces itself - receptionist, assistant, etc.)
🇨🇭 Language: (formal/informal, regional variations, multiple languages)
😊 Emotional Tone: (empathetic, professional, warm, etc.)

## Kommunikationsstil
- Bullet points defining communication rules
- How to handle sensitive topics (e.g., dental anxiety, medical concerns)
- Cultural considerations (Swiss German vs High German, formality levels)
- When to be brief vs detailed
- How to show empathy and understanding

## Sentiment & Escalation Awareness
- How to respond when detecting frustration or confusion
- De-escalation strategies specific to this business
- When to acknowledge customer emotions
- Phrases to use when customers are upset

## Spezielle Hinweise
- Industry-specific knowledge or protocols
- Common customer concerns and how to address them
- Unique selling points to mention naturally
- Emergency/urgent case handling
- Any regulatory or compliance notes

IMPORTANT RULES:
1. Write in the primary language of the business (detect from instruction)
2. Use formal "Sie" for German unless explicitly told otherwise
3. Include specific examples of how to phrase things
4. Make it actionable - not just "be friendly" but HOW to be friendly
5. Consider the emotional context of the industry (dentist = anxiety, spa = relaxation)
6. Include sentiment handling - the bot tracks frustration/confusion, so guide how to respond
7. NO generic welcome messages - focus on CHARACTER and BEHAVIORAL GUIDELINES
8. Return ONLY the prompt text, no meta-commentary`;
        const userMessage = `Create a Business Fine-Tuning Prompt for our WhatsApp customer service bot.

Business Context/Instruction:
${instruction}

Generate a comprehensive, structured prompt following the required format. Include emotional intelligence, cultural nuances, and specific behavioral guidelines.`;
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.7,
        });
        const generatedPrompt = response.choices[0]?.message?.content || '';
        res.json({ prompt: generatedPrompt });
    }
    catch (error) {
        console.error('Error generating prompt:', error);
        res.status(500).json({ error: 'Failed to generate prompt' });
    }
});
router.post('/ai-improve-prompt', async (req, res) => {
    try {
        const { currentPrompt, instruction } = req.body;
        const getOpenAI = (await Promise.resolve().then(() => __importStar(require('../infrastructure/openai')))).default;
        const openai = await getOpenAI();
        const systemPrompt = `You are an expert at improving Business Fine-Tuning Prompts for sophisticated AI customer service bots.

CONTEXT: The prompt you're improving defines bot personality, tone, and business-specific behavior. It layers on top of a Master System Prompt containing core logic.

Your job: Improve the prompt based on feedback while maintaining:
- The structured format (Rolle & Identität, Kommunikationsstil, Sentiment & Escalation Awareness, Spezielle Hinweise)
- Clear, actionable behavioral guidelines (not vague advice)
- Cultural and linguistic nuances
- Emotional intelligence and sentiment handling
- Industry-specific context

IMPORTANT:
1. Keep the same language as the original prompt
2. Preserve emoji visual markers for sections
3. Make improvements specific and actionable
4. If adding sentiment handling, show HOW to respond to frustration/confusion
5. Return ONLY the improved prompt text, no explanations or meta-commentary`;
        const userMessage = `Current Business Fine-Tuning Prompt:
${currentPrompt}

Improvement Request:
${instruction}

Return the improved version maintaining structure and actionability.`;
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.7,
        });
        const improvedPrompt = response.choices[0]?.message?.content || '';
        res.json({ prompt: improvedPrompt });
    }
    catch (error) {
        console.error('Error improving prompt:', error);
        res.status(500).json({ error: 'Failed to improve prompt' });
    }
});
// TTS Configuration
router.get('/tts-settings', async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('bot_config')
            .select('tts_reply_mode, tts_provider, tts_voice_id, tts_enabled')
            .maybeSingle();
        if (error)
            throw error;
        res.json({
            ttsReplyMode: data?.tts_reply_mode || 'text_only',
            ttsProvider: data?.tts_provider || 'elevenlabs',
            ttsVoiceId: data?.tts_voice_id || '',
            ttsEnabled: data?.tts_enabled || false,
        });
    }
    catch (error) {
        console.error('Error fetching TTS settings:', error);
        res.status(500).json({ error: 'Failed to fetch TTS settings' });
    }
});
router.post('/tts-settings', async (req, res) => {
    try {
        const { ttsReplyMode, ttsProvider, ttsVoiceId, ttsEnabled } = req.body;
        const { error } = await supabase_1.supabase
            .from('bot_config')
            .update({
            tts_reply_mode: ttsReplyMode,
            tts_provider: ttsProvider,
            tts_voice_id: ttsVoiceId,
            tts_enabled: ttsEnabled,
        })
            .eq('id', 1);
        if (error)
            throw error;
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error saving TTS settings:', error);
        res.status(500).json({ error: 'Failed to save TTS settings' });
    }
});
exports.default = router;
