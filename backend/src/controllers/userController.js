import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

export async function listUsers(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.is_active, u.last_login_at, u.created_at, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users`);

    res.json({ data: rows, total, limit, offset });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.is_active, u.last_login_at, u.created_at, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req, res, next) {
  try {
    const { name, email, password, role = 'member' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required.' });
    }

    const [[roleRow]] = await pool.query(`SELECT id FROM roles WHERE name = ?`, [role]);
    if (!roleRow) return res.status(400).json({ message: 'Invalid role.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)`,
      [name, email, passwordHash, roleRow.id]
    );

    res.status(201).json({ data: { id: result.insertId, name, email, role } });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const { name, role, is_active } = req.body;
    let roleId;
    if (role) {
      const [[roleRow]] = await pool.query(`SELECT id FROM roles WHERE name = ?`, [role]);
      if (!roleRow) return res.status(400).json({ message: 'Invalid role.' });
      roleId = roleRow.id;
    }

    const [result] = await pool.query(
      `UPDATE users SET
         name = COALESCE(?, name),
         role_id = COALESCE(?, role_id),
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, roleId, is_active, req.params.id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'User updated.' });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const [result] = await pool.query(`DELETE FROM users WHERE id = ?`, [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found.' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
