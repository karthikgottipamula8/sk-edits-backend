import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import projectRoutes from './routes/projects.js';
import chatRoutes from './routes/chat.js';
import paymentRoutes from './routes/payments.js';
import analyticsRoutes from './routes/analytics.js';

dotenv.config();

const app = express();

// --- DYNAMIC CORS CONFIGURATION ---
const rawOrigins = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
].filter(Boolean);

const allowedOrigins = rawOrigins.flatMap(o => o.split(',').map(s => s.trim()));

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (Postman, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    // Explicitly allowed origin
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow any *.vercel.app domain (supports all Vercel previews & production)
    try {
      const parsed = new URL(origin);
      if (
        parsed.hostname.endsWith('.vercel.app') ||
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1'
      ) {
        return callback(null, true);
      }
    } catch (_) {}

    // Allow during non-production or if permissive flag is set
    if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_ALL_ORIGINS === 'true') {
      return callback(null, true);
    }

    return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 204
};

// Middlewares
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploads directory (Vercel serverless has read-only filesystem except /tmp)
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadsDir = isVercel
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(process.cwd(), 'public', 'uploads');

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.warn('Notice: Uploads directory initialization:', e.message);
}
app.use('/uploads', express.static(uploadsDir));

// --- HEALTH CHECK ENDPOINTS ---
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SK Edits backend is running'
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SK Edits backend is running'
  });
});

// --- API ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);

// --- 404 NOT FOUND HANDLER ---
app.use((req, res) => {
  res.status(404).json({
    error: `Cannot ${req.method} ${req.originalUrl || req.url}`
  });
});

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error('Server error:', err.message || err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error.'
  });
});

export default app;
