import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api';

const testStudentAttendanceEmail = async () => {
  console.log('🧪 Testing Student Attendance Email...\n');

  try {
    // First, let's get a list of students and subjects to test with
    const studentsResponse = await fetch(`${BASE_URL}/students`);
    const subjectsResponse = await fetch(`${BASE_URL}/subjects`);

    if (!studentsResponse.ok || !subjectsResponse.ok) {
      console.log('❌ Failed to fetch students or subjects');
      return;
    }

    const students = await studentsResponse.json();
    const subjects = await subjectsResponse.json();

    if (students.data.length === 0 || subjects.data.length === 0) {
      console.log('❌ No students or subjects found in database');
      return;
    }

    const student = students.data[0];
    const subject = subjects.data[0];
    const today = new Date().toISOString().split('T')[0];

    console.log(`📧 Testing with:`);
    console.log(`   Student: ${student.first_name} ${student.last_name} (${student.email})`);
    console.log(`   Subject: ${subject.name} (${subject.code})`);
    console.log(`   Date: ${today}\n`);

    // Test the student attendance email endpoint
    const testData = {
      studentId: student.id,
      subjectId: subject.id,
      date: today
    };

    console.log('📤 Sending test student attendance email...');
    
    const response = await fetch(`${BASE_URL}/email/test-student-attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczNDU2NzIwMCwiZXhwIjoxNzM0NjUzNjAwfQ.example' // This is a dummy token - you'll need to login first
      },
      body: JSON.stringify(testData)
    });

    if (response.status === 401) {
      console.log('❌ Authentication required. Please login first to get a valid token.');
      console.log('💡 You can test this by:');
      console.log('   1. Starting the frontend: cd frontend && npm start');
      console.log('   2. Login to the system');
      console.log('   3. Use the browser to test the email functionality');
      return;
    }

    const result = await response.json();

    if (result.success) {
      console.log('✅ Student attendance email sent successfully!');
      console.log(`   Message ID: ${result.messageId}`);
      console.log(`   Sent to: ${result.data.studentEmail}`);
    } else {
      console.log('❌ Failed to send student attendance email:');
      console.log(`   Error: ${result.error}`);
    }

  } catch (error) {
    console.log('❌ Test failed with error:', error.message);
  }

  console.log('\n🎉 Student attendance email test completed!');
};

testStudentAttendanceEmail(); 