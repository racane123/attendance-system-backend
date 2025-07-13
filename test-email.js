import dotenv from 'dotenv';
import { testEmailConfig, sendNotification } from './services/emailService.js';
import pool from './database/db.js';

dotenv.config();

async function testEmailSystem() {
  console.log('🧪 Testing Email System...\n');
  
  try {
    // Test 1: Check email configuration
    console.log('1. Testing email configuration...');
    const configResult = await testEmailConfig();
    if (configResult.success) {
      console.log('✅ Email configuration is valid');
    } else {
      console.log('❌ Email configuration failed:', configResult.error);
      return;
    }
    
    // Test 2: Test database connection
    console.log('\n2. Testing database connection...');
    const dbResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connected successfully');
    console.log('   Current time:', dbResult.rows[0].current_time);
    
    // Test 3: Send test notification
    console.log('\n3. Sending test notification...');
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    const notificationResult = await sendNotification(testEmail, {
      subject: 'Test Notification - Attendance System',
      message: 'This is a test notification from the Attendance Management System. If you receive this, the email system is working correctly!',
      sentAt: new Date().toLocaleString()
    });
    
    if (notificationResult.success) {
      console.log('✅ Test notification sent successfully');
      console.log('   Message ID:', notificationResult.messageId);
    } else {
      console.log('❌ Test notification failed:', notificationResult.error);
    }
    
    // Test 4: Check email history table
    console.log('\n4. Checking email history...');
    const historyResult = await pool.query('SELECT COUNT(*) as count FROM email_history');
    console.log('✅ Email history table accessible');
    console.log('   Total emails in history:', historyResult.rows[0].count);
    
    console.log('\n🎉 Email system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Run the test
testEmailSystem(); 