"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuthService_1 = __importDefault(require("../core/AuthService"));
const AgentService_1 = __importDefault(require("../core/AgentService"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const { agent, accessToken, refreshToken } = await AuthService_1.default.login(email, password);
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000,
        });
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.json({ agent });
    }
    catch (error) {
        res.status(401).json({ error: error.message });
    }
});
router.post('/logout', (req, res) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
});
router.get('/me', auth_1.authMiddleware, async (req, res) => {
    try {
        const agent = await AuthService_1.default.getAgentById(req.agent.id);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        res.json({ agent });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }
        const accessToken = await AuthService_1.default.refreshAccessToken(refreshToken);
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000,
        });
        res.json({ message: 'Token refreshed' });
    }
    catch (error) {
        res.status(401).json({ error: error.message });
    }
});
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        await AuthService_1.default.generateResetToken(email);
        res.json({ message: 'Password reset instructions sent to email' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ error: 'Token and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        await AuthService_1.default.resetPassword(token, password);
        res.json({ message: 'Password reset successfully' });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/agents', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const agents = await AgentService_1.default.getAllAgents();
        res.json(agents);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/agents/:id', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const agent = await AgentService_1.default.getAgentById(req.params.id);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        res.json(agent);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/agents', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: 'Name, email, password, and role are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        if (!['master', 'support'].includes(role)) {
            return res.status(400).json({ error: 'Role must be either master or support' });
        }
        const agent = await AgentService_1.default.createAgent({ name, email, password, role });
        res.status(201).json(agent);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.put('/agents/:id', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const { name, email, password, role, isActive } = req.body;
        if (password && password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        if (role && !['master', 'support'].includes(role)) {
            return res.status(400).json({ error: 'Role must be either master or support' });
        }
        const agent = await AgentService_1.default.updateAgent(req.params.id, {
            name,
            email,
            password,
            role,
            isActive,
        });
        res.json(agent);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.delete('/agents/:id', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        await AgentService_1.default.deleteAgent(req.params.id);
        res.json({ message: 'Agent deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/agents/:id/deactivate', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        await AgentService_1.default.deactivateAgent(req.params.id);
        res.json({ message: 'Agent deactivated successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/agents/:id/activate', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        await AgentService_1.default.activateAgent(req.params.id);
        res.json({ message: 'Agent activated successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
