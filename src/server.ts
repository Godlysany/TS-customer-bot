import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './infrastructure/config';
import routes from './api/routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use(routes);

const adminDistPath = path.join(__dirname, '../admin/dist');
app.use(express.static(adminDistPath));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
    res.sendFile(path.join(adminDistPath, 'index.html'));
  }
});

app.listen(config.port, config.host, () => {
  console.log(`✅ CRM API server running on ${config.host}:${config.port}`);
  console.log(`📱 Frontend served from ${adminDistPath}`);
});

export default app;
