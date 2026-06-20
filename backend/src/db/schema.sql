-- Alraziq-Cloud Database Schema
-- Run: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS alraziq_cloud
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE alraziq_cloud;

-- ========================================
-- USERS & AUTH
-- ========================================
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (name, description) VALUES
  ('admin', 'Full administrative access'),
  ('member', 'Standard user access'),
  ('viewer', 'Read-only access')
ON DUPLICATE KEY UPDATE name = name;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL DEFAULT 2,
  avatar_url VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL,       -- SHA-256 hex hash of the raw token
  expires_at TIMESTAMP NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token),           -- fast lookup by hash
  INDEX idx_user_used (user_id, used),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- COMPUTE: INSTANCES, CONTAINERS, FUNCTIONS
-- ========================================
CREATE TABLE IF NOT EXISTS instances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instance_id VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status ENUM('Running', 'Stopped', 'Provisioning', 'Terminated') NOT NULL DEFAULT 'Provisioning',
  region VARCHAR(50) NOT NULL,
  owner_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS containers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  container_id VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  image VARCHAR(150) NOT NULL,
  status ENUM('Running', 'Stopped', 'Restarting') NOT NULL DEFAULT 'Running',
  owner_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS functions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  runtime VARCHAR(50) NOT NULL,
  status ENUM('Active', 'Inactive', 'Error') NOT NULL DEFAULT 'Active',
  invocations INT NOT NULL DEFAULT 0,
  owner_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================================
-- STORAGE: OBJECTS, VOLUMES, BACKUPS
-- ========================================
CREATE TABLE IF NOT EXISTS storage_objects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bucket_name VARCHAR(100) NOT NULL,
  object_key VARCHAR(255) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  content_type VARCHAR(100),
  owner_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS volumes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  volume_id VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  size_gb INT NOT NULL,
  status ENUM('Attached', 'Available', 'Error') NOT NULL DEFAULT 'Available',
  region VARCHAR(50) NOT NULL,
  owner_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS backups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_type ENUM('instance', 'volume', 'database') NOT NULL,
  source_id VARCHAR(50) NOT NULL,
  status ENUM('Completed', 'In Progress', 'Failed') NOT NULL DEFAULT 'In Progress',
  size_gb DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- MONITORING: METRICS, ALERTS, LOGS
-- ========================================
CREATE TABLE IF NOT EXISTS metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(50) NOT NULL,
  metric_name VARCHAR(50) NOT NULL,
  metric_value DECIMAL(10,2) NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  message TEXT,
  severity ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'info',
  resource_id VARCHAR(50),
  is_resolved TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  level ENUM('info', 'warning', 'error', 'debug') NOT NULL DEFAULT 'info',
  source VARCHAR(100),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- BILLING: INVOICES, PAYMENTS
-- ========================================
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('Paid', 'Pending', 'Overdue') NOT NULL DEFAULT 'Pending',
  due_date DATE,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  user_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method ENUM('card', 'bank_transfer', 'paypal') NOT NULL DEFAULT 'card',
  status ENUM('succeeded', 'failed', 'refunded') NOT NULL DEFAULT 'succeeded',
  paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- SETTINGS: API KEYS, NOTIFICATIONS
-- ========================================
CREATE TABLE IF NOT EXISTS api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  last_used_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- POLICIES (Identity > Policies)
-- ========================================
CREATE TABLE IF NOT EXISTS policies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  effect ENUM('allow', 'deny') NOT NULL DEFAULT 'allow',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed an initial admin user (password: Admin@123 -> bcrypt hash below)
-- Generate your own hash via bcrypt; this is just a placeholder example.
-- INSERT INTO users (name, email, password_hash, role_id) VALUES

-- ========================================
-- SERVER AGENTS (Real Linux/Cloud Machine Registration)
-- ========================================
-- Each user can register one or more Linux machines.
-- Credentials are stored encrypted in application layer.
-- Password/key fields are intentionally nullable: only one is needed.
CREATE TABLE IF NOT EXISTS server_agents (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  label         VARCHAR(100) NOT NULL,            -- friendly name e.g. "Production Web Server"
  host          VARCHAR(255) NOT NULL,            -- IP or hostname
  port          INT NOT NULL DEFAULT 22,
  username      VARCHAR(100) NOT NULL,
  auth_type     ENUM('password','key') NOT NULL DEFAULT 'password',
  password_enc  TEXT DEFAULT NULL,               -- AES-encrypted SSH password
  private_key   TEXT DEFAULT NULL,               -- PEM private key (store securely)
  status        ENUM('online','offline','unknown') NOT NULL DEFAULT 'unknown',
  last_seen_at  TIMESTAMP NULL DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- LIVE METRICS (polled from real machines)
-- ========================================
CREATE TABLE IF NOT EXISTS live_metrics (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  agent_id      INT NOT NULL,
  user_id       INT NOT NULL,
  cpu_percent   DECIMAL(5,2) DEFAULT 0,
  mem_total_mb  INT DEFAULT 0,
  mem_used_mb   INT DEFAULT 0,
  mem_percent   DECIMAL(5,2) DEFAULT 0,
  disk_total_gb DECIMAL(10,2) DEFAULT 0,
  disk_used_gb  DECIMAL(10,2) DEFAULT 0,
  disk_percent  DECIMAL(5,2) DEFAULT 0,
  load_1        DECIMAL(6,2) DEFAULT 0,
  load_5        DECIMAL(6,2) DEFAULT 0,
  load_15       DECIMAL(6,2) DEFAULT 0,
  uptime_secs   BIGINT DEFAULT 0,
  recorded_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agent_time (agent_id, recorded_at),
  INDEX idx_user_time  (user_id,  recorded_at),
  FOREIGN KEY (agent_id) REFERENCES server_agents(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- LIVE PROCESSES (top processes per poll)
-- ========================================
CREATE TABLE IF NOT EXISTS live_processes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  agent_id    INT NOT NULL,
  user_id     INT NOT NULL,
  pid         INT,
  name        VARCHAR(100),
  cpu_percent DECIMAL(5,2) DEFAULT 0,
  mem_percent DECIMAL(5,2) DEFAULT 0,
  status      VARCHAR(30),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agent_time (agent_id, recorded_at),
  FOREIGN KEY (agent_id) REFERENCES server_agents(id) ON DELETE CASCADE
);

-- ========================================
-- LIVE LOGS (tail of /var/log/syslog or custom)
-- ========================================
CREATE TABLE IF NOT EXISTS live_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  agent_id    INT NOT NULL,
  user_id     INT NOT NULL,
  level       ENUM('info','warning','error','debug') NOT NULL DEFAULT 'info',
  source      VARCHAR(100),
  message     TEXT NOT NULL,
  raw_line    TEXT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agent_time (agent_id, recorded_at),
  FOREIGN KEY (agent_id) REFERENCES server_agents(id) ON DELETE CASCADE
);
--   ('Alraziq Admin', 'admin@alraziq.cloud', '$2a$10$REPLACE_WITH_REAL_HASH', 1);
