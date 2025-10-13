import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './infrastructure/config';
import routes from './api/routes';
import authRoutes from './api/auth';

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
  console.log(`✅ CRM API server running on ${config.host}:${config.port}`);
  console.log(`📱 Frontend served from ${adminDistPath}`);
  console.log(`🔗 Health check: http://${config.host}:${config.port}/health`);
  console.log(`🔑 Auth endpoint: http://${config.host}:${config.port}/api/auth/login`);
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
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;
