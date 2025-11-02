import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  calendarId: string;
  availabilitySchedule: Record<string, Array<{ start: string; end: string }>>;
  defaultBufferBeforeMinutes: number;
  defaultBufferAfterMinutes: number;
  isActive: boolean;
  displayOrder: number;
  color?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTeamMemberInput {
  name: string;
  email: string;
  phone?: string;
  role?: string;
  calendarId: string;
  availabilitySchedule?: Record<string, Array<{ start: string; end: string }>>;
  defaultBufferBeforeMinutes?: number;
  defaultBufferAfterMinutes?: number;
  color?: string;
  notes?: string;
}

export interface UpdateTeamMemberInput {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  calendarId?: string;
  availabilitySchedule?: Record<string, Array<{ start: string; end: string }>>;
  defaultBufferBeforeMinutes?: number;
  defaultBufferAfterMinutes?: number;
  isActive?: boolean;
  displayOrder?: number;
  color?: string;
  notes?: string;
}

export class TeamMemberService {
  /**
   * Get all team members
   */
  async getAll(activeOnly: boolean = false): Promise<TeamMember[]> {
    let query = supabase
      .from('team_members')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch team members:', error);
      throw new Error(`Failed to fetch team members: ${error.message}`);
    }

    return (data || []).map(toCamelCase) as TeamMember[];
  }

  /**
   * Get a single team member by ID
   */
  async getById(id: string): Promise<TeamMember | null> {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Failed to fetch team member:', error);
      throw new Error(`Failed to fetch team member: ${error.message}`);
    }

    return data ? (toCamelCase(data) as TeamMember) : null;
  }

  /**
   * Create a new team member
   */
  async create(input: CreateTeamMemberInput): Promise<TeamMember> {
    const { data, error } = await supabase
      .from('team_members')
      .insert(toSnakeCase({
        ...input,
        availabilitySchedule: input.availabilitySchedule || {},
        defaultBufferBeforeMinutes: input.defaultBufferBeforeMinutes || 0,
        defaultBufferAfterMinutes: input.defaultBufferAfterMinutes || 0,
        isActive: true,
        displayOrder: 0,
      }))
      .select()
      .single();

    if (error) {
      console.error('Failed to create team member:', error);
      throw new Error(`Failed to create team member: ${error.message}`);
    }

    console.log(`✅ Team member created: ${input.name} (${data.id})`);
    return toCamelCase(data) as TeamMember;
  }

  /**
   * Update a team member
   */
  async update(id: string, input: UpdateTeamMemberInput): Promise<TeamMember> {
    const { data, error } = await supabase
      .from('team_members')
      .update(toSnakeCase({
        ...input,
        updatedAt: new Date().toISOString(),
      }))
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update team member:', error);
      throw new Error(`Failed to update team member: ${error.message}`);
    }

    console.log(`✅ Team member updated: ${id}`);
    return toCamelCase(data) as TeamMember;
  }

  /**
   * Delete a team member (soft delete by setting is_active = false)
   */
  async delete(id: string): Promise<void> {
    const { error} = await supabase
      .from('team_members')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Failed to delete team member:', error);
      throw new Error(`Failed to delete team member: ${error.message}`);
    }

    console.log(`✅ Team member deleted (soft): ${id}`);
  }

  /**
   * Hard delete a team member (permanent removal)
   */
  async hardDelete(id: string): Promise<void> {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to hard delete team member:', error);
      throw new Error(`Failed to hard delete team member: ${error.message}`);
    }

    console.log(`✅ Team member permanently deleted: ${id}`);
  }

  /**
   * Get team members who can provide a specific service
   */
  async getAvailableForService(serviceId: string): Promise<TeamMember[]> {
    // Get service to check allowed_team_member_ids
    const { data: service } = await supabase
      .from('services')
      .select('allowed_team_member_ids')
      .eq('id', serviceId)
      .single();

    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    const allowedIds = service.allowed_team_member_ids || [];

    // If no restrictions, return all active team members
    if (allowedIds.length === 0) {
      return this.getAll(true);
    }

    // Return only allowed team members
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .in('id', allowedIds)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to fetch available team members:', error);
      throw new Error(`Failed to fetch available team members: ${error.message}`);
    }

    return (data || []).map(toCamelCase) as TeamMember[];
  }

  /**
   * Check if team member is available at a specific date/time
   */
  async isAvailable(teamMemberId: string, dateTime: Date): Promise<boolean> {
    const teamMember = await this.getById(teamMemberId);
    if (!teamMember || !teamMember.isActive) {
      return false;
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[dateTime.getDay()];
    const hours = String(dateTime.getHours()).padStart(2, '0');
    const minutes = String(dateTime.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    const schedule = teamMember.availabilitySchedule[dayOfWeek] || [];
    
    // If no schedule defined for this day, assume unavailable
    if (schedule.length === 0) {
      return false;
    }

    // Check if time falls within any availability window
    return schedule.some(window => {
      return timeStr >= window.start && timeStr <= window.end;
    });
  }

  /**
   * Get team member's bookings for a specific date range
   */
  async getBookings(teamMemberId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, services(name, duration_minutes), contacts(name, phone_number)')
      .eq('team_member_id', teamMemberId)
      .in('status', ['confirmed', 'pending'])
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Failed to fetch team member bookings:', error);
      throw new Error(`Failed to fetch team member bookings: ${error.message}`);
    }

    return (data || []).map(toCamelCase) as TeamMember[];
  }
}

export default new TeamMemberService();
