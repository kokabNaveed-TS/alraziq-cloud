import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { UserModel } from '../models/userModel.js';

const router = Router();
router.use(authenticate);

// GET /api/profile - current user's profile
router.get('/', async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/profile - update name / avatar
router.put('/', async (req, res, next) => {
  try {
    const { name, avatarUrl } = req.body;
    const user = await UserModel.update(req.user.id, { name, avatarUrl });
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/profile/password - change password
router.put('/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const [rows] = await pool.query(`SELECT password_hash FROM users WHERE id = ?`, [req.user.id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect.' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, req.user.id]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
