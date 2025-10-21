"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const bot_config_1 = __importDefault(require("./api/bot-config"));
const customers_1 = __importDefault(require("./api/customers"));
const questionnaire_responses_1 = __importDefault(require("./api/questionnaire-responses"));
const services_1 = __importDefault(require("./api/services"));
const engagement_1 = __importDefault(require("./api/engagement"));
const recurring_1 = __importDefault(require("./api/recurring"));
const multi_service_1 = __importDefault(require("./api/multi-service"));
const documents_1 = __importDefault(require("./api/documents"));
const no_show_1 = __importDefault(require("./api/no-show"));
const payments_1 = __importDefault(require("./api/payments"));
const message_approval_1 = __importDefault(require("./api/message-approval"));
const ReminderScheduler_1 = require("./core/ReminderScheduler");
const EngagementScheduler_1 = require("./core/EngagementScheduler");
const RecurringAppointmentScheduler_1 = require("./core/RecurringAppointmentScheduler");
const DocumentScheduler_1 = __importDefault(require("./core/DocumentScheduler"));
const NoShowScheduler_1 = __importDefault(require("./core/NoShowScheduler"));
// Validate critical environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    console.error('❌ FATAL: Missing required environment variables:', missingEnvVars.join(', '));
    console.error('   Server cannot start without these. Please check Railway environment settings.');
    process.exit(1);
}
console.log('✅ Environment variables validated');
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: true, // Allow all origins (frontend served from same domain on Railway)
    credentials: true,
}));
// CRITICAL: Stripe webhook endpoint requires raw body for signature verification
// Must be registered BEFORE express.json() middleware
app.use('/api/payments/webhook', express_1.default.raw({ type: 'application/json' }));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/version', (req, res) => {
    const fs = require('fs');
    const versionPath = path_1.default.join(adminDistPath, 'version.json');
    try {
        const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
        res.json(version);
    }
    catch (err) {
        res.json({ error: 'Version file not found', adminDistPath });
    }
});
app.use('/api/auth', auth_1.default);
app.use('/api/bot-config', bot_config_1.default);
app.use('/api/customers', customers_1.default);
app.use('/api/questionnaire-responses', questionnaire_responses_1.default);
app.use('/api/services', services_1.default);
app.use('/api/engagement', engagement_1.default);
app.use('/api/recurring', recurring_1.default);
app.use('/api/multi-service', multi_service_1.default);
app.use('/api/documents', documents_1.default);
app.use('/api/no-show', no_show_1.default);
app.use('/api/payments', payments_1.default);
app.use('/api/message-approval', message_approval_1.default);
app.use(routes_1.default);
const adminDistPath = path_1.default.join(__dirname, '../admin/dist');
// Serve static files with no-cache headers to prevent Railway CDN caching
app.use(express_1.default.static(adminDistPath, {
    setHeaders: (res, path) => {
        // Prevent caching of HTML and JS files
        if (path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
        // Force no-cache on index.html
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(path_1.default.join(adminDistPath, 'index.html'));
    }
});
console.log(`🚀 Starting server on ${config_1.config.host}:${config_1.config.port}...`);
const server = app.listen(config_1.config.port, config_1.config.host, () => {
    const fs = require('fs');
    console.log(`✅ CRM API server running on ${config_1.config.host}:${config_1.config.port}`);
    console.log(`📱 Frontend served from ${adminDistPath}`);
    console.log(`🔗 Health check: http://${config_1.config.host}:${config_1.config.port}/health`);
    console.log(`🔑 Auth endpoint: http://${config_1.config.host}:${config_1.config.port}/api/auth/login`);
    // Debug: Check what files exist in admin/dist
    try {
        const distExists = fs.existsSync(adminDistPath);
        console.log(`📂 Admin dist exists: ${distExists}`);
        if (distExists) {
            const files = fs.readdirSync(adminDistPath);
            console.log(`📄 Files in admin/dist:`, files);
            const assetsPath = path_1.default.join(adminDistPath, 'assets');
            if (fs.existsSync(assetsPath)) {
                const assets = fs.readdirSync(assetsPath);
                console.log(`📦 Assets in admin/dist/assets:`, assets);
            }
        }
    }
    catch (err) {
        console.error(`❌ Error checking admin/dist:`, err);
    }
    // Start reminder scheduler (checks every 5 minutes)
    ReminderScheduler_1.reminderScheduler.start(5);
    // Start engagement scheduler (checks every 60 minutes)
    (0, EngagementScheduler_1.startEngagementScheduler)(60);
    // Start recurring appointment scheduler (checks daily - 1440 minutes)
    (0, RecurringAppointmentScheduler_1.startRecurringScheduler)(1440);
    // Start document scheduler (checks every 60 minutes)
    DocumentScheduler_1.default.start(60);
    // Start no-show scheduler (checks every 60 minutes)
    NoShowScheduler_1.default.start(60);
    // Auto-reconnect WhatsApp if credentials exist
    const authInfoPath = path_1.default.join(__dirname, '../auth_info');
    if (fs.existsSync(authInfoPath)) {
        console.log('📱 WhatsApp credentials found - auto-reconnecting...');
        Promise.resolve().then(() => __importStar(require('./adapters/whatsapp'))).then(({ startSock }) => {
            startSock().catch((err) => {
                console.error('❌ WhatsApp auto-reconnect failed:', err);
            });
        });
    }
    else {
        console.log('📱 No WhatsApp credentials - connect via Settings page');
    }
    // Initialize Google Calendar if credentials exist
    Promise.resolve().then(() => __importStar(require('./infrastructure/GoogleCalendarClient'))).then(({ GoogleCalendarClient }) => {
        Promise.resolve().then(() => __importStar(require('./core/BookingService'))).then(({ default: bookingService }) => {
            try {
                const calendarClient = new GoogleCalendarClient();
                calendarClient.initialize().then((initialized) => {
                    if (initialized) {
                        bookingService.setCalendarProvider(calendarClient);
                        console.log('📅 Google Calendar provider initialized');
                    }
                    else {
                        console.log('📅 Google Calendar not connected - connect via Settings page');
                    }
                }).catch((err) => {
                    console.warn('⚠️ Could not initialize Google Calendar:', err.message);
                });
            }
            catch (err) {
                console.warn('⚠️ Google Calendar initialization skipped:', err.message);
            }
        });
    });
});
server.on('error', (error) => {
    console.error('❌ Server error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`   Port ${config_1.config.port} is already in use!`);
    }
    process.exit(1);
});
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
process.on('SIGTERM', () => {
    console.log('⚠️  SIGTERM received, closing server...');
    ReminderScheduler_1.reminderScheduler.stop();
    (0, EngagementScheduler_1.stopEngagementScheduler)();
    (0, RecurringAppointmentScheduler_1.stopRecurringScheduler)();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
exports.default = app;
