const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const SystemSettings = require('../models/SystemSettings');
const { protect, admin } = require('../middleware/authMiddleware');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../sound-effect');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `custom-sound-${Date.now()}${path.extname(file.originalname)}`);
  }
});

// Audio file filter
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an audio file!'), false);
  }
};

const upload = multer({ storage, fileFilter });

// GET /api/settings (Publicly accessible to fetch global sounds)
router.get('/', async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// PUT /api/settings (Protected by admin middleware)
router.put('/', protect, admin, async (req, res) => {
  try {
    const { newMessageSound, sendMessageSound, deleteMessageSound } = req.body;
    let settings = await SystemSettings.getSettings();
    
    if (newMessageSound) settings.newMessageSound = newMessageSound;
    if (sendMessageSound) settings.sendMessageSound = sendMessageSound;
    if (deleteMessageSound) settings.deleteMessageSound = deleteMessageSound;
    
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// POST /api/settings/upload-sound (Protected by admin middleware)
router.post('/upload-sound', protect, admin, upload.single('sound'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded or invalid format' });
  }
  // Return the public URL
  const fileUrl = `/sound-effect/${req.file.filename}`;
  res.json({ url: fileUrl });
});

module.exports = router;
