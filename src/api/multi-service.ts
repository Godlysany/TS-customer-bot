import express from 'express';
import { MultiServiceBookingService } from '../core/MultiServiceBookingService';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();
const multiServiceService = new MultiServiceBookingService();

router.get('/recommendations/:contactId', authMiddleware, async (req, res) => {
  try {
    const { serviceId } = req.query;
    const recommendations = await multiServiceService.getServiceRecommendations(
      req.params.contactId,
      serviceId as string | undefined
    );
    res.json({ recommendations });
  } catch (error: any) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/calculate-schedule', authMiddleware, async (req, res) => {
  try {
    const { serviceIds, startDate } = req.body;
    
    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return res.status(400).json({ error: 'serviceIds array is required' });
    }

    if (!startDate) {
      return res.status(400).json({ error: 'startDate is required' });
    }

    const schedule = await multiServiceService.calculateMultiServiceSchedule(
      serviceIds,
      new Date(startDate)
    );

    res.json({ schedule });
  } catch (error: any) {
    console.error('Error calculating schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/popular-combinations', authMiddleware, async (req, res) => {
  try {
    const { serviceIds } = req.query;
    
    if (!serviceIds || typeof serviceIds !== 'string') {
      return res.status(400).json({ error: 'serviceIds parameter required (comma-separated)' });
    }

    const serviceIdArray = serviceIds.split(',').filter(Boolean);
    
    const recommendations = await multiServiceService.getPopularCombinations(serviceIdArray);

    res.json({ recommendations });
  } catch (error: any) {
    console.error('Error fetching popular combinations:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
