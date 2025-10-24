import { Router } from 'express';
import { supabase } from '../infrastructure/supabase';
import { authMiddleware } from '../middleware/auth';
import { isValidUUID } from '../utils/uuid-validator';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select(`
        *,
        analytics:customer_analytics(*),
        conversations:conversations(count),
        bookings:bookings(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedContacts = contacts?.map((contact: any) => ({
      ...contact,
      analytics: contact.analytics?.[0] || null,
      conversation_count: contact.conversations?.[0]?.count || 0,
      booking_count: contact.bookings?.[0]?.count || 0,
    }));

    res.json(formattedContacts || []);
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid customer ID format' });
    }

    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select(`
        *,
        analytics:customer_analytics(*)
      `)
      .eq('id', id)
      .single();

    if (contactError) throw contactError;

    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', id);

    if (convError) throw convError;

    const { data: bookings, error: bookError } = await supabase
      .from('bookings')
      .select('id')
      .eq('contact_id', id);

    if (bookError) throw bookError;

    const formattedContact = {
      ...contact,
      analytics: contact.analytics?.[0] || null,
      conversation_count: conversations?.length || 0,
      booking_count: bookings?.length || 0,
    };

    res.json(formattedContact);
  } catch (error: any) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

router.get('/:id/questionnaires', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid customer ID format' });
    }

    const { data: responses, error } = await supabase
      .from('questionnaire_responses')
      .select(`
        *,
        questionnaire:questionnaires(name, trigger_type)
      `)
      .eq('contact_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedResponses = responses?.map((r: any) => ({
      ...r,
      questionnaire_name: r.questionnaire?.name,
      questionnaire_type: r.questionnaire?.trigger_type,
    }));

    res.json(formattedResponses || []);
  } catch (error: any) {
    console.error('Error fetching customer questionnaires:', error);
    res.status(500).json({ error: 'Failed to fetch customer questionnaires' });
  }
});

router.get('/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid customer ID format' });
    }

    // Get customer analytics data
    const { data: analytics, error: analyticsError } = await supabase
      .from('customer_analytics')
      .select('*')
      .eq('contact_id', id)
      .single();

    // Get conversation count
    const { count: conversationCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('contact_id', id);

    // Get booking count
    const { count: bookingCount } = await supabase
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
  } catch (error: any) {
    console.error('Error fetching customer analytics:', error);
    res.status(500).json({ error: 'Failed to fetch customer analytics' });
  }
});

// Get customer service/booking history
router.get('/:id/service-history', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid customer ID format' });
    }

    // Get all bookings for this customer with service and team member details
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id,
        scheduled_time,
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
      .order('scheduled_time', { ascending: false });

    if (error) throw error;

    // Format the response
    const formattedHistory = (bookings || []).map((booking: any) => ({
      id: booking.id,
      scheduledTime: booking.scheduled_time,
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
  } catch (error: any) {
    console.error('Error fetching customer service history:', error);
    res.status(500).json({ error: 'Failed to fetch service history' });
  }
});

// Get payment transactions for a customer
router.get('/:id/transactions', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid customer ID format' });
    }

    const { data: transactions, error } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        booking:bookings(id, title, start_time),
        service:services(id, name)
      `)
      .eq('contact_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

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
  } catch (error: any) {
    console.error('Error fetching customer transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get payment escalations for a customer
router.get('/:id/payment-escalations', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid customer ID format' });
    }

    const { data: escalations, error } = await supabase
      .from('payment_escalations')
      .select('*')
      .eq('contact_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ escalations: escalations || [] });
  } catch (error: any) {
    console.error('Error fetching payment escalations:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
