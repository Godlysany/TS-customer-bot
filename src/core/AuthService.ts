import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../infrastructure/supabase';
import { toCamelCase } from '../infrastructure/mapper';

const JWT_SECRET = process.env.JWT_SECRET || 'jwt-production-secret-change-immediately';
const JWT_EXPIRES_IN = '4h'; // Increased from 15m to 4 hours for better UX
const REFRESH_TOKEN_EXPIRES_IN = '30d'; // Increased from 7d to 30 days
const BCRYPT_ROUNDS = 10;

export interface AuthAgent {
  id: string;
  name: string;
  email: string;
  role: 'master' | 'support';
  isActive: boolean;
}

export interface LoginResponse {
  agent: AuthAgent;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateAccessToken(agent: AuthAgent): string {
    return jwt.sign(
      { 
        id: agent.id, 
        email: agent.email, 
        role: agent.role 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  generateRefreshToken(agent: AuthAgent): string {
    return jwt.sign(
      { 
        id: agent.id, 
        email: agent.email 
      },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new Error('Invalid email or password');
    }

    const isValidPassword = await this.comparePassword(password, data.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    const agent: AuthAgent = {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      isActive: data.is_active,
    };

    const accessToken = this.generateAccessToken(agent);
    const refreshToken = this.generateRefreshToken(agent);

    return { agent, accessToken, refreshToken };
  }

  async getAgentById(id: string): Promise<AuthAgent | null> {
    const { data, error } = await supabase
      .from('agents')
      .select('id, name, email, role, is_active')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return toCamelCase(data) as AuthAgent;
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const decoded = this.verifyToken(refreshToken);
    const agent = await this.getAgentById(decoded.id);

    if (!agent) {
      throw new Error('Agent not found or inactive');
    }

    return this.generateAccessToken(agent);
  }

  async generateResetToken(email: string): Promise<string> {
    const { data, error } = await supabase
      .from('agents')
      .select('id')
      .eq('email', email)
      .single();

    if (error || !data) {
      throw new Error('Email not found');
    }

    const resetToken = jwt.sign({ id: data.id }, JWT_SECRET, { expiresIn: '1h' });
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await supabase
      .from('agents')
      .update({ 
        reset_token: resetToken,
        reset_token_expires: expiresAt.toISOString()
      })
      .eq('id', data.id);

    return resetToken;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const decoded = this.verifyToken(token);

    const { data, error } = await supabase
      .from('agents')
      .select('reset_token, reset_token_expires')
      .eq('id', decoded.id)
      .single();

    if (error || !data) {
      throw new Error('Invalid reset token');
    }

    if (data.reset_token !== token) {
      throw new Error('Invalid reset token');
    }

    if (new Date(data.reset_token_expires) < new Date()) {
      throw new Error('Reset token has expired');
    }

    const passwordHash = await this.hashPassword(newPassword);

    await supabase
      .from('agents')
      .update({ 
        password_hash: passwordHash,
        reset_token: null,
        reset_token_expires: null
      })
      .eq('id', decoded.id);
  }
}

export default new AuthService();
