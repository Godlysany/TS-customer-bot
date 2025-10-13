import { Router } from 'express';
import { supabase } from '../infrastructure/supabase';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// All bot-config routes require master role
router.use(authMiddleware);
router.use(requireRole('master'));

router.get('/context', async (req, res) => {
  try {
    const { data: context, error } = await supabase
      .from('settings')
      .select('*')
      .in('key', ['business_info', 'faq_items']);

    if (error) throw error;

    const businessInfo = context?.find(s => s.key === 'business_info')?.value || '';
    const faqItems = context?.find(s => s.key === 'faq_items')?.value || '[]';

    res.json({
      businessInfo,
      faqItems: JSON.parse(faqItems),
    });
  } catch (error: any) {
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
      const { error } = await supabase
        .from('settings')
        .upsert(update, { onConflict: 'key' });

      if (error) throw error;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error saving bot context:', error);
    res.status(500).json({ error: 'Failed to save bot context' });
  }
});

router.get('/prompts', async (req, res) => {
  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .in('key', ['system_prompt', 'tone_of_voice', 'escalation_triggers', 'response_style']);

    if (error) throw error;

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
  } catch (error: any) {
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
      const { error } = await supabase
        .from('settings')
        .upsert(update, { onConflict: 'key' });

      if (error) throw error;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error saving prompts:', error);
    res.status(500).json({ error: 'Failed to save prompts' });
  }
});

router.get('/questionnaires', async (req, res) => {
  try {
    const { data: questionnaires, error } = await supabase
      .from('questionnaires')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(questionnaires || []);
  } catch (error: any) {
    console.error('Error fetching questionnaires:', error);
    res.status(500).json({ error: 'Failed to fetch questionnaires' });
  }
});

router.post('/questionnaires', async (req, res) => {
  try {
    const { name, type, triggerType, questions } = req.body;

    const { data, error } = await supabase
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

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    console.error('Error saving questionnaire:', error);
    res.status(500).json({ error: 'Failed to save questionnaire' });
  }
});

router.get('/controls', async (req, res) => {
  try {
    const { data: settings, error } = await supabase
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

    if (error) throw error;

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
  } catch (error: any) {
    console.error('Error fetching controls:', error);
    res.status(500).json({ error: 'Failed to fetch controls' });
  }
});

router.post('/controls', async (req, res) => {
  try {
    const {
      enableAutoResponse,
      enableQuestionnaires,
      enableBooking,
      requireHumanApproval,
      maxResponseLength,
      confidenceThreshold,
      enableSentimentAnalysis,
      enableFallback,
      fallbackMessage,
    } = req.body;

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
      const { error } = await supabase
        .from('settings')
        .upsert(update, { onConflict: 'key' });

      if (error) throw error;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error saving controls:', error);
    res.status(500).json({ error: 'Failed to save controls' });
  }
});

export default router;
