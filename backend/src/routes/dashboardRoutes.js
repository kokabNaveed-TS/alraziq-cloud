import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getStats,
  getInstanceGrowth,
  getRevenueTrend,
  getRecentInstances,
} from '../controllers/dashboardController.js';

const router = Router();

router.use(authenticate);

router.get('/stats', getStats);
router.get('/charts/instance-growth', getInstanceGrowth);
router.get('/charts/revenue-trend', getRevenueTrend);
router.get('/recent-instances', getRecentInstances);

export default router;
