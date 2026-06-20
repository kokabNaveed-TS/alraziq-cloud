import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// List invoices - admins see all, others see only their own
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    const isAdmin = req.user.role === 'admin';
    const params = isAdmin ? [limit, offset] : [req.user.id, limit, offset];
    const whereClause = isAdmin ? '' : 'WHERE user_id = ?';

    const [rows] = await pool.query(
      `SELECT * FROM invoices ${whereClause} ORDER BY issued_at DESC LIMIT ? OFFSET ?`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM invoices WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Invoice not found.' });

    const invoice = rows[0];
    if (req.user.role !== 'admin' && invoice.user_id !== req.user.id) {
      return res.status(403).json({ message: 'You do not have access to this invoice.' });
    }

    res.json({ data: invoice });
  } catch (err) {
    next(err);
  }
});

router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    const { invoice_number, user_id, amount, status = 'Pending', due_date } = req.body;
    if (!invoice_number || !user_id || !amount) {
      return res.status(400).json({ message: 'invoice_number, user_id and amount are required.' });
    }

    const [result] = await pool.query(
      `INSERT INTO invoices (invoice_number, user_id, amount, status, due_date) VALUES (?, ?, ?, ?, ?)`,
      [invoice_number, user_id, amount, status, due_date || null]
    );

    res.status(201).json({ data: { id: result.insertId, invoice_number, user_id, amount, status, due_date } });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const { status, due_date, amount } = req.body;
    const [result] = await pool.query(
      `UPDATE invoices SET
        status = COALESCE(?, status),
        due_date = COALESCE(?, due_date),
        amount = COALESCE(?, amount)
       WHERE id = ?`,
      [status, due_date, amount, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Invoice not found.' });
    res.json({ message: 'Invoice updated.' });
  } catch (err) {
    next(err);
  }
});

export default router;
