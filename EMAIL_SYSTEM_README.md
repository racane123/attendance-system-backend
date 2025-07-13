# 📧 Email Notification System

This document describes the comprehensive email notification system implemented in the Attendance Management System.

## 🚀 Features

### 1. **Email Templates**
- **Attendance Report** (`attendance-report.hbs`) - Detailed attendance reports for specific subjects
- **Daily Summary** (`daily-summary.hbs`) - Daily attendance summaries across all subjects
- **Notification** (`notification.hbs`) - Custom notifications
- **Welcome Email** (`welcome.hbs`) - Welcome emails for new users

### 2. **Email Types**
- **Attendance Reports** - Subject-specific attendance reports
- **Daily Summaries** - Daily overview of all subjects
- **Weekly Summaries** - Weekly attendance overview
- **Custom Notifications** - Admin-sent notifications
- **Welcome Emails** - New user onboarding

### 3. **Email History Tracking**
- All sent emails are tracked in the database
- Includes success/failure status
- Metadata storage for detailed tracking
- User association for audit trails

### 4. **User Preferences**
- Users can enable/disable specific email types
- Frequency settings (daily, weekly, monthly, never)
- Bulk preference management

### 5. **Scheduled Emails**
- Automatic daily summaries at 6:00 PM
- Weekly summaries every Sunday at 6:00 PM
- Configurable timezone support

## 🔧 Configuration

### Environment Variables
Add these to your `.env` file:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Test email (optional)
TEST_EMAIL=test@example.com
```

### Gmail Setup
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password
3. Use the App Password in `SMTP_PASS`

## 📊 API Endpoints

### Email Sending
- `POST /api/email/test` - Test email configuration
- `POST /api/email/attendance-report` - Send attendance report
- `POST /api/email/daily-summary` - Send daily summary
- `POST /api/email/notification` - Send custom notification

### Scheduled Emails
- `POST /api/email/send-daily-summary` - Send daily summary to all users
- `POST /api/email/send-weekly-summary` - Send weekly summary to all users
- `POST /api/email/send-subject-report` - Send subject report to all users

### Manual Triggers (Testing)
- `POST /api/email/trigger-daily` - Manually trigger daily summary
- `POST /api/email/trigger-weekly` - Manually trigger weekly summary

### Email Management
- `GET /api/email-management/history` - Get email history (admin)
- `GET /api/email-management/stats` - Get email statistics (admin)
- `GET /api/email-management/preferences` - Get user preferences
- `PUT /api/email-management/preferences` - Update user preferences
- `PUT /api/email-management/preferences/bulk` - Bulk update preferences

## 🗄️ Database Schema

### Email History Table
```sql
CREATE TABLE email_history (
    id SERIAL PRIMARY KEY,
    recipient_email VARCHAR(100) NOT NULL,
    email_type VARCHAR(50) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'sent',
    sent_by INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Email Preferences Table
```sql
CREATE TABLE email_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    email_type VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    frequency VARCHAR(20) DEFAULT 'daily',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, email_type)
);
```

## 🧪 Testing

### Run Email System Test
```bash
node test-email.js
```

This will:
1. Test email configuration
2. Verify database connection
3. Send a test notification
4. Check email history tracking

### Manual Testing via API
```bash
# Test email configuration
curl -X POST http://localhost:5000/api/email/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Send test notification
curl -X POST http://localhost:5000/api/email/notification \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "test@example.com",
    "subject": "Test Notification",
    "message": "This is a test message"
  }'

# Trigger daily summary manually
curl -X POST http://localhost:5000/api/email/trigger-daily \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## 📅 Cron Jobs

The system automatically runs these scheduled tasks:

- **Daily Summary**: Every day at 6:00 PM (Asia/Manila timezone)
- **Weekly Summary**: Every Sunday at 6:00 PM

### Timezone Configuration
Update the timezone in `services/cronService.js`:
```javascript
timezone: "Asia/Manila" // Change to your timezone
```

## 🔍 Monitoring

### Email Statistics
Access email statistics via API:
```bash
curl -X GET "http://localhost:5000/api/email-management/stats?days=30" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Email History
View email history with pagination:
```bash
curl -X GET "http://localhost:5000/api/email-management/history?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🛠️ Troubleshooting

### Common Issues

1. **SMTP Authentication Failed**
   - Verify Gmail App Password is correct
   - Ensure 2FA is enabled on Gmail account

2. **Emails Not Sending**
   - Check SMTP configuration in `.env`
   - Verify network connectivity
   - Check email history for error details

3. **Cron Jobs Not Running**
   - Verify server timezone settings
   - Check server logs for cron job errors
   - Use manual trigger endpoints for testing

### Debug Mode
Enable detailed logging by adding to your `.env`:
```env
DEBUG_EMAIL=true
```

## 📈 Future Enhancements

- [ ] Email templates customization
- [ ] Advanced scheduling options
- [ ] Email analytics dashboard
- [ ] Bulk email campaigns
- [ ] Email queue management
- [ ] Template preview functionality

## 📞 Support

For issues with the email system:
1. Check the email history table for error details
2. Verify SMTP configuration
3. Test with the provided test script
4. Review server logs for detailed error messages 