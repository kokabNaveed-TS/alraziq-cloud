import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// List own API keys (never returns the actual secret)
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, key_prefix, last_used_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// Create a new API key - returns the raw key ONCE
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Key name is required.' });

    const rawKey = `ark_${crypto.randomBytes(24).toString('hex')}`;
    const prefix = rawKey.slice(0, 11); // e.g. ark_xxxxxxx
    const keyHash = await bcrypt.hash(rawKey, 10);

    const [result] = await pool.query(
      `INSERT INTO api_keys (user_id, name, key_prefix, key_hash) VALUES (?, ?, ?, ?)`,
      [req.user.id, name, prefix, keyHash]
    );

    res.status(201).json({
      data: { id: result.insertId, name, key_prefix: prefix },
      apiKey: rawKey, // show this to the user once; cannot be retrieved again
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `DELETE FROM api_keys WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'API key not found.' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
