import { Request, Response, NextFunction } from 'express';
import authService from '../core/AuthService';

export interface AuthRequest extends Request {
  agent?: {
    id: string;
    email: string;
    role: 'master' | 'support';
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies?.accessToken;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = authService.verifyToken(token);
    const agent = await authService.getAgentById(decoded.id);

    if (!agent) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    req.agent = {
      id: agent.id,
      email: agent.email,
      role: agent.role,
    };

    next();
  } catch (error: any) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (...roles: Array<'master' | 'support'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.agent) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.agent.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
