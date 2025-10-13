"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authMiddleware = void 0;
const AuthService_1 = __importDefault(require("../core/AuthService"));
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken;
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const decoded = AuthService_1.default.verifyToken(token);
        const agent = await AuthService_1.default.getAgentById(decoded.id);
        if (!agent) {
            return res.status(401).json({ error: 'Invalid authentication' });
        }
        req.agent = {
            id: agent.id,
            email: agent.email,
            role: agent.role,
        };
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};
exports.authMiddleware = authMiddleware;
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.agent) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.agent.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};
exports.requireRole = requireRole;
