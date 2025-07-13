import dotenv from 'dotenv';
import { sendNotification, sendWelcomeEmail, sendDailySummary } from './services/emailService.js';
import { sendDailySummaryToAll } from './services/scheduledEmailService.js';
import pool from './database/db.js';

dotenv.config();

async function testUserEmails() {
  console.log('🧪 Testing Email System with Real Users...\n');
  
  try {
    // Get all users from database
    console.log('1. Fetching users from database...');
    const usersResult = await pool.query('SELECT * FROM users ORDER BY id');
    const users = usersResult.rows;
    
    if (users.length === 0) {
      console.log('❌ No users found in database. Please run setup-database.js first.');
      return;
    }
    
    console.log(`✅ Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`   - ${user.username} (${user.email}) - Role: ${user.role}`);
    });

    // Test 1: Send welcome email to each user
    console.log('\n2. Testing welcome emails...');
    for (const user of users) {
      try {
        const welcomeData = {
          name: user.username,
          username: user.username,
          role: user.role,
          loginUrl: 'http://localhost:3000/login'
        };
        
        const result = await sendWelcomeEmail(user.email, welcomeData, user.id);
        
        if (result.success) {
          console.log(`✅ Welcome email sent to ${user.username} (${user.email})`);
        } else {
          console.log(`❌ Failed to send welcome email to ${user.username}: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ Error sending welcome email to ${user.username}: ${error.message}`);
      }
    }

    // Test 2: Send custom notification to admin
    console.log('\n3. Testing custom notifications...');
    const adminUser = users.find(u => u.role === 'admin');
    if (adminUser) {
      try {
        const notificationData = {
          subject: 'System Test Notification',
          message: 'This is a test notification to verify the email system is working correctly with real users. The system is ready for production use!',
          sentAt: new Date().toLocaleString()
        };
        
        const result = await sendNotification(adminUser.email, notificationData, adminUser.id);
        
        if (result.success) {
          console.log(`✅ Test notification sent to admin (${adminUser.email})`);
        } else {
          console.log(`❌ Failed to send notification to admin: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ Error sending notification to admin: ${error.message}`);
      }
    }

    // Test 3: Send daily summary to all users with preferences
    console.log('\n4. Testing daily summary to all users...');
    try {
      const results = await sendDailySummaryToAll();
      console.log(`✅ Daily summary sent to ${results.length} users`);
      
      results.forEach(result => {
        if (result.success) {
          console.log(`   ✅ ${result.user} (${result.email}): ${result.messageId}`);
        } else {
          console.log(`   ❌ ${result.user} (${result.email}): ${result.error}`);
        }
      });
    } catch (error) {
      console.log(`❌ Error sending daily summary: ${error.message}`);
    }

    // Test 4: Check email history
    console.log('\n5. Checking email history...');
    const historyResult = await pool.query(`
      SELECT 
        eh.recipient_email,
        eh.email_type,
        eh.status,
        eh.created_at,
        u.username as sent_by_username
      FROM email_history eh
      LEFT JOIN users u ON eh.sent_by = u.id
      ORDER BY eh.created_at DESC
      LIMIT 10
    `);
    
    console.log(`✅ Email history (last 10 emails):`);
    historyResult.rows.forEach(email => {
      const status = email.status === 'sent' ? '✅' : '❌';
      console.log(`   ${status} ${email.email_type} to ${email.recipient_email} (${email.status}) - ${email.created_at}`);
    });

    // Test 5: Check email preferences
    console.log('\n6. Checking email preferences...');
    const prefsResult = await pool.query(`
      SELECT 
        ep.email_type,
        ep.enabled,
        ep.frequency,
        u.username,
        u.email
      FROM email_preferences ep
      JOIN users u ON ep.user_id = u.id
      ORDER BY u.username, ep.email_type
    `);
    
    console.log(`✅ Email preferences:`);
    prefsResult.rows.forEach(pref => {
      const status = pref.enabled ? '✅' : '❌';
      console.log(`   ${status} ${pref.username} (${pref.email}): ${pref.email_type} - ${pref.frequency}`);
    });

    console.log('\n🎉 User email testing completed successfully!');
    console.log('\n📧 Check your email inboxes to verify the emails were received.');
    console.log('\n📊 You can also check the email history via API:');
    console.log('   GET /api/email-management/history');
    console.log('   GET /api/email-management/stats');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Run the test
testUserEmails(); 