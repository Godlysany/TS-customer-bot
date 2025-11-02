import express from 'express';
import teamMemberService from '../core/TeamMemberService';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * Get all team members
 * Query params: active_only=true to filter only active members
 */
router.get('/team-members', authMiddleware, async (req, res) => {
  try {
    const activeOnly = req.query.active_only === 'true';
    const teamMembers = await teamMemberService.getAll(activeOnly);
    res.json(teamMembers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a single team member by ID
 */
router.get('/team-members/:id', authMiddleware, async (req, res) => {
  try {
    const teamMember = await teamMemberService.getById(req.params.id);
    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    res.json(teamMember);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new team member
 */
router.post('/team-members', authMiddleware, async (req, res) => {
  try {
    const teamMember = await teamMemberService.create(req.body);
    res.status(201).json(teamMember);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Update a team member
 */
router.put('/team-members/:id', authMiddleware, async (req, res) => {
  try {
    const teamMember = await teamMemberService.update(req.params.id, req.body);
    res.json(teamMember);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Delete a team member (soft delete)
 */
router.delete('/team-members/:id', authMiddleware, async (req, res) => {
  try {
    await teamMemberService.delete(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get team members available for a specific service
 */
router.get('/team-members/service/:serviceId/available', authMiddleware, async (req, res) => {
  try {
    const teamMembers = await teamMemberService.getAvailableForService(req.params.serviceId);
    res.json(teamMembers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get team member's bookings for a date range
 */
router.get('/team-members/:id/bookings', authMiddleware, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date query params required' });
    }

    const startDate = new Date(start_date as string);
    const endDate = new Date(end_date as string);

    const bookings = await teamMemberService.getBookings(req.params.id, startDate, endDate);
    res.json(bookings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check team member availability for a specific date/time
 */
router.post('/team-members/:id/check-availability', authMiddleware, async (req, res) => {
  try {
    const { date_time } = req.body;
    
    if (!date_time) {
      return res.status(400).json({ error: 'date_time required in request body' });
    }

    const dateTime = new Date(date_time);
    const isAvailable = await teamMemberService.isAvailable(req.params.id, dateTime);
    
    res.json({ available: isAvailable });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
