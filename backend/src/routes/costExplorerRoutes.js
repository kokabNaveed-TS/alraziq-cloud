import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Monthly cost breakdown for the current user (or all, if admin)
router.get('/monthly', async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';

    const sql = isAdmin
      ? `SELECT DATE_FORMAT(paid_at, '%Y-%m') AS month, SUM(amount) AS total
         FROM payments
         WHERE status = 'succeeded'
         GROUP BY month
         ORDER BY month DESC
         LIMIT 12`
      : `SELECT DATE_FORMAT(paid_at, '%Y-%m') AS month, SUM(amount) AS total
         FROM payments
         WHERE status = 'succeeded' AND user_id = ?
         GROUP BY month
         ORDER BY month DESC
         LIMIT 12`;

    const params = isAdmin ? [] : [req.user.id];
    const [rows] = await pool.query(sql, params);

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
