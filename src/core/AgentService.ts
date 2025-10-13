import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toCamelCaseArray } from '../infrastructure/mapper';
import authService from './AuthService';

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: 'master' | 'support';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentDto {
  name: string;
  email: string;
  password: string;
  role: 'master' | 'support';
}

export interface UpdateAgentDto {
  name?: string;
  email?: string;
  password?: string;
  role?: 'master' | 'support';
  isActive?: boolean;
}

export class AgentService {
  async getAllAgents(): Promise<Agent[]> {
    const { data, error } = await supabase
      .from('agents')
      .select('id, name, email, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return toCamelCaseArray(data || []) as Agent[];
  }

  async getAgentById(id: string): Promise<Agent | null> {
    const { data, error } = await supabase
      .from('agents')
      .select('id, name, email, role, is_active, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return toCamelCase(data) as Agent;
  }

  async createAgent(dto: CreateAgentDto): Promise<Agent> {
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('email', dto.email)
      .single();

    if (existingAgent) {
      throw new Error('Agent with this email already exists');
    }

    const passwordHash = await authService.hashPassword(dto.password);

    const { data, error } = await supabase
      .from('agents')
      .insert({
        name: dto.name,
        email: dto.email,
        password_hash: passwordHash,
        role: dto.role,
        is_active: true,
      })
      .select('id, name, email, role, is_active, created_at, updated_at')
      .single();

    if (error) throw error;
    return toCamelCase(data) as Agent;
  }

  async updateAgent(id: string, dto: UpdateAgentDto): Promise<Agent> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.isActive !== undefined) updateData.is_active = dto.isActive;

    if (dto.password) {
      updateData.password_hash = await authService.hashPassword(dto.password);
    }

    const { data, error } = await supabase
      .from('agents')
      .update(updateData)
      .eq('id', id)
      .select('id, name, email, role, is_active, created_at, updated_at')
      .single();

    if (error) throw error;
    return toCamelCase(data) as Agent;
  }

  async deleteAgent(id: string): Promise<void> {
    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async deactivateAgent(id: string): Promise<void> {
    const { error } = await supabase
      .from('agents')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  async activateAgent(id: string): Promise<void> {
    const { error } = await supabase
      .from('agents')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }
}

export default new AgentService();
