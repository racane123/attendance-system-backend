import express from "express";
import dotenv from 'dotenv';
import cors from 'cors';
import { initializeCronJobs } from './services/cronService.js';

//internal imports
import scanRouter from "./router/scan.js";
import studentRouter from "./router/student.js";
import subjectRouter from "./router/subject.js";
import authRouter from "./router/auth.js";
import emailRouter from "./router/email.js";
import emailManagementRouter from "./router/emailManagement.js";
import enrollmentRouter from "./router/enrollment.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

// Trust proxy for ngrok compatibility
app.set('trust proxy', 1);

//middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow ngrok URLs and localhost
    const allowedOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      /^https:\/\/.*\.ngrok\.io$/,
      /^https:\/\/.*\.ngrok-free\.app$/,
      /^https:\/\/.*\.ngrok\.app$/,
      'https://e586-136-158-39-55.ngrok-free.app',
      'https://caa9-136-158-39-55.ngrok-free.app',
      'https://687425591349dd0008e4a0b7--visionary-salmiakki-588f3d.netlify.app/',
      'https://attendance-system-frontend-lake.vercel.app/'
    ];
    
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      }
      return allowedOrigin.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Routes
app.use("/api/auth", authRouter);
app.use("/api/scan", scanRouter);
app.use('/api/students', studentRouter);
app.use('/api/subjects', subjectRouter);
app.use('/api/email', emailRouter);
app.use('/api/email-management', emailManagementRouter);
app.use('/api/enrollments', enrollmentRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

//listen
app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
    
    // Initialize cron jobs after server starts
    initializeCronJobs();
});









