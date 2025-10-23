import { Router } from 'express';
import { supabase } from '../infrastructure/supabase';
import { authMiddleware, requireRole } from '../middleware/auth';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';
import serviceAvailabilityService from '../core/ServiceAvailabilityService';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { data: services, error } = await supabase
      .from('services')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    res.json(services?.map(toCamelCase) || []);
  } catch (error: any) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid service ID format' });
    }

    const { data: service, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json(toCamelCase(service));
  } catch (error: any) {
    console.error('Error fetching service:', error);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

router.post('/', requireRole('master'), async (req, res) => {
  try {
    const serviceData = toSnakeCase(req.body);

    const { data: service, error } = await supabase
      .from('services')
      .insert(serviceData)
      .select()
      .single();

    if (error) throw error;

    res.json(toCamelCase(service));
  } catch (error: any) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

router.put('/:id', requireRole('master'), async (req, res) => {
  try {
    const { id } = req.params;
    const serviceData = toSnakeCase(req.body);

    const { data: service, error } = await supabase
      .from('services')
      .update(serviceData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(toCamelCase(service));
  } catch (error: any) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

router.delete('/:id', requireRole('master'), async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// ========================================
// SERVICE BOOKING WINDOWS ENDPOINTS
// ========================================

// Get all booking windows for a service
router.get('/:id/booking-windows', async (req, res) => {
  try {
    const { id } = req.params;
    const windows = await serviceAvailabilityService.getBookingWindows(id);
    res.json(windows);
  } catch (error: any) {
    console.error('Error fetching booking windows:', error);
    res.status(500).json({ error: 'Failed to fetch booking windows' });
  }
});

// Create a booking window for a service
router.post('/:id/booking-windows', requireRole('master'), async (req, res) => {
  try {
    const { id } = req.params;
    const windowData = { ...req.body, serviceId: id };
    const window = await serviceAvailabilityService.createBookingWindow(windowData);
    res.json(window);
  } catch (error: any) {
    console.error('Error creating booking window:', error);
    res.status(500).json({ error: 'Failed to create booking window' });
  }
});

// Bulk replace booking windows for a service
router.put('/:id/booking-windows', requireRole('master'), async (req, res) => {
  try {
    const { id } = req.params;
    const { windows } = req.body;
    const updated = await serviceAvailabilityService.replaceBookingWindows(id, windows);
    res.json(updated);
  } catch (error: any) {
    console.error('Error replacing booking windows:', error);
    res.status(500).json({ error: 'Failed to replace booking windows' });
  }
});

// Update a specific booking window
router.patch('/booking-windows/:windowId', requireRole('master'), async (req, res) => {
  try {
    const { windowId } = req.params;
    const window = await serviceAvailabilityService.updateBookingWindow(windowId, req.body);
    res.json(window);
  } catch (error: any) {
    console.error('Error updating booking window:', error);
    res.status(500).json({ error: 'Failed to update booking window' });
  }
});

// Delete a booking window
router.delete('/booking-windows/:windowId', requireRole('master'), async (req, res) => {
  try {
    const { windowId } = req.params;
    await serviceAvailabilityService.deleteBookingWindow(windowId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting booking window:', error);
    res.status(500).json({ error: 'Failed to delete booking window' });
  }
});

// ========================================
// SERVICE BLOCKERS ENDPOINTS
// ========================================

// Get all blockers for a service
router.get('/:id/blockers', async (req, res) => {
  try {
    const { id } = req.params;
    const blockers = await serviceAvailabilityService.getServiceBlockers(id);
    res.json(blockers);
  } catch (error: any) {
    console.error('Error fetching service blockers:', error);
    res.status(500).json({ error: 'Failed to fetch service blockers' });
  }
});

// Create a blocker for a service
router.post('/:id/blockers', requireRole('master'), async (req, res) => {
  try {
    const { id } = req.params;
    const blockerData = { ...req.body, serviceId: id };
    const blocker = await serviceAvailabilityService.createServiceBlocker(blockerData);
    res.json(blocker);
  } catch (error: any) {
    console.error('Error creating service blocker:', error);
    res.status(500).json({ error: 'Failed to create service blocker' });
  }
});

// Update a service blocker
router.patch('/blockers/:blockerId', requireRole('master'), async (req, res) => {
  try {
    const { blockerId } = req.params;
    const blocker = await serviceAvailabilityService.updateServiceBlocker(blockerId, req.body);
    res.json(blocker);
  } catch (error: any) {
    console.error('Error updating service blocker:', error);
    res.status(500).json({ error: 'Failed to update service blocker' });
  }
});

// Delete a service blocker
router.delete('/blockers/:blockerId', requireRole('master'), async (req, res) => {
  try {
    const { blockerId } = req.params;
    await serviceAvailabilityService.deleteServiceBlocker(blockerId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting service blocker:', error);
    res.status(500).json({ error: 'Failed to delete service blocker' });
  }
});

// Validate a booking time for a service
router.post('/:id/validate-time', async (req, res) => {
  try {
    const { id } = req.params;
    const { dateTime } = req.body;
    const validation = await serviceAvailabilityService.validateBookingTime(id, new Date(dateTime));
    res.json(validation);
  } catch (error: any) {
    console.error('Error validating booking time:', error);
    res.status(500).json({ error: 'Failed to validate booking time' });
  }
});

export default router;
