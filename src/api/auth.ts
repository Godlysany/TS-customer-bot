import { Router } from 'express';
import authService from '../core/AuthService';
import agentService from '../core/AgentService';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { agent, accessToken, refreshToken } = await authService.login(email, password);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours instead of 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ agent });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const agent = await authService.getAgentById(req.agent!.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json({ agent });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const accessToken = await authService.refreshAccessToken(refreshToken);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours instead of 15 minutes
    });

    res.json({ message: 'Token refreshed' });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    await authService.generateResetToken(email);

    res.json({ message: 'Password reset instructions sent to email' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    await authService.resetPassword(token, password);

    res.json({ message: 'Password reset successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/agents', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    const agents = await agentService.getAllAgents();
    res.json(agents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/agents/:id', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    const agent = await agentService.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(agent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/agents', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (!['master', 'support'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either master or support' });
    }

    const agent = await agentService.createAgent({ name, email, password, role });
    res.status(201).json(agent);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/agents/:id', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    const { name, email, password, role, isActive } = req.body;

    if (password && password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (role && !['master', 'support'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either master or support' });
    }

    const agent = await agentService.updateAgent(req.params.id, {
      name,
      email,
      password,
      role,
      isActive,
    });

    res.json(agent);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/agents/:id', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    await agentService.deleteAgent(req.params.id);
    res.json({ message: 'Agent deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/agents/:id/deactivate', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    await agentService.deactivateAgent(req.params.id);
    res.json({ message: 'Agent deactivated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/agents/:id/activate', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    await agentService.activateAgent(req.params.id);
    res.json({ message: 'Agent activated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
