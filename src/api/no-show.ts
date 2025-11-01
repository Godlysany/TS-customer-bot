import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import NoShowService from '../core/NoShowService';

const router = Router();

router.post('/mark/:bookingId', authMiddleware, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { notes } = req.body;

    const result = await NoShowService.markAsNoShow(bookingId, notes);
    
    res.json({
      success: true,
      tracking: result.tracking,
      suspended: result.suspended,
    });
  } catch (error: any) {
    console.error('Error marking no-show:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/history/:contactId', authMiddleware, async (req, res) => {
  try {
    const { contactId } = req.params;
    const history = await NoShowService.getNoShowHistory(contactId);
    
    res.json({ history });
  } catch (error: any) {
    console.error('Error fetching no-show history:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/status/:contactId', authMiddleware, async (req, res) => {
  try {
    const { contactId } = req.params;
    const strikeCount = await NoShowService.getContactStrikeCount(contactId);
    const suspension = await NoShowService.isContactSuspended(contactId);
    
    res.json({
      strikeCount,
      ...suspension,
    });
  } catch (error: any) {
    console.error('Error fetching no-show status:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/lift-suspension/:contactId', authMiddleware, requireRole('master', 'operator', 'support'), async (req, res) => {
  try {
    const { contactId } = req.params;
    await NoShowService.liftSuspension(contactId);
    
    res.json({ success: true, message: 'Suspension lifted' });
  } catch (error: any) {
    console.error('Error lifting suspension:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/reset-strikes/:contactId', authMiddleware, requireRole('master', 'operator', 'support'), async (req, res) => {
  try {
    const { contactId } = req.params;
    await NoShowService.resetStrikes(contactId);
    
    res.json({ success: true, message: 'Strikes reset' });
  } catch (error: any) {
    console.error('Error resetting strikes:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
