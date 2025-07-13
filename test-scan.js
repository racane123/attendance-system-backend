// Test file for scan functionality
// Run this with: node test-scan.js

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api';

// Test data
const testData = {
    subject_id: 1, // Assuming you have a subject with ID 1
    qr_code: 'test-qr-code-123', // This should match a student's QR code in your database
    date: new Date().toISOString().split('T')[0] // Today's date
};

async function testScanFunctionality() {
    console.log('🧪 Testing Attendance Scanner API\n');

    try {
        // 1. Check if scan router is working
        console.log('1. Testing scan router health check...');
        const healthResponse = await fetch(`${BASE_URL}/scan`);
        const healthData = await healthResponse.json();
        console.log('✅ Health check:', healthData.message);
        console.log('Available endpoints:', Object.keys(healthData.endpoints).length);
        console.log('');

        // 2. Get today's attendance overview
        console.log('2. Getting today\'s attendance overview...');
        const todayResponse = await fetch(`${BASE_URL}/scan/today`);
        const todayData = await todayResponse.json();
        console.log('✅ Today\'s attendance:', todayData.data);
        console.log('');

        // 3. Get active sessions
        console.log('3. Checking for active sessions...');
        const activeSessionsResponse = await fetch(`${BASE_URL}/scan/session/active`);
        const activeSessionsData = await activeSessionsResponse.json();
        console.log('✅ Active sessions:', activeSessionsData.data);
        console.log('');

        // 4. Start a new session (if no active session exists)
        if (activeSessionsData.data.length === 0) {
            console.log('4. Starting a new scanning session...');
            const startSessionResponse = await fetch(`${BASE_URL}/scan/session/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subject_id: testData.subject_id
                })
            });
            const startSessionData = await startSessionResponse.json();
            console.log('✅ Session started:', startSessionData.message);
            console.log('Session ID:', startSessionData.data.id);
            console.log('');
        } else {
            console.log('4. Active session already exists, skipping session start');
            console.log('');
        }

        // 5. Test QR code scanning (this will fail if no student with that QR code exists)
        console.log('5. Testing QR code scan...');
        const scanResponse = await fetch(`${BASE_URL}/scan/scan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                qr_code: testData.qr_code,
                subject_id: testData.subject_id
            })
        });
        const scanData = await scanResponse.json();
        
        if (scanData.success) {
            console.log('✅ Scan successful:', scanData.message);
            const student = scanData.data.student;
            const fullName = `${student.first_name} ${student.middle_name ? student.middle_name + ' ' : ''}${student.last_name}`;
            console.log('Student:', fullName);
            console.log('Attendance recorded at:', scanData.data.attendance.time_in);
        } else {
            console.log('❌ Scan failed:', scanData.error);
            console.log('This is expected if no student exists with the test QR code');
        }
        console.log('');

        // 6. Get attendance records for today
        console.log('6. Getting attendance records for today...');
        const attendanceResponse = await fetch(`${BASE_URL}/scan/attendance/${testData.subject_id}/${testData.date}`);
        const attendanceData = await attendanceResponse.json();
        console.log('✅ Attendance records:', attendanceData.data);
        console.log('');

        // 7. Get attendance summary
        console.log('7. Getting attendance summary...');
        const summaryResponse = await fetch(`${BASE_URL}/scan/attendance/summary/${testData.subject_id}`);
        const summaryData = await summaryResponse.json();
        console.log('✅ Attendance summary:', summaryData.data);
        console.log('');

        console.log('🎉 All tests completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\nMake sure:');
        console.log('1. Your server is running on port 5000');
        console.log('2. Your database is connected and has data');
        console.log('3. You have at least one subject in the subjects table');
        console.log('4. You have at least one student in the students table');
    }
}

// Instructions for manual testing
console.log('📋 Manual Testing Instructions:');
console.log('');
console.log('1. Start your server: npm start');
console.log('2. Make sure you have data in your database:');
console.log('   - At least one subject in the subjects table');
console.log('   - At least one student in the students table');
console.log('3. Update the testData object above with real values from your database');
console.log('4. Run this test: node test-scan.js');
console.log('');
console.log('📚 API Endpoints to test manually:');
console.log('');
console.log('Session Management:');
console.log('  POST /api/scan/session/start - Start scanning session');
console.log('  PUT /api/scan/session/end/:id - End scanning session');
console.log('  GET /api/scan/session/active - Get active sessions');
console.log('');
console.log('QR Code Scanning:');
console.log('  POST /api/scan/scan - Process QR code scan');
console.log('');
console.log('Attendance Records:');
console.log('  GET /api/scan/attendance/:subject_id/:date - Get attendance for date');
console.log('  GET /api/scan/attendance/summary/:subject_id - Get attendance summary');
console.log('  PUT /api/scan/attendance/:id - Update attendance status');
console.log('  DELETE /api/scan/attendance/:id - Delete attendance record');
console.log('');
console.log('Utility:');
console.log('  GET /api/scan/today - Get today\'s attendance overview');
console.log('');

// Uncomment the line below to run the test
// testScanFunctionality(); 