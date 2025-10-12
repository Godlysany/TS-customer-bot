import express from 'express';
import cors from 'cors';
import { config } from './infrastructure/config';
import routes from './api/routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use(routes);

app.listen(config.port, config.host, () => {
  console.log(`✅ CRM API server running on ${config.host}:${config.port}`);
});

export default app;
