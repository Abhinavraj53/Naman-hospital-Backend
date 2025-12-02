const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/database');
const paymentsController = require('./controllers/payments');

// Load env vars
dotenv.config();

// Connect to database (non-blocking)
connectDB().catch(err => {
  console.error('⚠️  Failed to connect to database:', err.message);
  console.error('⚠️  Server will continue running but database operations will fail.');
  console.error('⚠️  Please check your MongoDB connection and IP whitelist.');
  // Don't exit - allow server to run even without DB connection
  // This helps with development and debugging
});

const app = express();

// CORS configuration
const rawOrigins =
  process.env.FRONTEND_URLS ||
  process.env.FRONTEND_URL ||
  'http://localhost:3000,http://localhost:5173,https://localhost:5173';
const normalizeOrigin = origin => origin.replace(/\/$/, '');

// Parse allowed origins
let allowedOrigins = rawOrigins
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)
  .map(normalizeOrigin);

// Always include localhost origins for development
const devOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://localhost:5173'
];
devOrigins.forEach(origin => {
  if (!allowedOrigins.includes(origin)) {
    allowedOrigins.push(origin);
  }
});

// Log allowed origins in development
if (process.env.NODE_ENV === 'development') {
  console.log('🌐 Allowed CORS origins:', allowedOrigins);
}

const corsOptions = {
  origin(origin, callback) {
    // Log all CORS requests for debugging
    console.log(`🔍 CORS request from origin: ${origin || 'no-origin'}`);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('✅ CORS: Allowing request with no origin');
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);
    
    // Check if origin is explicitly allowed
    if (allowedOrigins.includes(normalizedOrigin)) {
      console.log(`✅ CORS: Origin "${origin}" is in allowed list`);
      callback(null, true);
      return;
    }

    // Allow localhost origins for development (even if not in FRONTEND_URLS)
    // This helps when developing locally against a deployed backend
    if (normalizedOrigin.startsWith('http://localhost:') || 
        normalizedOrigin.startsWith('https://localhost:')) {
      console.log(`✅ CORS: Allowing localhost origin for development: ${origin}`);
      callback(null, true);
      return;
    }

    // Reject all other origins
    console.warn(`⚠️  CORS: Origin "${origin}" not allowed. Allowed origins:`, allowedOrigins);
    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Authorization'],
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};


// CORS Middleware - Must be first!
// Apply CORS to all routes
app.use(cors(corsOptions));

// Handle preflight requests explicitly for all routes
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  
  // Check if origin should be allowed
  if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  } else {
    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalizedOrigin) || 
        normalizedOrigin.startsWith('http://localhost:') || 
        normalizedOrigin.startsWith('https://localhost:')) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.sendStatus(200);
});

app.post('/api/payments/cashfree-webhook', express.raw({ type: 'application/json' }), paymentsController.cashfreeWebhook);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/blog', require('./routes/blog'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/payments', require('./routes/payments'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Naman Hospital API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // If it's a CORS error, ensure proper headers are set
  if (err.message && err.message.includes('CORS')) {
    const origin = req.headers.origin;
    if (origin && (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:'))) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
  }
  
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Updated PORT to avoid macOS conflicts
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please use a different port.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
