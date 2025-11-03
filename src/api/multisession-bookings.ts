import { Router } from 'express';
import { supabase } from '../infrastructure/supabase';
import { authMiddleware } from '../middleware/auth';
import { isValidUUID } from '../utils/uuid-validator';

const router = Router();

router.use(authMiddleware);

// Get all active multi-session configurations with details
router.get('/', async (req, res) => {
  try {
    const { data: configs, error } = await supabase
      .from('customer_multisession_config')
      .select(`
        *,
        contact:contacts(id, name, phone_number, email),
        service:services(
          id, 
          name, 
          requires_multiple_sessions,
          total_sessions_required,
          multi_session_strategy,
          session_buffer_config
        ),
        parent_booking:bookings(id, scheduled_time, status)
      `)
      .eq('is_active', true)
      .in('status', ['active', 'paused'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get session bookings for each config
    const configsWithBookings = await Promise.all(
      (configs || []).map(async (config: any) => {
        // Get all bookings in this session group
        const { data: sessionBookings } = await supabase
          .from('bookings')
          .select('id, scheduled_time, start_time, end_time, status, session_number, total_sessions, cost, notes')
          .eq('session_group_id', config.parent_booking_id)
          .order('session_number', { ascending: true });

        // Calculate effective values (custom or service default)
        const serviceConfig = config.service?.session_buffer_config || {};
        
        return {
          id: config.id,
          contact_id: config.contact_id,
          service_id: config.service_id,
          contact: config.contact,
          service: config.service,
          parent_booking: config.parent_booking,
          
          // Effective configuration (custom overrides or service defaults)
          effective_total_sessions: config.custom_total_sessions ?? config.service?.total_sessions_required,
          effective_strategy: config.custom_strategy ?? config.service?.multi_session_strategy,
          effective_min_days_between: config.custom_min_days_between_sessions ?? serviceConfig.min_days_between,
          effective_max_days_between: config.custom_max_days_between_sessions ?? serviceConfig.max_days_between,
          effective_buffer_before: config.custom_buffer_before_minutes ?? serviceConfig.buffer_before_minutes,
          effective_buffer_after: config.custom_buffer_after_minutes ?? serviceConfig.buffer_after_minutes,
          
          // Customer-specific customizations
          has_custom_config: !!(config.custom_total_sessions || config.custom_strategy || 
                                  config.custom_min_days_between_sessions || config.custom_max_days_between_sessions ||
                                  config.custom_buffer_before_minutes || config.custom_buffer_after_minutes ||
                                  config.custom_session_schedule),
          custom_total_sessions: config.custom_total_sessions,
          custom_strategy: config.custom_strategy,
          custom_min_days_between_sessions: config.custom_min_days_between_sessions,
          custom_max_days_between_sessions: config.custom_max_days_between_sessions,
          custom_buffer_before_minutes: config.custom_buffer_before_minutes,
          custom_buffer_after_minutes: config.custom_buffer_after_minutes,
          custom_session_schedule: config.custom_session_schedule,
          
          // Progress tracking
          sessions_completed: config.sessions_completed,
          sessions_scheduled: config.sessions_scheduled,
          sessions_cancelled: config.sessions_cancelled,
          status: config.status,
          completion_percentage: config.completion_percentage,
          
          // Session bookings
          session_bookings: sessionBookings || [],
          
          // Metadata
          notes: config.notes,
          started_at: config.started_at,
          completed_at: config.completed_at,
          created_at: config.created_at,
          updated_at: config.updated_at
        };
      })
    );

    res.json(configsWithBookings);
  } catch (error: any) {
    console.error('Error fetching multi-session configs:', error);
    res.status(500).json({ error: 'Failed to fetch multi-session configurations' });
  }
});

// Get multi-session configuration by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid configuration ID format' });
    }

    const { data: config, error } = await supabase
      .from('customer_multisession_config')
      .select(`
        *,
        contact:contacts(id, name, phone_number, email),
        service:services(id, name, requires_multiple_sessions, total_sessions_required, multi_session_strategy),
        parent_booking:bookings(id, scheduled_time, status)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Get session bookings
    const { data: sessionBookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('session_group_id', config.parent_booking_id)
      .order('session_number', { ascending: true });

    res.json({
      ...config,
      session_bookings: sessionBookings || []
    });
  } catch (error: any) {
    console.error('Error fetching multi-session config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// Update customer-specific multi-session configuration
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      is_active,
      custom_total_sessions,
      custom_strategy,
      custom_min_days_between_sessions,
      custom_max_days_between_sessions,
      custom_buffer_before_minutes,
      custom_buffer_after_minutes,
      custom_session_schedule,
      status,
      notes
    } = req.body;

    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid configuration ID format' });
    }

    const updateData: any = {};
    
    if (is_active !== undefined) updateData.is_active = is_active;
    if (custom_total_sessions !== undefined) updateData.custom_total_sessions = custom_total_sessions;
    if (custom_strategy !== undefined) updateData.custom_strategy = custom_strategy;
    if (custom_min_days_between_sessions !== undefined) updateData.custom_min_days_between_sessions = custom_min_days_between_sessions;
    if (custom_max_days_between_sessions !== undefined) updateData.custom_max_days_between_sessions = custom_max_days_between_sessions;
    if (custom_buffer_before_minutes !== undefined) updateData.custom_buffer_before_minutes = custom_buffer_before_minutes;
    if (custom_buffer_after_minutes !== undefined) updateData.custom_buffer_after_minutes = custom_buffer_after_minutes;
    if (custom_session_schedule !== undefined) updateData.custom_session_schedule = custom_session_schedule;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const { data, error } = await supabase
      .from('customer_multisession_config')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    console.error('Error updating multi-session config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Create new multi-session configuration for a customer
router.post('/', async (req, res) => {
  try {
    const {
      contact_id,
      service_id,
      parent_booking_id,
      custom_total_sessions,
      custom_strategy,
      custom_min_days_between_sessions,
      custom_max_days_between_sessions,
      custom_buffer_before_minutes,
      custom_buffer_after_minutes,
      custom_session_schedule,
      notes
    } = req.body;

    if (!contact_id || !service_id) {
      return res.status(400).json({ error: 'contact_id and service_id are required' });
    }

    const { data, error } = await supabase
      .from('customer_multisession_config')
      .insert({
        contact_id,
        service_id,
        parent_booking_id,
        custom_total_sessions,
        custom_strategy,
        custom_min_days_between_sessions,
        custom_max_days_between_sessions,
        custom_buffer_before_minutes,
        custom_buffer_after_minutes,
        custom_session_schedule,
        notes,
        started_at: new Date().toISOString(),
        is_active: true,
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    console.error('Error creating multi-session config:', error);
    res.status(500).json({ error: 'Failed to create configuration' });
  }
});

export default router;
