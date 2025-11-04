import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import teamUnavailabilityService from '../core/TeamMemberUnavailabilityService';

const router = Router();

/**
 * Get all unavailability periods for a specific team member
 */
router.get('/team-members/:teamMemberId/unavailability', authMiddleware, async (req, res) => {
  try {
    const { teamMemberId } = req.params;
    const activeOnly = req.query.active_only === 'true';

    const periods = await teamUnavailabilityService.getByTeamMember(teamMemberId, activeOnly);
    res.json(periods);
  } catch (error: any) {
    console.error('Error fetching team member unavailability:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all upcoming unavailability periods across all team members
 */
router.get('/team-unavailability/upcoming', authMiddleware, async (req, res) => {
  try {
    const periods = await teamUnavailabilityService.getAllUpcoming();
    res.json(periods);
  } catch (error: any) {
    console.error('Error fetching upcoming unavailability:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a specific unavailability period by ID
 */
router.get('/team-unavailability/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const period = await teamUnavailabilityService.getById(id);
    
    if (!period) {
      return res.status(404).json({ error: 'Unavailability period not found' });
    }

    res.json(period);
  } catch (error: any) {
    console.error('Error fetching unavailability:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new unavailability period (Master only)
 */
router.post('/team-unavailability', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    const { teamMemberId, startAt, endAt, reason, scope, notes } = req.body;

    if (!teamMemberId || !startAt || !endAt || !reason) {
      return res.status(400).json({ 
        error: 'Missing required fields: teamMemberId, startAt, endAt, reason' 
      });
    }

    const period = await teamUnavailabilityService.create({
      teamMemberId,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      reason,
      scope,
      notes,
    });

    res.status(201).json(period);
  } catch (error: any) {
    console.error('Error creating unavailability:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Update an unavailability period (Master only)
 */
router.put('/team-unavailability/:id', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    const { id } = req.params;
    const { startAt, endAt, reason, scope, notes } = req.body;

    const period = await teamUnavailabilityService.update(id, {
      ...(startAt && { startAt: new Date(startAt) }),
      ...(endAt && { endAt: new Date(endAt) }),
      ...(reason && { reason }),
      ...(scope && { scope }),
      ...(notes !== undefined && { notes }),
    });

    res.json(period);
  } catch (error: any) {
    console.error('Error updating unavailability:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Delete an unavailability period (Master only)
 */
router.delete('/team-unavailability/:id', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    const { id } = req.params;
    await teamUnavailabilityService.delete(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting unavailability:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Check if a team member is unavailable at a specific date/time
 */
router.post('/team-members/:teamMemberId/unavailability/check', authMiddleware, async (req, res) => {
  try {
    const { teamMemberId } = req.params;
    const { dateTime } = req.body;
    
    if (!dateTime) {
      return res.status(400).json({ error: 'dateTime is required' });
    }

    const date = new Date(dateTime);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid dateTime format' });
    }

    const isUnavailable = await teamUnavailabilityService.isUnavailable(teamMemberId, date);
    res.json({ isUnavailable, teamMemberId, dateTime: date.toISOString() });
  } catch (error: any) {
    console.error('Error checking unavailability:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get conflicting unavailability periods for a date range
 */
router.post('/team-members/:teamMemberId/unavailability/conflicts', authMiddleware, async (req, res) => {
  try {
    const { teamMemberId } = req.params;
    const { startAt, endAt } = req.body;
    
    if (!startAt || !endAt) {
      return res.status(400).json({ error: 'startAt and endAt are required' });
    }

    const conflicts = await teamUnavailabilityService.getConflicts(
      teamMemberId,
      new Date(startAt),
      new Date(endAt)
    );

    res.json({ teamMemberId, conflicts });
  } catch (error: any) {
    console.error('Error checking conflicts:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
