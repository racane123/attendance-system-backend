import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

async function testAPIEndpoints() {
  console.log('🧪 Testing Email API Endpoints...\n');
  
  try {
    // Test 1: Health check (no auth required)
    console.log('1. Testing health check...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log(`✅ Health check: ${healthData.message}`);
    
    // Test 2: Test email configuration (requires auth)
    console.log('\n2. Testing email configuration...');
    console.log('⚠️  This requires authentication. You can test manually with:');
    console.log(`   curl -X POST ${BASE_URL}/email/test \\`);
    console.log('     -H "Authorization: Bearer YOUR_TOKEN" \\');
    console.log('     -H "Content-Type: application/json"');
    
    // Test 3: Show available endpoints
    console.log('\n3. Available Email API Endpoints:');
    console.log('   📧 Email Sending:');
    console.log(`   - POST ${BASE_URL}/email/test`);
    console.log(`   - POST ${BASE_URL}/email/attendance-report`);
    console.log(`   - POST ${BASE_URL}/email/daily-summary`);
    console.log(`   - POST ${BASE_URL}/email/notification`);
    console.log(`   - POST ${BASE_URL}/email/send-daily-summary`);
    console.log(`   - POST ${BASE_URL}/email/send-weekly-summary`);
    console.log(`   - POST ${BASE_URL}/email/send-subject-report`);
    console.log(`   - POST ${BASE_URL}/email/trigger-daily`);
    console.log(`   - POST ${BASE_URL}/email/trigger-weekly`);
    
    console.log('\n   📊 Email Management:');
    console.log(`   - GET ${BASE_URL}/email-management/history`);
    console.log(`   - GET ${BASE_URL}/email-management/stats`);
    console.log(`   - GET ${BASE_URL}/email-management/preferences`);
    console.log(`   - PUT ${BASE_URL}/email-management/preferences`);
    console.log(`   - PUT ${BASE_URL}/email-management/preferences/bulk`);
    
    console.log('\n4. Authentication Required:');
    console.log('   All email endpoints require a valid JWT token.');
    console.log('   Get a token by logging in via the frontend or auth API.');
    console.log('   Include the token in the Authorization header:');
    console.log('   Authorization: Bearer YOUR_JWT_TOKEN');
    
    console.log('\n5. Example API Usage:');
    console.log('   # Send test notification');
    console.log(`   curl -X POST ${BASE_URL}/email/notification \\`);
    console.log('     -H "Authorization: Bearer YOUR_TOKEN" \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{');
    console.log('       "recipientEmail": "test@example.com",');
    console.log('       "subject": "Test Message",');
    console.log('       "message": "This is a test notification"');
    console.log('     }\'');
    
    console.log('\n   # Get email history');
    console.log(`   curl -X GET "${BASE_URL}/email-management/history?page=1&limit=10" \\`);
    console.log('     -H "Authorization: Bearer YOUR_TOKEN"');
    
    console.log('\n   # Get email statistics');
    console.log(`   curl -X GET "${BASE_URL}/email-management/stats?days=30" \\`);
    console.log('     -H "Authorization: Bearer YOUR_TOKEN"');
    
    console.log('\n🎉 API endpoint testing completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Get a JWT token by logging in');
    console.log('   2. Test the endpoints with the token');
    console.log('   3. Update user email addresses to real ones');
    console.log('   4. Test with real email addresses');
    
  } catch (error) {
    console.error('❌ API test failed:', error);
  }
}

testAPIEndpoints(); 