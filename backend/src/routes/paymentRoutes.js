import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// List payments - admins see all, others see only their own
router.get('/', async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const whereClause = isAdmin ? '' : 'WHERE user_id = ?';
    const params = isAdmin ? [] : [req.user.id];

    const [rows] = await pool.query(
      `SELECT * FROM payments ${whereClause} ORDER BY paid_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// Record a payment against an invoice
router.post('/', async (req, res, next) => {
  try {
    const { invoice_id, amount, method = 'card' } = req.body;
    if (!invoice_id || !amount) {
      return res.status(400).json({ message: 'invoice_id and amount are required.' });
    }

    const [[invoice]] = await pool.query(`SELECT * FROM invoices WHERE id = ?`, [invoice_id]);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });

    if (req.user.role !== 'admin' && invoice.user_id !== req.user.id) {
      return res.status(403).json({ message: 'You cannot pay this invoice.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO payments (invoice_id, user_id, amount, method, status) VALUES (?, ?, ?, ?, 'succeeded')`,
        [invoice_id, invoice.user_id, amount, method]
      );

      await conn.query(`UPDATE invoices SET status = 'Paid' WHERE id = ?`, [invoice_id]);

      await conn.commit();
      res.status(201).json({ data: { id: result.insertId, invoice_id, amount, method, status: 'succeeded' } });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});

export default router;
