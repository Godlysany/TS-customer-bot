import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './infrastructure/config';
import routes from './api/routes';
import authRoutes from './api/auth';

const app = express();

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : 'http://localhost:5000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use(routes);

const adminDistPath = path.join(__dirname, '../admin/dist');
app.use(express.static(adminDistPath));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/health') && !req.path.startsWith('/auth')) {
    res.sendFile(path.join(adminDistPath, 'index.html'));
  }
});

app.listen(config.port, config.host, () => {
  console.log(`✅ CRM API server running on ${config.host}:${config.port}`);
  console.log(`📱 Frontend served from ${adminDistPath}`);
});

export default app;
