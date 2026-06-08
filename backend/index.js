import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const nodeEnv = process.env.NODE_ENV || 'development';

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
];
const configuredAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredAllowedOrigins]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS policy'));
  },
  credentials: true,
}));
app.use(express.json());

let dbStatus = 'disconnected';
let dbErrorMessage = null;

mongoose.connection.on('connected', () => {
  dbStatus = 'connected';
  dbErrorMessage = null;
});

mongoose.connection.on('disconnected', () => {
  dbStatus = 'disconnected';
});

mongoose.connection.on('error', (err) => {
  dbStatus = 'error';
  dbErrorMessage = err?.message || 'unknown database error';
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

if (process.env.MONGO_URI) {
  dbStatus = 'connecting';
  mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => {
    console.log('MongoDB connected');
    dbStatus = 'connected';
    dbErrorMessage = null;
  }).catch((err) => {
    console.error('MongoDB connection failed. Running without database:', err.message);
    dbStatus = 'error';
    dbErrorMessage = err.message;
  });
} else {
  console.warn('MONGO_URI is not set. Running without database connection.');
  dbStatus = 'disconnected';
}

// Placeholder route
app.get('/', (req, res) => {
  res.send('Bro Liquidity API is running');
});

// Liveness endpoint for infrastructure checks.
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      error: dbErrorMessage,
    },
  });
});

// Readiness endpoint that fails if database is required but unavailable.
app.get('/readyz', (req, res) => {
  const requiresDatabase = Boolean(process.env.MONGO_URI);
  const databaseReady = !requiresDatabase || dbStatus === 'connected';

  if (!databaseReady) {
    res.status(503).json({
      status: 'not_ready',
      environment: nodeEnv,
      database: {
        required: requiresDatabase,
        status: dbStatus,
        error: dbErrorMessage,
      },
    });
    return;
  }

  res.status(200).json({
    status: 'ready',
    environment: nodeEnv,
    database: {
      required: requiresDatabase,
      status: dbStatus,
    },
  });
});
