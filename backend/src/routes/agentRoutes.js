import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  listAgents, getAgent, createAgent, updateAgent, deleteAgent,
  testAgent, pollAgent, fetchAgentLogs, getStoredLogs,
  getMetricHistory, sseStream, adminListAllAgents,
} from '../controllers/agentController.js';

const router = Router();
router.use(authenticate);

// My agents
router.get('/',           listAgents);
router.get('/:id',        getAgent);
router.post('/',          createAgent);
router.put('/:id',        updateAgent);
router.delete('/:id',     deleteAgent);

// Actions on an agent
router.post('/test',         testAgent);          // test before saving (body params)
router.post('/:id/test',     testAgent);          // test saved agent
router.get('/:id/poll',      pollAgent);          // one-shot metric collection
router.get('/:id/stream',    sseStream);          // SSE live stream
router.get('/:id/logs',      fetchAgentLogs);     // fetch + store fresh logs from machine
router.get('/:id/logs/stored', getStoredLogs);    // read stored logs from DB
router.get('/:id/history',   getMetricHistory);   // metric history chart data

// Admin only: see all users' agents
router.get('/admin/all', authorize('admin'), adminListAllAgents);

export default router;
