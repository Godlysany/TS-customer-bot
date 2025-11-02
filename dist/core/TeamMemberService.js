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
     * Get team members who can provide a specific service (via service_team_members junction table)
     */
    async getAvailableForService(serviceId) {
        const { data, error } = await supabase_1.supabase
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
            .map((mapping) => mapping.team_member)
            .filter((tm) => tm && tm.is_active)
            .map(mapper_1.toCamelCase);
        return teamMembers;
    }
    /**
     * Assign a team member to a service
     */
    async assignToService(teamMemberId, serviceId, isPrimary = false) {
        const { error } = await supabase_1.supabase
            .from('service_team_members')
            .insert((0, mapper_1.toSnakeCase)({
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
    async removeFromService(teamMemberId, serviceId) {
        const { error } = await supabase_1.supabase
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
    async updateServiceTeamMembers(serviceId, teamMemberIds) {
        // Delete existing mappings
        await supabase_1.supabase
            .from('service_team_members')
            .delete()
            .eq('service_id', serviceId);
        // Insert new mappings
        if (teamMemberIds.length > 0) {
            const { error } = await supabase_1.supabase
                .from('service_team_members')
                .insert(teamMemberIds.map(teamMemberId => (0, mapper_1.toSnakeCase)({
                serviceId,
                teamMemberId,
                isPrimaryProvider: false,
            })));
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
