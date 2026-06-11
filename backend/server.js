const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
const server = http.createServer(app);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure ultra-permissive CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  
  const requestHeaders = req.headers['access-control-request-headers'];
  if (requestHeaders) {
    res.setHeader('Access-Control-Allow-Headers', requestHeaders);
  } else {
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight OPTIONS requests immediately
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.get('/api/widgets/:widgetId', require('./controllers/authController').getWidgetPublic);
app.post('/api/widgets/:widgetId/offline-message', require('./controllers/authController').postOfflineMessage);

// Serve static files from uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve static files from sound-effect folder
app.use('/sound-effect', express.static(path.join(__dirname, 'sound-effect')));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/live-chat-system')
  .then(() => {
    console.log('Connected to MongoDB');
  }).catch(err => {
    console.error('MongoDB connection error:', err);
  });

// Socket.io setup with fully open CORS
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow all origins dynamically
      callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});
app.set('io', io);

require('./sockets/chatSocket')(io, app);

// Default Route
app.get('/', (req, res) => {
  res.send('Live Chat System API is running.');
});

// Global Error Handler (to catch Multer/Server errors and return JSON with proper CORS headers)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


