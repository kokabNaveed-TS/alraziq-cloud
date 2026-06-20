import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM roles ORDER BY id ASC`);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Role name is required.' });

    const [result] = await pool.query(
      `INSERT INTO roles (name, description) VALUES (?, ?)`,
      [name, description || null]
    );
    res.status(201).json({ data: { id: result.insertId, name, description } });
  } catch (err) {
    next(err);
  }
});

export default router;
