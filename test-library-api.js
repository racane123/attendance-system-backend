import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_BASE_URL = 'http://localhost:5001/api';

// Test authentication first
async function testAuth() {
  try {
    console.log('🔐 Testing authentication...');
    
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    if (loginResponse.data.success) {
      console.log('✅ Authentication successful');
      return loginResponse.data.data.token;
    } else {
      console.log('❌ Authentication failed');
      return null;
    }
  } catch (error) {
    console.error('❌ Authentication error:', error.response?.data || error.message);
    return null;
  }
}

// Test library endpoints
async function testLibraryEndpoints(token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  
  const endpoints = [
    { name: 'Books', url: '/library/books', method: 'GET' },
    { name: 'Genres', url: '/library/genres', method: 'GET' },
    { name: 'Borrowings', url: '/library/borrowings', method: 'GET' },
    { name: 'Stats', url: '/library/admin/stats', method: 'GET' }
  ];
  
  console.log('\n📚 Testing library endpoints...');
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios({
        method: endpoint.method,
        url: `${API_BASE_URL}${endpoint.url}`,
        headers
      });
      
      console.log(`✅ ${endpoint.name}: ${response.status} - ${response.data.length || 'OK'}`);
    } catch (error) {
      console.log(`❌ ${endpoint.name}: ${error.response?.status || 'Error'} - ${error.response?.data?.error || error.message}`);
    }
  }
}

// Test database connection
async function testDatabaseConnection() {
  try {
    console.log('\n🗄️ Testing database connection...');
    
    const response = await axios.get(`${API_BASE_URL}/library/books`);
    
    if (response.status === 200) {
      console.log('✅ Database connection successful');
      console.log(`📊 Found ${response.data.length} books`);
    } else {
      console.log('❌ Database connection failed');
    }
  } catch (error) {
    console.log('❌ Database connection error:', error.response?.data?.error || error.message);
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting library API tests...\n');
  
  // Test database connection
  await testDatabaseConnection();
  
  // Test authentication
  const token = await testAuth();
  
  // Test library endpoints
  await testLibraryEndpoints(token);
  
  console.log('\n🎉 Tests completed!');
}

runTests().catch(console.error); 