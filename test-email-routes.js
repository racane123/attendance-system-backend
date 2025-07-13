import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api';

const testRoutes = async () => {
  console.log('🧪 Testing Email Routes...\n');

  const routes = [
    { method: 'GET', path: '/email-management/history', name: 'Email History' },
    { method: 'GET', path: '/email-management/stats', name: 'Email Stats' },
    { method: 'GET', path: '/email-management/preferences', name: 'Email Preferences' },
    { method: 'POST', path: '/email/notification', name: 'Send Notification' },
    { method: 'POST', path: '/email/attendance-report', name: 'Send Attendance Report' },
    { method: 'POST', path: '/email/send-daily-summary', name: 'Send Daily Summary' },
    { method: 'POST', path: '/email/send-weekly-summary', name: 'Send Weekly Summary' },
  ];

  for (const route of routes) {
    try {
      const url = `${BASE_URL}${route.path}`;
      console.log(`Testing ${route.name} (${route.method} ${route.path})...`);
      
      const response = await fetch(url, {
        method: route.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: route.method === 'POST' ? JSON.stringify({}) : undefined
      });

      if (response.status === 401) {
        console.log(`✅ ${route.name}: Route exists (requires authentication)`);
      } else if (response.status === 404) {
        console.log(`❌ ${route.name}: Route not found`);
      } else {
        console.log(`✅ ${route.name}: Route exists (status: ${response.status})`);
      }
    } catch (error) {
      console.log(`❌ ${route.name}: Error - ${error.message}`);
    }
  }

  console.log('\n🎉 Email route testing complete!');
};

testRoutes().catch(console.error); 