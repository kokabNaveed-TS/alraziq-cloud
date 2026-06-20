import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes        from './routes/authRoutes.js';
import dashboardRoutes   from './routes/dashboardRoutes.js';
import instanceRoutes    from './routes/instanceRoutes.js';
import containerRoutes   from './routes/containerRoutes.js';
import functionRoutes    from './routes/functionRoutes.js';
import objectRoutes      from './routes/objectRoutes.js';
import volumeRoutes      from './routes/volumeRoutes.js';
import backupRoutes      from './routes/backupRoutes.js';
import metricRoutes      from './routes/metricRoutes.js';
import alertRoutes       from './routes/alertRoutes.js';
import logRoutes         from './routes/logRoutes.js';
import userRoutes        from './routes/userRoutes.js';
import roleRoutes        from './routes/roleRoutes.js';
import policyRoutes      from './routes/policyRoutes.js';
import invoiceRoutes     from './routes/invoiceRoutes.js';
import paymentRoutes     from './routes/paymentRoutes.js';
import costExplorerRoutes from './routes/costExplorerRoutes.js';
import apiKeyRoutes      from './routes/apiKeyRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import profileRoutes     from './routes/profileRoutes.js';
import agentRoutes       from './routes/agentRoutes.js';

import { notFound, errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth',           authRoutes);
app.use('/api/dashboard',      dashboardRoutes);
app.use('/api/instances',      instanceRoutes);
app.use('/api/containers',     containerRoutes);
app.use('/api/functions',      functionRoutes);
app.use('/api/objects',        objectRoutes);
app.use('/api/volumes',        volumeRoutes);
app.use('/api/backups',        backupRoutes);
app.use('/api/metrics',        metricRoutes);
app.use('/api/alerts',         alertRoutes);
app.use('/api/logs',           logRoutes);
app.use('/api/users',          userRoutes);
app.use('/api/roles',          roleRoutes);
app.use('/api/policies',       policyRoutes);
app.use('/api/invoices',       invoiceRoutes);
app.use('/api/payments',       paymentRoutes);
app.use('/api/cost-explorer',  costExplorerRoutes);
app.use('/api/api-keys',       apiKeyRoutes);
app.use('/api/notifications',  notificationRoutes);
app.use('/api/profile',        profileRoutes);
app.use('/api/agents',         agentRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
