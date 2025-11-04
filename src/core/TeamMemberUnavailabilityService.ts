import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';

export type UnavailabilityReason = 'vacation' | 'sick_leave' | 'training' | 'personal' | 'emergency' | 'other';
export type UnavailabilityScope = 'all' | 'partial';

export interface TeamMemberUnavailability {
  id: string;
  teamMemberId: string;
  startAt: Date;
  endAt: Date;
  reason: UnavailabilityReason;
  scope: UnavailabilityScope;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUnavailabilityInput {
  teamMemberId: string;
  startAt: Date;
  endAt: Date;
  reason: UnavailabilityReason;
  scope?: UnavailabilityScope;
  notes?: string;
}

export interface UpdateUnavailabilityInput {
  startAt?: Date;
  endAt?: Date;
  reason?: UnavailabilityReason;
  scope?: UnavailabilityScope;
  notes?: string;
}

export class TeamMemberUnavailabilityService {
  /**
   * Get all unavailability periods for a specific team member
   */
  async getByTeamMember(teamMemberId: string, activeOnly: boolean = false): Promise<TeamMemberUnavailability[]> {
    let query = supabase
      .from('team_member_unavailability')
      .select('*')
      .eq('team_member_id', teamMemberId)
      .order('start_at', { ascending: true });

    if (activeOnly) {
      query = query.gte('end_at', new Date().toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch team member unavailability:', error);
      throw new Error(`Failed to fetch unavailability periods: ${error.message}`);
    }

    return (data || []).map(toCamelCase) as TeamMemberUnavailability[];
  }

  /**
   * Get all upcoming unavailability periods across all team members
   */
  async getAllUpcoming(): Promise<TeamMemberUnavailability[]> {
    const { data, error } = await supabase
      .from('team_member_unavailability')
      .select('*')
      .gte('end_at', new Date().toISOString())
      .order('start_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch upcoming unavailability:', error);
      throw new Error(`Failed to fetch unavailability periods: ${error.message}`);
    }

    return (data || []).map(toCamelCase) as TeamMemberUnavailability[];
  }

  /**
   * Get a specific unavailability period by ID
   */
  async getById(id: string): Promise<TeamMemberUnavailability | null> {
    const { data, error } = await supabase
      .from('team_member_unavailability')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch unavailability:', error);
      throw new Error(`Failed to fetch unavailability: ${error.message}`);
    }

    return data ? (toCamelCase(data) as TeamMemberUnavailability) : null;
  }

  /**
   * Create a new unavailability period
   */
  async create(input: CreateUnavailabilityInput): Promise<TeamMemberUnavailability> {
    // Validate dates
    if (input.endAt <= input.startAt) {
      throw new Error('End date must be after start date');
    }

    // Validate team member exists
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('id', input.teamMemberId)
      .maybeSingle();

    if (!teamMember) {
      throw new Error('Team member not found');
    }

    // Check for overlapping unavailability periods
    const { data: overlaps } = await supabase
      .from('team_member_unavailability')
      .select('id, start_at, end_at, reason')
      .eq('team_member_id', input.teamMemberId)
      .lt('start_at', input.endAt.toISOString())
      .gt('end_at', input.startAt.toISOString());

    if (overlaps && overlaps.length > 0) {
      throw new Error(`This period overlaps with existing unavailability (${overlaps[0].reason})`);
    }

    const unavailabilityData: any = {
      team_member_id: input.teamMemberId,
      start_at: input.startAt.toISOString(),
      end_at: input.endAt.toISOString(),
      reason: input.reason,
      scope: input.scope || 'all',
      notes: input.notes || null,
    };

    const { data, error } = await supabase
      .from('team_member_unavailability')
      .insert(unavailabilityData)
      .select()
      .single();

    if (error) {
      console.error('Failed to create unavailability:', error);
      throw new Error(`Failed to create unavailability: ${error.message}`);
    }

    console.log(`✅ Team member unavailability created: ${input.reason} (${data.id})`);
    return toCamelCase(data) as TeamMemberUnavailability;
  }

  /**
   * Update an unavailability period
   */
  async update(id: string, input: UpdateUnavailabilityInput): Promise<TeamMemberUnavailability> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Unavailability period not found');
    }

    const startAt = input.startAt || existing.startAt;
    const endAt = input.endAt || existing.endAt;

    // Validate dates
    if (endAt <= startAt) {
      throw new Error('End date must be after start date');
    }

    // Check for overlapping periods (excluding current one)
    if (input.startAt || input.endAt) {
      const { data: overlaps } = await supabase
        .from('team_member_unavailability')
        .select('id, start_at, end_at, reason')
        .eq('team_member_id', existing.teamMemberId)
        .neq('id', id)
        .lt('start_at', endAt.toISOString())
        .gt('end_at', startAt.toISOString());

      if (overlaps && overlaps.length > 0) {
        throw new Error(`This period would overlap with existing unavailability (${overlaps[0].reason})`);
      }
    }

    const updateData: any = {
      ...(input.startAt && { start_at: input.startAt.toISOString() }),
      ...(input.endAt && { end_at: input.endAt.toISOString() }),
      ...(input.reason && { reason: input.reason }),
      ...(input.scope && { scope: input.scope }),
      ...(input.notes !== undefined && { notes: input.notes || null }),
    };

    const { data, error } = await supabase
      .from('team_member_unavailability')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update unavailability:', error);
      throw new Error(`Failed to update unavailability: ${error.message}`);
    }

    console.log(`✅ Team member unavailability updated: ${id}`);
    return toCamelCase(data) as TeamMemberUnavailability;
  }

  /**
   * Delete an unavailability period
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('team_member_unavailability')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete unavailability:', error);
      throw new Error(`Failed to delete unavailability: ${error.message}`);
    }

    console.log(`✅ Team member unavailability deleted: ${id}`);
  }

  /**
   * Check if a team member is unavailable at a specific date/time
   */
  async isUnavailable(teamMemberId: string, dateTime: Date): Promise<boolean> {
    const { data, error } = await supabase
      .from('team_member_unavailability')
      .select('id, scope')
      .eq('team_member_id', teamMemberId)
      .eq('scope', 'all') // Only check complete unavailability
      .lte('start_at', dateTime.toISOString())
      .gte('end_at', dateTime.toISOString())
      .maybeSingle();

    if (error) {
      console.error('Failed to check unavailability:', error);
      return false; // Gracefully degrade
    }

    return !!data;
  }

  /**
   * Get conflicting unavailability periods for a date range
   */
  async getConflicts(
    teamMemberId: string,
    startAt: Date,
    endAt: Date
  ): Promise<TeamMemberUnavailability[]> {
    const { data, error } = await supabase
      .from('team_member_unavailability')
      .select('*')
      .eq('team_member_id', teamMemberId)
      .eq('scope', 'all')
      .lt('start_at', endAt.toISOString())
      .gt('end_at', startAt.toISOString());

    if (error) {
      console.error('Failed to fetch conflicts:', error);
      throw new Error(`Failed to check conflicts: ${error.message}`);
    }

    return (data || []).map(toCamelCase) as TeamMemberUnavailability[];
  }
}

export default new TeamMemberUnavailabilityService();
