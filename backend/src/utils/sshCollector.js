import { Client } from 'ssh2';

/**
 * Runs a single command on a remote host via SSH.
 * Returns stdout as a string. Rejects on error or non-zero exit.
 */
export function sshExec(connectionConfig, command) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';
    let errOutput = '';

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        stream.on('data', (d) => { output += d.toString(); });
        stream.stderr.on('data', (d) => { errOutput += d.toString(); });
        stream.on('close', (code) => {
          conn.end();
          if (code !== 0) {
            return reject(new Error(`Command exited ${code}: ${errOutput.trim()}`));
          }
          resolve(output.trim());
        });
      });
    });

    conn.on('error', (err) => reject(new Error(`SSH connection error: ${err.message}`)));

    const config = {
      host: connectionConfig.host,
      port: connectionConfig.port || 22,
      username: connectionConfig.username,
      readyTimeout: 10000,
    };

    if (connectionConfig.auth_type === 'key' && connectionConfig.private_key) {
      config.privateKey = connectionConfig.private_key;
    } else if (connectionConfig.password) {
      config.password = connectionConfig.password;
    }

    conn.connect(config);
  });
}

/**
 * Collects all system metrics from a remote Linux machine via SSH.
 * Returns a structured object ready for DB insertion.
 */
export async function collectMetrics(agent) {
  // One SSH session, run all needed commands joined by newlines
  // We use a single heredoc-style multi-command to minimise round trips
  const script = `
echo "=CPU="; top -bn1 | grep "Cpu(s)" | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}' 2>/dev/null || \
  grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$3+$4+$5)} END {print usage}'
echo "=MEM="; free -m | awk 'NR==2{print $2, $3}'
echo "=DISK="; df -BG / | awk 'NR==2{gsub("G",""); print $2, $3}'
echo "=LOAD="; cat /proc/loadavg | awk '{print $1, $2, $3}'
echo "=UPTIME="; cat /proc/uptime | awk '{print int($1)}'
echo "=PROCS="; ps aux --sort=-%cpu 2>/dev/null | head -11 | tail -10 | awk '{print $2, $1, $3, $4, $8}'
echo "=HOSTNAME="; hostname
echo "=OS="; cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '"' || uname -s
echo "=KERNEL="; uname -r
`.trim();

  const output = await sshExec(agent, script);
  const sections = {};
  let current = null;
  for (const line of output.split('\n')) {
    if (line.startsWith('=') && line.endsWith('=')) {
      current = line.slice(1, -1);
      sections[current] = [];
    } else if (current) {
      sections[current].push(line);
    }
  }

  const get = (key, fallback = '') => (sections[key] || []).join('\n').trim() || fallback;

  // CPU
  const cpu_percent = parseFloat(get('CPU', '0')) || 0;

  // Memory: total used (in MB)
  const [mem_total_mb = 0, mem_used_mb = 0] = get('MEM', '0 0').split(' ').map(Number);
  const mem_percent = mem_total_mb > 0 ? parseFloat(((mem_used_mb / mem_total_mb) * 100).toFixed(2)) : 0;

  // Disk: total used (in GB, stripped of G suffix)
  const [disk_total_gb = 0, disk_used_gb = 0] = get('DISK', '0 0').split(' ').map(Number);
  const disk_percent = disk_total_gb > 0 ? parseFloat(((disk_used_gb / disk_total_gb) * 100).toFixed(2)) : 0;

  // Load averages
  const [load_1 = 0, load_5 = 0, load_15 = 0] = get('LOAD', '0 0 0').split(' ').map(Number);

  // Uptime in seconds
  const uptime_secs = parseInt(get('UPTIME', '0')) || 0;

  // Top processes
  const processes = (sections['PROCS'] || [])
    .filter(Boolean)
    .map((line) => {
      const [pid, user, cpu, mem, status = 'S'] = line.trim().split(/\s+/);
      return {
        pid: parseInt(pid) || 0,
        name: user || 'unknown',
        cpu_percent: parseFloat(cpu) || 0,
        mem_percent: parseFloat(mem) || 0,
        status,
      };
    });

  // System info
  const hostname = get('HOSTNAME', 'unknown');
  const os = get('OS', 'Linux');
  const kernel = get('KERNEL', 'unknown');

  return {
    cpu_percent,
    mem_total_mb,
    mem_used_mb,
    mem_percent,
    disk_total_gb,
    disk_used_gb,
    disk_percent,
    load_1,
    load_5,
    load_15,
    uptime_secs,
    processes,
    sysinfo: { hostname, os, kernel },
  };
}

/**
 * Tails the last N lines of a remote log file and returns them as an array.
 */
export async function collectLogs(agent, logFile = '/var/log/syslog', lines = 50) {
  // fallback: if syslog doesn't exist try journalctl or /var/log/messages
  const cmd = `tail -n ${lines} ${logFile} 2>/dev/null || journalctl -n ${lines} --no-pager 2>/dev/null || tail -n ${lines} /var/log/messages 2>/dev/null || echo "No log file found"`;
  const raw = await sshExec(agent, cmd);
  return raw.split('\n').filter(Boolean).map((line) => {
    // Classify level by keywords
    let level = 'info';
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('failed') || lower.includes('fatal')) level = 'error';
    else if (lower.includes('warn')) level = 'warning';
    else if (lower.includes('debug')) level = 'debug';

    // Extract source from syslog format: "Month Day HH:MM:SS hostname source[pid]: message"
    const match = line.match(/\w+\s+\d+\s+\d+:\d+:\d+\s+\S+\s+(\S+?)(?:\[\d+\])?:/);
    const source = match ? match[1] : 'system';
    const message = line.replace(/^\w+\s+\d+\s+\d+:\d+:\d+\s+\S+\s+/, '').slice(0, 500);

    return { level, source, message, raw_line: line.slice(0, 1000) };
  });
}

/**
 * Test-only: ping the server and return basic info without saving anything.
 */
export async function testConnection(agent) {
  const out = await sshExec(agent, 'hostname && uname -r && uptime -p 2>/dev/null || uptime');
  return out;
}
