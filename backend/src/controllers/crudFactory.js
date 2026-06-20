import { pool } from '../config/db.js';

/**
 * Creates CRUD handlers for a table.
 *
 * @param {object} options
 * @param {string}   options.table
 * @param {string[]} options.columns       - writable columns
 * @param {string}   [options.idColumn='id']
 * @param {string}   [options.orderBy='created_at DESC']
 * @param {string}   [options.ownerColumn] - if set (e.g. 'owner_id'), non-admins only
 *                                           see/edit/delete their own rows
 */
export function createCrudController({
  table,
  columns,
  idColumn = 'id',
  orderBy = 'created_at DESC',
  ownerColumn = null,
}) {
  // Build WHERE clauses for ownership scoping
  function ownerWhere(req) {
    if (!ownerColumn || req.user?.role === 'admin') return { clause: '', params: [] };
    return { clause: `WHERE ${ownerColumn} = ?`, params: [req.user.id] };
  }
  function ownerAndId(req) {
    if (!ownerColumn || req.user?.role === 'admin')
      return { clause: `WHERE ${idColumn} = ?`, params: [req.params.id] };
    return { clause: `WHERE ${idColumn} = ? AND ${ownerColumn} = ?`, params: [req.params.id, req.user.id] };
  }

  return {
    async list(req, res, next) {
      try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;
        const { clause, params } = ownerWhere(req);

        const [rows] = await pool.query(
          `SELECT * FROM ${table} ${clause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        );
        const [[{ total }]] = await pool.query(
          `SELECT COUNT(*) AS total FROM ${table} ${clause}`,
          params
        );
        res.json({ data: rows, total, limit, offset });
      } catch (err) { next(err); }
    },

    async getOne(req, res, next) {
      try {
        const { clause, params } = ownerAndId(req);
        const [rows] = await pool.query(`SELECT * FROM ${table} ${clause}`, params);
        if (!rows.length) return res.status(404).json({ message: 'Record not found.' });
        res.json({ data: rows[0] });
      } catch (err) { next(err); }
    },

    async create(req, res, next) {
      try {
        const body = { ...req.body };
        // Auto-assign owner if ownerColumn present
        if (ownerColumn && !body[ownerColumn]) body[ownerColumn] = req.user.id;

        const fields = columns.filter((c) => body[c] !== undefined);
        if (!fields.length) return res.status(400).json({ message: 'No valid fields provided.' });

        const [result] = await pool.query(
          `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
          fields.map((f) => body[f])
        );
        const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, [result.insertId]);
        res.status(201).json({ data: rows[0] });
      } catch (err) { next(err); }
    },

    async update(req, res, next) {
      try {
        const fields = columns.filter((c) => req.body[c] !== undefined);
        if (!fields.length) return res.status(400).json({ message: 'No valid fields provided.' });

        const { clause, params } = ownerAndId(req);
        const setClause = fields.map((f) => `${f} = ?`).join(', ');

        const [result] = await pool.query(
          `UPDATE ${table} SET ${setClause} ${clause}`,
          [...fields.map((f) => req.body[f]), ...params]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Record not found.' });

        const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, [req.params.id]);
        res.json({ data: rows[0] });
      } catch (err) { next(err); }
    },

    async remove(req, res, next) {
      try {
        const { clause, params } = ownerAndId(req);
        const [result] = await pool.query(`DELETE FROM ${table} ${clause}`, params);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Record not found.' });
        res.status(204).send();
      } catch (err) { next(err); }
    },
  };
}
