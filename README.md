# Attendance Checker Backend

## Overview

This is the backend for the Attendance Checker System, a Node.js/Express application with PostgreSQL for managing student attendance, subjects, users, and automated email notifications. It provides a RESTful API for authentication, attendance scanning, student and subject management, and a robust email notification system with scheduled and manual triggers.

---

## Features

- User authentication (JWT-based, roles: admin, teacher, viewer)
- Student and subject management
- Attendance tracking via QR code scanning
- Email notification system (attendance reports, daily/weekly summaries, custom notifications)
- Email history and user preferences management
- Scheduled email jobs (daily/weekly summaries)
- API endpoints for all major operations

---

## Getting Started

### Prerequisites
- Node.js (v16+ recommended)
- PostgreSQL

### Installation
1. Clone the repository and navigate to the backend folder:
   ```bash
   git clone <repo-url>
   cd Attendance Checker/backend
   npm install
   ```
2. Copy the example environment file and fill in your values:
   ```bash
   cp env.example .env
   # Edit .env with your database, email, and JWT settings
   ```

---

## Environment Variables
See `env.example` for all options. Key variables:

```env
# Database (choose one method)
DATABASE_URL=postgresql://...      # Supabase/Postgres URL (recommended)
# OR use individual DB vars:
# DB_USER=your_username
# DB_HOST=localhost
# DB_NAME=attendance_checker
# DB_PASSWORD=your_password
# DB_PORT=5432

# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# Email (Gmail SMTP example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Server
PORT=5000
NODE_ENV=production
ALLOWED_ORIGINS=https://your-frontend-domain.onrender.com,http://localhost:3000
```

---

## Database Setup

See [`database/README.md`](database/README.md) for full details.

Quick setup:
```bash
createdb attendance_checker
psql -d attendance_checker -f database/setup-database.sql
```

Sample data (students, subjects) is included in the setup script.

---

## Running the Server

```bash
npm start      # Production
npm run dev    # Development (with nodemon)
```

---

## API Endpoints

### Authentication
- `POST /api/auth/login` — Login and receive JWT
- `POST /api/auth/register` — Register new user (admin only)

### Students
- `GET /api/students` — List all students
- `POST /api/students` — Add student
- ... (other CRUD endpoints)

### Subjects
- `GET /api/subjects` — List all subjects
- `POST /api/subjects` — Add subject
- ... (other CRUD endpoints)

### Attendance & Scanning
- `POST /api/scan/session/start` — Start scanning session
- `PUT /api/scan/session/end/:id` — End session
- `GET /api/scan/session/active` — List active sessions
- `POST /api/scan/scan` — Process QR scan
- `GET /api/scan/attendance/:subject_id/:date` — Attendance for subject/date
- `GET /api/scan/today` — Today's attendance overview

### Email System
- `POST /api/email/test` — Test email config
- `POST /api/email/attendance-report` — Send attendance report
- `POST /api/email/daily-summary` — Send daily summary
- `POST /api/email/notification` — Send custom notification
- `POST /api/email/send-daily-summary` — Send daily summary to all
- `POST /api/email/send-weekly-summary` — Send weekly summary to all
- `POST /api/email/send-subject-report` — Send subject report to all
- `POST /api/email/trigger-daily` — Manually trigger daily summary
- `POST /api/email/trigger-weekly` — Manually trigger weekly summary

### Email Management
- `GET /api/email-management/history` — Email history (admin)
- `GET /api/email-management/stats` — Email stats (admin)
- `GET /api/email-management/preferences` — Get user preferences
- `PUT /api/email-management/preferences` — Update preferences
- `PUT /api/email-management/preferences/bulk` — Bulk update

---

## Scheduled Jobs
- Daily summary: 6:00 PM (Asia/Manila timezone)
- Weekly summary: Sundays at 6:00 PM

---

## Testing
- Run email system test: `node test-email.js`
- Run scan test: `node test-scan.js`
- Test endpoints with curl or Postman (see API section)

---

## License
ISC

---

## Acknowledgments
- See `EMAIL_SYSTEM_README.md` for advanced email features and troubleshooting.
- See `database/README.md` for database schema and sample data.
