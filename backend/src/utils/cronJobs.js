import cron from 'node-cron';
import { pool } from '../config/db.js';

export function startCronJobs() {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('🧹 Running background cleanup job for old metric data...');
    try {
      // Metric history is only viewable up to 48 hours in the frontend.
      // So we can safely delete anything older than 48 hours (2 days).
      const [metricsResult] = await pool.query(
        `DELETE FROM live_metrics WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)`
      );
      
      const [procsResult] = await pool.query(
        `DELETE FROM live_processes WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)`
      );

      // Keep logs for 7 days
      const [logsResult] = await pool.query(
        `DELETE FROM live_logs WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`
      );

      console.log(`✅ Cleanup complete. Deleted:
        - ${metricsResult.affectedRows} old metrics
        - ${procsResult.affectedRows} old processes
        - ${logsResult.affectedRows} old logs`);
    } catch (error) {
      console.error('❌ Failed to clean up old metrics:', error.message);
    }
  });
}
