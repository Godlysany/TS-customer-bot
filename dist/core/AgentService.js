"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
const AuthService_1 = __importDefault(require("./AuthService"));
class AgentService {
    async getAllAgents() {
        const { data, error } = await supabase_1.supabase
            .from('agents')
            .select('id, name, email, role, is_active, created_at, updated_at')
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return (0, mapper_1.toCamelCaseArray)(data || []);
    }
    async getAgentById(id) {
        const { data, error } = await supabase_1.supabase
            .from('agents')
            .select('id, name, email, role, is_active, created_at, updated_at')
            .eq('id', id)
            .single();
        if (error || !data)
            return null;
        return (0, mapper_1.toCamelCase)(data);
    }
    async createAgent(dto) {
        const { data: existingAgent } = await supabase_1.supabase
            .from('agents')
            .select('id')
            .eq('email', dto.email)
            .single();
        if (existingAgent) {
            throw new Error('Agent with this email already exists');
        }
        const passwordHash = await AuthService_1.default.hashPassword(dto.password);
        const { data, error } = await supabase_1.supabase
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
        if (error)
            throw error;
        return (0, mapper_1.toCamelCase)(data);
    }
    async updateAgent(id, dto) {
        const updateData = {
            updated_at: new Date().toISOString(),
        };
        if (dto.name !== undefined)
            updateData.name = dto.name;
        if (dto.email !== undefined)
            updateData.email = dto.email;
        if (dto.role !== undefined)
            updateData.role = dto.role;
        if (dto.isActive !== undefined)
            updateData.is_active = dto.isActive;
        if (dto.password) {
            updateData.password_hash = await AuthService_1.default.hashPassword(dto.password);
        }
        const { data, error } = await supabase_1.supabase
            .from('agents')
            .update(updateData)
            .eq('id', id)
            .select('id, name, email, role, is_active, created_at, updated_at')
            .single();
        if (error)
            throw error;
        return (0, mapper_1.toCamelCase)(data);
    }
    async deleteAgent(id) {
        const { error } = await supabase_1.supabase
            .from('agents')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
    }
    async deactivateAgent(id) {
        const { error } = await supabase_1.supabase
            .from('agents')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error)
            throw error;
    }
    async activateAgent(id) {
        const { error } = await supabase_1.supabase
            .from('agents')
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error)
            throw error;
    }
}
exports.AgentService = AgentService;
exports.default = new AgentService();
