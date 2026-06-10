const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const path = require('path');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
const server = http.createServer(app);

app.use(cors());
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

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
app.set('io', io);

require('./sockets/chatSocket')(io, app);

// Routes
app.get('/', (req, res) => {
  res.send('Live Chat System API is running.');
});

// Trigger reload 3
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

