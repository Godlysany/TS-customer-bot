"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./infrastructure/config");
const routes_1 = __importDefault(require("./api/routes"));
const auth_1 = __importDefault(require("./api/auth"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL
        : ['http://localhost:5000', 'http://127.0.0.1:5000'],
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use('/auth', auth_1.default);
app.use(routes_1.default);
const adminDistPath = path_1.default.join(__dirname, '../admin/dist');
app.use(express_1.default.static(adminDistPath));
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/health') && !req.path.startsWith('/auth')) {
        res.sendFile(path_1.default.join(adminDistPath, 'index.html'));
    }
});
app.listen(config_1.config.port, config_1.config.host, () => {
    console.log(`✅ CRM API server running on ${config_1.config.host}:${config_1.config.port}`);
    console.log(`📱 Frontend served from ${adminDistPath}`);
});
exports.default = app;
