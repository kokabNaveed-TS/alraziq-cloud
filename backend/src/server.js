import dotenv from 'dotenv';
import app from './app.js';
import { testConnection } from './config/db.js';
import { startCronJobs } from './utils/cronJobs.js';

dotenv.config();

app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await testConnection();
    console.log('✅ MySQL connection established.');
    // Start background tasks
    startCronJobs();
    console.log('⏰ Background cron jobs started.');
  } catch (err) {
    console.error('❌ Failed to connect to MySQL:', err.message);
    process.exit(1);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

start();