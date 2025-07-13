# Database Setup Guide

## Quick Setup

### 1. Create Database
First, create a PostgreSQL database:
```bash
createdb attendance_checker
```

### 2. Set Environment Variables
Create a `.env` file in the backend directory:
```env
DB_USER=your_username
DB_HOST=localhost
DB_NAME=attendance_checker
DB_PASSWORD=your_password
DB_PORT=5432
```

### 3. Run Database Setup
```bash
# Navigate to backend directory
cd backend

# Run the complete setup script
psql -d attendance_checker -f database/setup-database.sql
```

## Alternative Setup Methods

### Option A: Using the original schema (if you prefer)
```bash
psql -d attendance_checker -f database/schema.sql
```

### Option B: Step by step setup
```bash
# 1. Create tables
psql -d attendance_checker -f database/schema.sql

# 2. Add sample data manually
psql -d attendance_checker -c "INSERT INTO students (student_id, first_name, middle_name, last_name, email, qr_code) VALUES ('STU001', 'John', 'Michael', 'Doe', 'john.doe@email.com', 'qr-john-doe-001');"
```

## Verify Setup

After running the setup, you should see:
- 5 subjects (Mathematics, Physics, Computer Science, English, History)
- 10 sample students with first, middle, and last names
- All tables created successfully

## Testing the API

Once the database is set up, you can test the API:

1. Start the server:
```bash
npm start
```

2. Test the endpoints:
```bash
# Get all students
curl http://localhost:5000/api/students

# Get all subjects
curl http://localhost:5000/api/subjects

# Test scan functionality
curl http://localhost:5000/api/scan
```

## Sample Data

The setup includes these sample students:
- John Michael Doe (STU001)
- Jane Smith (STU002)
- Robert James Johnson (STU003)
- Emily Grace Williams (STU004)
- Michael Brown (STU005)
- Sarah Elizabeth Davis (STU006)
- David William Miller (STU007)
- Lisa Wilson (STU008)
- James Thomas Taylor (STU009)
- Amanda Rose Anderson (STU010)

And these subjects:
- Mathematics (MATH101)
- Physics (PHY101)
- Computer Science (CS101)
- English (ENG101)
- History (HIST101) 