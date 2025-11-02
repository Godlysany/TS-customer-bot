"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamMemberService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
class TeamMemberService {
    /**
     * Get all team members
     */
    async getAll(activeOnly = false) {
        let query = supabase_1.supabase
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
        return (data || []).map(mapper_1.toCamelCase);
    }
    /**
     * Get a single team member by ID
     */
    async getById(id) {
        const { data, error } = await supabase_1.supabase
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
        return data ? (0, mapper_1.toCamelCase)(data) : null;
    }
    /**
     * Create a new team member
     */
    async create(input) {
        const { data, error } = await supabase_1.supabase
            .from('team_members')
            .insert((0, mapper_1.toSnakeCase)({
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
        return (0, mapper_1.toCamelCase)(data);
    }
    /**
     * Update a team member
     */
    async update(id, input) {
        const { data, error } = await supabase_1.supabase
            .from('team_members')
            .update((0, mapper_1.toSnakeCase)({
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
        return (0, mapper_1.toCamelCase)(data);
    }
    /**
     * Delete a team member (soft delete by setting is_active = false)
     */
    async delete(id) {
        const { error } = await supabase_1.supabase
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
    async hardDelete(id) {
        const { error } = await supabase_1.supabase
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
    async getAvailableForService(serviceId) {
        // Get service to check allowed_team_member_ids
        const { data: service } = await supabase_1.supabase
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
        const { data, error } = await supabase_1.supabase
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
        return (data || []).map(mapper_1.toCamelCase);
    }
    /**
     * Check if team member is available at a specific date/time
     */
    async isAvailable(teamMemberId, dateTime) {
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
    async getBookings(teamMemberId, startDate, endDate) {
        const { data, error } = await supabase_1.supabase
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
        return (data || []).map(mapper_1.toCamelCase);
    }
}
exports.TeamMemberService = TeamMemberService;
exports.default = new TeamMemberService();
