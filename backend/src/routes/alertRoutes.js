import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { createCrudController } from '../controllers/crudFactory.js';

const base = createCrudController({
  table: 'alerts',
  columns: ['title', 'message', 'severity', 'resource_id', 'is_resolved'],
});

const router = Router();
router.use(authenticate);

router.get('/', base.list);
router.get('/:id', base.getOne);
router.post('/', authorize('admin'), base.create);
router.put('/:id', authorize('admin'), base.update);
router.delete('/:id', authorize('admin'), base.remove);

// Mark alert resolved
router.patch('/:id/resolve', authorize('admin', 'member'), async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `UPDATE alerts SET is_resolved = 1 WHERE id = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Alert not found.' });
    res.json({ message: 'Alert marked as resolved.' });
  } catch (err) {
    next(err);
  }
});

export default router;
