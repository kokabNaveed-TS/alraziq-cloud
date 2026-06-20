import { pool } from '../config/db.js';

export async function getStats(req, res, next) {
  try {
    const [[{ activeInstances }]] = await pool.query(
      `SELECT COUNT(*) AS activeInstances FROM instances WHERE status = 'Running'`
    );
    const [[{ totalUsers }]] = await pool.query(`SELECT COUNT(*) AS totalUsers FROM users`);
    const [[{ monthlyRevenue }]] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS monthlyRevenue
       FROM payments
       WHERE status = 'succeeded'
         AND MONTH(paid_at) = MONTH(CURRENT_DATE())
         AND YEAR(paid_at) = YEAR(CURRENT_DATE())`
    );

    res.json({
      activeInstances,
      totalUsers,
      uptimeSla: '99.95%',
      monthlyRevenue: Number(monthlyRevenue),
    });
  } catch (err) {
    next(err);
  }
}

export async function getInstanceGrowth(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS count
       FROM instances
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at)
       ORDER BY day ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getRevenueTrend(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT DATE(paid_at) AS day, SUM(amount) AS total
       FROM payments
       WHERE status = 'succeeded'
         AND paid_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(paid_at)
       ORDER BY day ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getRecentInstances(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT instance_id AS id, name, type, status, region
       FROM instances
       ORDER BY created_at DESC
       LIMIT 10`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}
