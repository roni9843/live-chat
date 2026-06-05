const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Directory where files will be saved
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB limit
});

// POST /api/upload
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Construct URL for the uploaded file
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  
  // Determine simple type for UI
  const ext = path.extname(req.file.filename).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  const isAudio = ['.webm', '.mp3', '.wav', '.ogg', '.m4a', '.mp4'].includes(ext) || (req.file.mimetype && req.file.mimetype.startsWith('audio/'));
  const fileType = isImage ? 'image' : (isAudio ? 'audio' : 'file');

  res.json({
    success: true,
    fileUrl,
    fileType,
    fileName: req.file.originalname
  });
});

module.exports = router;
