"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./infrastructure/config");
const routes_1 = __importDefault(require("./api/routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(routes_1.default);
const adminDistPath = path_1.default.join(__dirname, '../admin/dist');
app.use(express_1.default.static(adminDistPath));
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
        res.sendFile(path_1.default.join(adminDistPath, 'index.html'));
    }
});
app.listen(config_1.config.port, config_1.config.host, () => {
    console.log(`✅ CRM API server running on ${config_1.config.host}:${config_1.config.port}`);
    console.log(`📱 Frontend served from ${adminDistPath}`);
});
exports.default = app;
