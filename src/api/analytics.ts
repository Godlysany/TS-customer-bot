import { Router } from 'express';
import { supabase } from '../infrastructure/supabase';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// Get overall sentiment analytics for dashboard (gracefully handles missing sentiment columns)
router.get('/sentiment', async (req, res) => {
  try {
    // Get average sentiment metrics across all conversations (gracefully handle missing columns)
    let conversations: any[] = [];
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('sentiment_score, frustration_level, confusion_level, satisfaction_level, escalation_status, last_sentiment_analysis')
        .not('last_sentiment_analysis', 'is', null); // Only include conversations with sentiment data

      if (error && !error.message.includes('column') && !error.code?.startsWith('42')) {
        // Only throw if it's NOT a missing column error
        throw error;
      }
      conversations = data || [];
    } catch (err: any) {
      // Gracefully degrade if sentiment columns don't exist yet
      console.log('ℹ️ Sentiment columns not available yet, returning safe defaults');
      conversations = [];
    }

    // Calculate averages
    const totalConversations = conversations?.length || 0;
    
    const avgSentiment = totalConversations > 0
      ? conversations.reduce((sum, c) => sum + (c.sentiment_score || 0), 0) / totalConversations
      : 0;
    
    const avgFrustration = totalConversations > 0
      ? conversations.reduce((sum, c) => sum + (c.frustration_level || 0), 0) / totalConversations
      : 0;
    
    const avgConfusion = totalConversations > 0
      ? conversations.reduce((sum, c) => sum + (c.confusion_level || 0), 0) / totalConversations
      : 0;
    
    const avgSatisfaction = totalConversations > 0
      ? conversations.reduce((sum, c) => sum + (c.satisfaction_level || 0), 0) / totalConversations
      : 0;

    // Count escalations
    const escalationCounts = {
      none: conversations?.filter(c => c.escalation_status === 'none').length || 0,
      pending: conversations?.filter(c => c.escalation_status === 'pending').length || 0,
      escalated: conversations?.filter(c => c.escalation_status === 'escalated').length || 0,
      resolved: conversations?.filter(c => c.escalation_status === 'resolved').length || 0,
    };

    const escalationRate = totalConversations > 0
      ? ((escalationCounts.pending + escalationCounts.escalated) / totalConversations) * 100
      : 0;

    // Get language distribution (gracefully handle missing columns)
    let contacts: any[] = [];
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('preferred_language, language_confirmed')
        .not('preferred_language', 'is', null);

      if (error && !error.message.includes('column') && !error.code?.startsWith('42')) {
        // Only throw if it's NOT a missing column error
        throw error;
      }
      contacts = data || [];
    } catch (err: any) {
      // Gracefully degrade if language_confirmed column doesn't exist yet
      console.log('ℹ️ Language confirmation columns not available yet');
      const { data } = await supabase
        .from('contacts')
        .select('preferred_language')
        .not('preferred_language', 'is', null);
      contacts = data || [];
    }

    const languageDistribution: Record<string, number> = {};
    const confirmedLanguages: Record<string, number> = {};
    
    contacts?.forEach(contact => {
      const lang = contact.preferred_language || 'unknown';
      languageDistribution[lang] = (languageDistribution[lang] || 0) + 1;
      
      if (contact.language_confirmed) {
        confirmedLanguages[lang] = (confirmedLanguages[lang] || 0) + 1;
      }
    });

    const response = {
      overall: {
        totalConversationsAnalyzed: totalConversations,
        avgSentimentScore: parseFloat(avgSentiment.toFixed(2)),
        avgFrustrationLevel: parseFloat(avgFrustration.toFixed(2)),
        avgConfusionLevel: parseFloat(avgConfusion.toFixed(2)),
        avgSatisfactionLevel: parseFloat(avgSatisfaction.toFixed(2)),
      },
      escalations: {
        counts: escalationCounts,
        escalationRate: parseFloat(escalationRate.toFixed(1)),
      },
      language: {
        distribution: languageDistribution,
        confirmed: confirmedLanguages,
        totalContacts: contacts?.length || 0,
      },
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching sentiment analytics:', error);
    res.status(500).json({ error: 'Failed to fetch sentiment analytics' });
  }
});

export default router;
