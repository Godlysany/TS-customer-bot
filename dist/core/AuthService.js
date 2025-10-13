"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 10;
class AuthService {
    async hashPassword(password) {
        return bcrypt_1.default.hash(password, BCRYPT_ROUNDS);
    }
    async comparePassword(password, hash) {
        return bcrypt_1.default.compare(password, hash);
    }
    generateAccessToken(agent) {
        return jsonwebtoken_1.default.sign({
            id: agent.id,
            email: agent.email,
            role: agent.role
        }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    }
    generateRefreshToken(agent) {
        return jsonwebtoken_1.default.sign({
            id: agent.id,
            email: agent.email
        }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
    }
    verifyToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
    async login(email, password) {
        const { data, error } = await supabase_1.supabase
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
        const agent = {
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
    async getAgentById(id) {
        const { data, error } = await supabase_1.supabase
            .from('agents')
            .select('id, name, email, role, is_active')
            .eq('id', id)
            .eq('is_active', true)
            .single();
        if (error || !data) {
            return null;
        }
        return (0, mapper_1.toCamelCase)(data);
    }
    async refreshAccessToken(refreshToken) {
        const decoded = this.verifyToken(refreshToken);
        const agent = await this.getAgentById(decoded.id);
        if (!agent) {
            throw new Error('Agent not found or inactive');
        }
        return this.generateAccessToken(agent);
    }
    async generateResetToken(email) {
        const { data, error } = await supabase_1.supabase
            .from('agents')
            .select('id')
            .eq('email', email)
            .single();
        if (error || !data) {
            throw new Error('Email not found');
        }
        const resetToken = jsonwebtoken_1.default.sign({ id: data.id }, JWT_SECRET, { expiresIn: '1h' });
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await supabase_1.supabase
            .from('agents')
            .update({
            reset_token: resetToken,
            reset_token_expires: expiresAt.toISOString()
        })
            .eq('id', data.id);
        return resetToken;
    }
    async resetPassword(token, newPassword) {
        const decoded = this.verifyToken(token);
        const { data, error } = await supabase_1.supabase
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
        await supabase_1.supabase
            .from('agents')
            .update({
            password_hash: passwordHash,
            reset_token: null,
            reset_token_expires: null
        })
            .eq('id', decoded.id);
    }
}
exports.AuthService = AuthService;
exports.default = new AuthService();
