import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './infrastructure/config';
import routes from './api/routes';
import authRoutes from './api/auth';
import botConfigRoutes from './api/bot-config';
import customersRoutes from './api/customers';
import questionnaireResponsesRoutes from './api/questionnaire-responses';
import servicesRoutes from './api/services';
import engagementRoutes from './api/engagement';
import recurringRoutes from './api/recurring';
import multiServiceRoutes from './api/multi-service';
import { reminderScheduler } from './core/ReminderScheduler';
import { startEngagementScheduler, stopEngagementScheduler } from './core/EngagementScheduler';
import { startRecurringScheduler, stopRecurringScheduler } from './core/RecurringAppointmentScheduler';

// Validate critical environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ FATAL: Missing required environment variables:', missingEnvVars.join(', '));
  console.error('   Server cannot start without these. Please check Railway environment settings.');
  process.exit(1);
}

console.log('✅ Environment variables validated');

const app = express();

app.use(cors({
  origin: true, // Allow all origins (frontend served from same domain on Railway)
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/version', (req, res) => {
  const fs = require('fs');
  const versionPath = path.join(adminDistPath, 'version.json');
  try {
    const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    res.json(version);
  } catch (err) {
    res.json({ error: 'Version file not found', adminDistPath });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/bot-config', botConfigRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/questionnaire-responses', questionnaireResponsesRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/engagement', engagementRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/multi-service', multiServiceRoutes);
app.use(routes);

const adminDistPath = path.join(__dirname, '../admin/dist');

// Serve static files with no-cache headers to prevent Railway CDN caching
app.use(express.static(adminDistPath, {
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
    res.sendFile(path.join(adminDistPath, 'index.html'));
  }
});

console.log(`🚀 Starting server on ${config.host}:${config.port}...`);

const server = app.listen(config.port, config.host, () => {
  const fs = require('fs');
  console.log(`✅ CRM API server running on ${config.host}:${config.port}`);
  console.log(`📱 Frontend served from ${adminDistPath}`);
  console.log(`🔗 Health check: http://${config.host}:${config.port}/health`);
  console.log(`🔑 Auth endpoint: http://${config.host}:${config.port}/api/auth/login`);
  
  // Debug: Check what files exist in admin/dist
  try {
    const distExists = fs.existsSync(adminDistPath);
    console.log(`📂 Admin dist exists: ${distExists}`);
    if (distExists) {
      const files = fs.readdirSync(adminDistPath);
      console.log(`📄 Files in admin/dist:`, files);
      const assetsPath = path.join(adminDistPath, 'assets');
      if (fs.existsSync(assetsPath)) {
        const assets = fs.readdirSync(assetsPath);
        console.log(`📦 Assets in admin/dist/assets:`, assets);
      }
    }
  } catch (err) {
    console.error(`❌ Error checking admin/dist:`, err);
  }

  // Start reminder scheduler (checks every 5 minutes)
  reminderScheduler.start(5);
  
  // Start engagement scheduler (checks every 60 minutes)
  startEngagementScheduler(60);
  
  // Start recurring appointment scheduler (checks daily - 1440 minutes)
  startRecurringScheduler(1440);
});

server.on('error', (error: any) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`   Port ${config.port} is already in use!`);
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
  reminderScheduler.stop();
  stopEngagementScheduler();
  stopRecurringScheduler();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;
