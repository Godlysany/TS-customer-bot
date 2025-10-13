import express from 'express';
import { RecurringAppointmentService } from '../core/RecurringAppointmentService';
import { getRecurringScheduler } from '../core/RecurringAppointmentScheduler';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = express.Router();
const recurringService = new RecurringAppointmentService();

router.get('/routines/:contactId', authMiddleware, async (req, res) => {
  try {
    const routines = await recurringService.getRoutinesByContact(req.params.contactId);
    res.json({ routines });
  } catch (error: any) {
    console.error('Error fetching routines:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/routines', authMiddleware, async (req, res) => {
  try {
    const routine = await recurringService.createRoutine(req.body);
    if (!routine) {
      return res.status(400).json({ error: 'Failed to create routine' });
    }
    res.json({ routine });
  } catch (error: any) {
    console.error('Error creating routine:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/routines/:id', authMiddleware, async (req, res) => {
  try {
    const routine = await recurringService.updateRoutine(req.params.id, req.body);
    if (!routine) {
      return res.status(404).json({ error: 'Routine not found or update failed' });
    }
    res.json({ routine });
  } catch (error: any) {
    console.error('Error updating routine:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/appointments', authMiddleware, async (req, res) => {
  try {
    const appointments = await recurringService.getActiveRecurringAppointments();
    res.json({ appointments });
  } catch (error: any) {
    console.error('Error fetching recurring appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/appointments/:contactId', authMiddleware, async (req, res) => {
  try {
    const appointments = await recurringService.getRecurringByContact(req.params.contactId);
    res.json({ appointments });
  } catch (error: any) {
    console.error('Error fetching contact recurring appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/appointments', authMiddleware, async (req, res) => {
  try {
    const appointment = await recurringService.createRecurringAppointment(req.body);
    if (!appointment) {
      return res.status(400).json({ error: 'Failed to create recurring appointment' });
    }
    res.json({ appointment });
  } catch (error: any) {
    console.error('Error creating recurring appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/appointments/:id', authMiddleware, async (req, res) => {
  try {
    const appointment = await recurringService.updateRecurringAppointment(
      req.params.id,
      req.body
    );
    if (!appointment) {
      return res.status(404).json({ error: 'Recurring appointment not found or update failed' });
    }
    res.json({ appointment });
  } catch (error: any) {
    console.error('Error updating recurring appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/appointments/:id/pause', authMiddleware, async (req, res) => {
  try {
    const success = await recurringService.pauseRecurring(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Failed to pause recurring appointment' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error pausing recurring appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/appointments/:id/resume', authMiddleware, async (req, res) => {
  try {
    const success = await recurringService.resumeRecurring(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Failed to resume recurring appointment' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error resuming recurring appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/appointments/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const success = await recurringService.cancelRecurring(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Failed to cancel recurring appointment' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error cancelling recurring appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/scheduler/run-now', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    const scheduler = getRecurringScheduler();
    scheduler.runOnce();
    res.json({ success: true, message: 'Recurring appointment processing triggered' });
  } catch (error: any) {
    console.error('Error running recurring scheduler:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
