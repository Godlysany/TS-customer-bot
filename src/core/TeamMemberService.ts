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
    // Validate required fields
    if (!input.name || input.name.trim() === '') {
      throw new Error('Team member name is required');
    }
    if (!input.email || input.email.trim() === '') {
      throw new Error('Team member email is required');
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      throw new Error('Invalid email format');
    }
    
    // Check if email already exists
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('email', input.email.toLowerCase())
      .maybeSingle();
    
    if (existing) {
      throw new Error(`A team member with email ${input.email} already exists`);
    }
    
    // Prepare team member data with defaults for required fields
    const teamMemberData: any = {
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      phone: input.phone || null,
      role: input.role || null,
      // calendar_id is required by database - default to 'primary' for Google Calendar
      calendar_id: input.calendarId || 'primary',
      availability_schedule: input.availabilitySchedule || {},
      default_buffer_before_minutes: input.defaultBufferBeforeMinutes || 0,
      default_buffer_after_minutes: input.defaultBufferAfterMinutes || 0,
      is_active: true,
      display_order: 0,
      // Default color if not provided
      color: input.color || '#3B82F6',
      notes: input.notes || null,
    };

    const { data, error } = await supabase
      .from('team_members')
      .insert(teamMemberData)
      .select()
      .single();

    if (error) {
      console.error('Failed to create team member:', error);
      
      // Provide user-friendly error messages
      if (error.code === '23505') {
        throw new Error('A team member with this email already exists');
      }
      if (error.code === '23502') {
        // Missing required field
        const match = error.message.match(/column "([^"]+)"/);
        const columnName = match ? match[1] : 'required field';
        throw new Error(`Missing required field: ${columnName}`);
      }
      
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
   * Get team members who can provide a specific service (via service_team_members junction table)
   */
  async getAvailableForService(serviceId: string): Promise<TeamMember[]> {
    const { data, error } = await supabase
      .from('service_team_members')
      .select('team_member:team_members(*)')
      .eq('service_id', serviceId);

    if (error) {
      console.error('Failed to fetch team members for service:', error);
      throw new Error(`Failed to fetch team members for service: ${error.message}`);
    }

    // If no mappings exist, return empty array (no team members assigned to this service)
    if (!data || data.length === 0) {
      return [];
    }

    // Extract team members from junction table results and filter active only
    const teamMembers = data
      .map((mapping: any) => mapping.team_member)
      .filter((tm: any) => tm && tm.is_active)
      .map(toCamelCase) as TeamMember[];

    return teamMembers;
  }

  /**
   * Assign a team member to a service
   */
  async assignToService(teamMemberId: string, serviceId: string, isPrimary: boolean = false): Promise<void> {
    const { error } = await supabase
      .from('service_team_members')
      .insert(toSnakeCase({
        teamMemberId,
        serviceId,
        isPrimaryProvider: isPrimary,
      }));

    if (error) {
      // Ignore unique constraint violations (already assigned)
      if (error.code === '23505') {
        console.log(`Team member ${teamMemberId} already assigned to service ${serviceId}`);
        return;
      }
      console.error('Failed to assign team member to service:', error);
      throw new Error(`Failed to assign team member to service: ${error.message}`);
    }

    console.log(`✅ Team member ${teamMemberId} assigned to service ${serviceId}`);
  }

  /**
   * Remove a team member from a service
   */
  async removeFromService(teamMemberId: string, serviceId: string): Promise<void> {
    const { error } = await supabase
      .from('service_team_members')
      .delete()
      .eq('team_member_id', teamMemberId)
      .eq('service_id', serviceId);

    if (error) {
      console.error('Failed to remove team member from service:', error);
      throw new Error(`Failed to remove team member from service: ${error.message}`);
    }

    console.log(`✅ Team member ${teamMemberId} removed from service ${serviceId}`);
  }

  /**
   * Update service team member mappings (bulk update)
   */
  async updateServiceTeamMembers(serviceId: string, teamMemberIds: string[]): Promise<void> {
    // Delete existing mappings
    await supabase
      .from('service_team_members')
      .delete()
      .eq('service_id', serviceId);

    // Insert new mappings
    if (teamMemberIds.length > 0) {
      const { error } = await supabase
        .from('service_team_members')
        .insert(
          teamMemberIds.map(teamMemberId => toSnakeCase({
            serviceId,
            teamMemberId,
            isPrimaryProvider: false,
          }))
        );

      if (error) {
        console.error('Failed to update service team members:', error);
        throw new Error(`Failed to update service team members: ${error.message}`);
      }
    }

    console.log(`✅ Service ${serviceId} team members updated (${teamMemberIds.length} members)`);
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
