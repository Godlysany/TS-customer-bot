import express from 'express';
import { EngagementService } from '../core/EngagementService';
import { getEngagementScheduler } from '../core/EngagementScheduler';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = express.Router();
const engagementService = new EngagementService();

router.get('/campaigns', authMiddleware, async (req, res) => {
  try {
    const campaigns = await engagementService.getAllCampaigns();
    res.json({ campaigns });
  } catch (error: any) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/campaigns/:id', authMiddleware, async (req, res) => {
  try {
    const campaign = await engagementService.getCampaignById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json({ campaign });
  } catch (error: any) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/campaigns', authMiddleware, requireRole('master', 'operator', 'support'), async (req, res) => {
  try {
    const campaign = await engagementService.createCampaign(req.body);
    if (!campaign) {
      return res.status(400).json({ error: 'Failed to create campaign' });
    }
    res.json({ campaign });
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/campaigns/:id', authMiddleware, requireRole('master', 'operator', 'support'), async (req, res) => {
  try {
    const campaign = await engagementService.updateCampaign(req.params.id, req.body);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found or update failed' });
    }
    res.json({ campaign });
  } catch (error: any) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/campaigns/:id', authMiddleware, requireRole('master', 'operator', 'support'), async (req, res) => {
  try {
    const success = await engagementService.deleteCampaign(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Campaign not found or delete failed' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/campaigns/:id/run', authMiddleware, requireRole('master', 'operator', 'support'), async (req, res) => {
  try {
    const campaign = await engagementService.getCampaignById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const targets = await engagementService.findTargetCustomers(campaign);
    res.json({ 
      success: true, 
      targetCount: targets.length,
      message: 'Campaign will be processed by the scheduler'
    });
  } catch (error: any) {
    console.error('Error running campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/scheduler/run-now', authMiddleware, requireRole('master', 'operator', 'support'), async (req, res) => {
  try {
    const scheduler = getEngagementScheduler();
    scheduler.runOnce();
    res.json({ success: true, message: 'Engagement campaigns triggered' });
  } catch (error: any) {
    console.error('Error running engagement scheduler:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
