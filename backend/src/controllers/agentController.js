import { pool } from '../config/db.js';
import { collectMetrics, collectLogs, testConnection } from '../utils/sshCollector.js';

// ─── helpers ──────────────────────────────────────────────────────────────

function scopeWhere(req) {
  // Admins can specify ?user_id=X, otherwise scoped to self
  const userId = req.user.role === 'admin' && req.query.user_id
    ? parseInt(req.query.user_id)
    : req.user.id;
  return { userId };
}

// Build a connection config object for sshCollector from a DB agent row
function agentConfig(agent) {
  return {
    host: agent.host,
    port: agent.port,
    username: agent.username,
    auth_type: agent.auth_type,
    password: agent.password_enc, // NOTE: in production, decrypt this first
    private_key: agent.private_key,
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────

export async function listAgents(req, res, next) {
  try {
    const { userId } = scopeWhere(req);
    const [rows] = await pool.query(
      `SELECT id, user_id, label, host, port, username, auth_type, status, last_seen_at, created_at
       FROM server_agents WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
}

export async function getAgent(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT id, user_id, label, host, port, username, auth_type, status, last_seen_at, created_at
       FROM server_agents WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Agent not found.' });
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
}

export async function createAgent(req, res, next) {
  try {
    const { label, host, port = 22, username, auth_type = 'password', password, private_key } = req.body;
    if (!label || !host || !username) {
      return res.status(400).json({ message: 'label, host and username are required.' });
    }
    if (auth_type === 'password' && !password) {
      return res.status(400).json({ message: 'password is required for password auth.' });
    }
    if (auth_type === 'key' && !private_key) {
      return res.status(400).json({ message: 'private_key is required for key auth.' });
    }

    // NOTE: in production, encrypt password_enc with AES before storing
    const [result] = await pool.query(
      `INSERT INTO server_agents (user_id, label, host, port, username, auth_type, password_enc, private_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, label, host, port, username, auth_type,
       auth_type === 'password' ? password : null,
       auth_type === 'key' ? private_key : null]
    );
    const [rows] = await pool.query(
      `SELECT id, user_id, label, host, port, username, auth_type, status, last_seen_at, created_at
       FROM server_agents WHERE id = ?`, [result.insertId]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) { next(err); }
}

export async function updateAgent(req, res, next) {
  try {
    const { label, host, port, username, auth_type, password, private_key } = req.body;
    await pool.query(
      `UPDATE server_agents SET
        label = COALESCE(?, label),
        host = COALESCE(?, host),
        port = COALESCE(?, port),
        username = COALESCE(?, username),
        auth_type = COALESCE(?, auth_type),
        password_enc = CASE WHEN ? IS NOT NULL THEN ? ELSE password_enc END,
        private_key  = CASE WHEN ? IS NOT NULL THEN ? ELSE private_key END
       WHERE id = ? AND user_id = ?`,
      [label, host, port, username, auth_type,
       password, password,
       private_key, private_key,
       req.params.id, req.user.id]
    );
    const [rows] = await pool.query(
      `SELECT id, user_id, label, host, port, username, auth_type, status, last_seen_at, created_at
       FROM server_agents WHERE id = ?`, [req.params.id]
    );
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
}

export async function deleteAgent(req, res, next) {
  try {
    const [result] = await pool.query(
      `DELETE FROM server_agents WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Agent not found.' });
    res.status(204).send();
  } catch (err) { next(err); }
}

// ─── TEST CONNECTION ───────────────────────────────────────────────────────

export async function testAgent(req, res, next) {
  try {
    // Accept connection params either from DB (by id) or direct from body (for pre-save testing)
    let config;
    if (req.params.id) {
      const [rows] = await pool.query(
        `SELECT * FROM server_agents WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id]
      );
      if (!rows.length) return res.status(404).json({ message: 'Agent not found.' });
      config = agentConfig(rows[0]);
    } else {
      const { host, port = 22, username, auth_type = 'password', password, private_key } = req.body;
      config = { host, port, username, auth_type, password, private_key };
    }

    const info = await testConnection(config);
    res.json({ success: true, info });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// ─── ONE-SHOT POLL ─────────────────────────────────────────────────────────

export async function pollAgent(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM server_agents WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Agent not found.' });
    const agent = rows[0];

    let metrics;
    try {
      metrics = await collectMetrics(agentConfig(agent));
      // Mark agent online
      await pool.query(
        `UPDATE server_agents SET status='online', last_seen_at=NOW() WHERE id=?`,
        [agent.id]
      );
    } catch (sshErr) {
      await pool.query(`UPDATE server_agents SET status='offline' WHERE id=?`, [agent.id]);
      return res.status(502).json({ message: `SSH collection failed: ${sshErr.message}` });
    }

    // Persist metric snapshot
    await pool.query(
      `INSERT INTO live_metrics
       (agent_id, user_id, cpu_percent, mem_total_mb, mem_used_mb, mem_percent,
        disk_total_gb, disk_used_gb, disk_percent, load_1, load_5, load_15, uptime_secs)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [agent.id, req.user.id,
       metrics.cpu_percent, metrics.mem_total_mb, metrics.mem_used_mb, metrics.mem_percent,
       metrics.disk_total_gb, metrics.disk_used_gb, metrics.disk_percent,
       metrics.load_1, metrics.load_5, metrics.load_15, metrics.uptime_secs]
    );

    // Persist top processes
    if (metrics.processes.length) {
      const procValues = metrics.processes.map((p) =>
        [agent.id, req.user.id, p.pid, p.name, p.cpu_percent, p.mem_percent, p.status]
      );
      await pool.query(
        `INSERT INTO live_processes (agent_id, user_id, pid, name, cpu_percent, mem_percent, status)
         VALUES ?`,
        [procValues]
      );
    }

    res.json({ data: metrics });
  } catch (err) { next(err); }
}

// ─── LIVE LOGS ─────────────────────────────────────────────────────────────

export async function fetchAgentLogs(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM server_agents WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Agent not found.' });

    const logFile = req.query.file || '/var/log/syslog';
    const lines = Math.min(parseInt(req.query.lines) || 100, 500);

    let logEntries;
    try {
      logEntries = await collectLogs(agentConfig(rows[0]), logFile, lines);
    } catch (sshErr) {
      return res.status(502).json({ message: `SSH log fetch failed: ${sshErr.message}` });
    }

    // Persist logs
    if (logEntries.length) {
      const vals = logEntries.map((l) =>
        [req.params.id, req.user.id, l.level, l.source, l.message, l.raw_line]
      );
      await pool.query(
        `INSERT INTO live_logs (agent_id, user_id, level, source, message, raw_line) VALUES ?`,
        [vals]
      );
    }

    res.json({ data: logEntries });
  } catch (err) { next(err); }
}

// ─── STORED LOGS (from DB) ─────────────────────────────────────────────────

export async function getStoredLogs(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const level = req.query.level;
    const extra = level ? 'AND level = ?' : '';
    const params = level
      ? [req.params.id, req.user.id, level, limit]
      : [req.params.id, req.user.id, limit];

    const [rows] = await pool.query(
      `SELECT id, level, source, message, recorded_at FROM live_logs
       WHERE agent_id = ? AND user_id = ? ${extra}
       ORDER BY recorded_at DESC LIMIT ?`,
      params
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
}

// ─── HISTORY METRICS ───────────────────────────────────────────────────────

export async function getMetricHistory(req, res, next) {
  try {
    const hours = Math.min(parseInt(req.query.hours) || 1, 48);
    const [rows] = await pool.query(
      `SELECT cpu_percent, mem_percent, disk_percent, load_1, uptime_secs, recorded_at
       FROM live_metrics
       WHERE agent_id = ? AND user_id = ?
         AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       ORDER BY recorded_at ASC`,
      [req.params.id, req.user.id, hours]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
}

// ─── SSE STREAM ───────────────────────────────────────────────────────────

export async function sseStream(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM server_agents WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Agent not found.' });
    const agent = rows[0];

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('connected', { agentId: agent.id, label: agent.label });

    const interval = parseInt(req.query.interval) || 5000; // default 5s

    const poll = async () => {
      try {
        const metrics = await collectMetrics(agentConfig(agent));
        await pool.query(
          `UPDATE server_agents SET status='online', last_seen_at=NOW() WHERE id=?`,
          [agent.id]
        );
        await pool.query(
          `INSERT INTO live_metrics
           (agent_id, user_id, cpu_percent, mem_total_mb, mem_used_mb, mem_percent,
            disk_total_gb, disk_used_gb, disk_percent, load_1, load_5, load_15, uptime_secs)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [agent.id, req.user.id,
           metrics.cpu_percent, metrics.mem_total_mb, metrics.mem_used_mb, metrics.mem_percent,
           metrics.disk_total_gb, metrics.disk_used_gb, metrics.disk_percent,
           metrics.load_1, metrics.load_5, metrics.load_15, metrics.uptime_secs]
        );
        send('metrics', metrics);
      } catch (err) {
        await pool.query(`UPDATE server_agents SET status='offline' WHERE id=?`, [agent.id]);
        send('error', { message: err.message });
      }
    };

    // First poll immediately
    await poll();
    const timer = setInterval(poll, Math.max(interval, 3000));

    // Clean up when client disconnects
    req.on('close', () => {
      clearInterval(timer);
      res.end();
    });
  } catch (err) { next(err); }
}

// ─── ADMIN: ALL AGENTS ────────────────────────────────────────────────────

export async function adminListAllAgents(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT sa.id, sa.label, sa.host, sa.port, sa.username, sa.auth_type,
              sa.status, sa.last_seen_at, sa.created_at,
              u.name AS user_name, u.email AS user_email
       FROM server_agents sa
       JOIN users u ON u.id = sa.user_id
       ORDER BY sa.created_at DESC`
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
}
