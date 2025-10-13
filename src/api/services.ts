import { Router } from 'express';
import { supabase } from '../infrastructure/supabase';
import { authMiddleware, requireRole } from '../middleware/auth';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';

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

export default router;
