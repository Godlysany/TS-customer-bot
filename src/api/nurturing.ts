import { Router } from 'express';
import NurturingService from '../core/NurturingService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/nurturing/settings', authMiddleware, async (req, res) => {
  try {
    const settings = await NurturingService.getSettings();
    res.json(settings);
  } catch (error: any) {
    console.error('Error fetching nurturing settings:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/nurturing/settings/:key', authMiddleware, async (req, res) => {
  try {
    const { key } = req.params;
    const value = await NurturingService.getSetting(key);
    res.json({ key, value });
  } catch (error: any) {
    console.error('Error fetching nurturing setting:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/nurturing/settings/:key', authMiddleware, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (!value && value !== '') {
      return res.status(400).json({ error: 'Value is required' });
    }

    await NurturingService.updateSetting(key, value);
    res.json({ success: true, key, value });
  } catch (error: any) {
    console.error('Error updating nurturing setting:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/nurturing/stats', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const stats = await NurturingService.getActivityStats(start, end);
    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching nurturing stats:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/nurturing/contacts/:contactId/profile', authMiddleware, async (req, res) => {
  try {
    const { contactId } = req.params;
    const profile = await NurturingService.getContactNurturingProfile(contactId);
    
    if (!profile) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json(profile);
  } catch (error: any) {
    console.error('Error fetching contact nurturing profile:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/nurturing/contacts/:contactId/activities', authMiddleware, async (req, res) => {
  try {
    const { contactId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const activities = await NurturingService.getContactActivities(contactId, limit);
    res.json(activities);
  } catch (error: any) {
    console.error('Error fetching contact activities:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/nurturing/contacts/:contactId/birthdate', authMiddleware, async (req, res) => {
  try {
    const { contactId } = req.params;
    const { birthdate } = req.body;
    
    await NurturingService.updateContactBirthdate(contactId, birthdate);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating contact birthdate:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/nurturing/contacts/:contactId/preferences', authMiddleware, async (req, res) => {
  try {
    const { contactId } = req.params;
    const preferences = req.body;
    
    await NurturingService.updateContactNurturingPreferences(contactId, preferences);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating contact preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/nurturing/birthday-contacts', authMiddleware, async (req, res) => {
  try {
    const contacts = await NurturingService.getBirthdayContactsToday();
    res.json(contacts);
  } catch (error: any) {
    console.error('Error fetching birthday contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/nurturing/review-eligible-contacts', authMiddleware, async (req, res) => {
  try {
    const contacts = await NurturingService.getReviewEligibleContacts();
    res.json(contacts);
  } catch (error: any) {
    console.error('Error fetching review-eligible contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
