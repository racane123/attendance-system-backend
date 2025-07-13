import cron from 'node-cron';
import { sendDailySummaryToAll, sendWeeklySummaryToAll } from './scheduledEmailService.js';

// Initialize cron jobs
export const initializeCronJobs = () => {
  console.log('Initializing cron jobs...');
  
  // Daily summary at 6:00 PM every day
  cron.schedule('0 18 * * *', async () => {
    console.log('Running daily summary cron job...');
    try {
      const results = await sendDailySummaryToAll();
      console.log(`Daily summary cron job completed. Sent to ${results.length} users.`);
    } catch (error) {
      console.error('Daily summary cron job failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Manila" // Adjust timezone as needed
  });
  
  // Weekly summary every Sunday at 6:00 PM
  cron.schedule('0 18 * * 0', async () => {
    console.log('Running weekly summary cron job...');
    try {
      const results = await sendWeeklySummaryToAll();
      console.log(`Weekly summary cron job completed. Sent to ${results.length} users.`);
    } catch (error) {
      console.error('Weekly summary cron job failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Manila" // Adjust timezone as needed
  });
  
  console.log('Cron jobs initialized successfully');
};

// Manual trigger functions for testing
export const triggerDailySummary = async () => {
  console.log('Manually triggering daily summary...');
  try {
    const results = await sendDailySummaryToAll();
    console.log(`Manual daily summary completed. Sent to ${results.length} users.`);
    return results;
  } catch (error) {
    console.error('Manual daily summary failed:', error);
    throw error;
  }
};

export const triggerWeeklySummary = async () => {
  console.log('Manually triggering weekly summary...');
  try {
    const results = await sendWeeklySummaryToAll();
    console.log(`Manual weekly summary completed. Sent to ${results.length} users.`);
    return results;
  } catch (error) {
    console.error('Manual weekly summary failed:', error);
    throw error;
  }
}; 