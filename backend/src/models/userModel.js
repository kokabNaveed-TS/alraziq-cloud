import { pool } from '../config/db.js';

export const UserModel = {
  async findByEmail(email) {
    const [rows] = await pool.query(
      `SELECT u.*, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.email = ?`,
      [email]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar_url, u.is_active, u.last_login_at, u.created_at, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ name, email, passwordHash, roleId = 2 }) {
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)`,
      [name, email, passwordHash, roleId]
    );
    return this.findById(result.insertId);
  },

  async updateLastLogin(id) {
    await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [id]);
  },

  async update(id, { name, avatarUrl }) {
    await pool.query(
      `UPDATE users SET name = COALESCE(?, name), avatar_url = COALESCE(?, avatar_url) WHERE id = ?`,
      [name, avatarUrl, id]
    );
    return this.findById(id);
  },

  async list({ limit = 50, offset = 0 } = {}) {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.is_active, u.created_at, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows;
  },

  async updatePassword(id, passwordHash) {
    await pool.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, id]);
  },
};

export const PasswordResetModel = {
  async create({ userId, tokenHash, expiresAt }) {
    // Invalidate any previous unused tokens for this user
    await pool.query(
      `UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0`,
      [userId]
    );

    await pool.query(
      `INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)`,
      [userId, tokenHash, expiresAt]
    );
  },

  async findValidByTokenHash(tokenHash) {
    const [rows] = await pool.query(
      `SELECT * FROM password_resets
       WHERE token = ? AND used = 0 AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [tokenHash]
    );
    return rows[0] || null;
  },

  async markUsed(id) {
    await pool.query(`UPDATE password_resets SET used = 1 WHERE id = ?`, [id]);
  },
};
