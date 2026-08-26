/**
 * softwareRoutes.js — Software Upload and Download Routes
 *
 * Routes:
 *   GET  /api/software/download        — Download the latest software version
 *   POST /api/admin/software/upload    — Upload a new software version (Admin only)
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const adminAuth = require('../middleware/adminAuth');
const { adminLimiter } = require('../middleware/rateLimiter');

// Determine upload directory based on environment.
// Vercel's /var/task is read-only; use /tmp there (ephemeral but writable).
// On Railway / VPS / local, use a persistent uploads/ directory.
const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const uploadDir = isServerless
  ? path.join('/tmp', 'uploads', 'software')
  : path.join(process.cwd(), 'uploads', 'software');

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.error('Failed to create upload directory:', err.message);
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Add timestamp to ensure unique filenames and easy sorting
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'microlab-pro-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

/**
 * GET /api/software/download
 * Public route to download the latest software version.
 */
router.get('/download', (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir);
    if (files.length === 0) {
      return res.status(404).json({ error: 'No software available for download.' });
    }

    // Map files to their stats and sort by creation/modification time descending (newest first)
    const fileStats = files.map(file => {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);
      return { file, filePath, time: stats.mtime.getTime() };
    }).sort((a, b) => b.time - a.time);

    const latestFile = fileStats[0];
    
    // Serve the file as a download
    res.download(latestFile.filePath, 'MicroLab_Pro_Setup' + path.extname(latestFile.file), (err) => {
      if (err) {
        console.error('Download error:', err);
        // Only send response if headers have not been sent yet
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download file.' });
        }
      }
    });

  } catch (err) {
    console.error('Get download error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/admin/software/upload
 * Admin route to upload a new software version.
 * Keeps only the latest 3 versions.
 */
router.post('/upload', adminAuth, adminLimiter, upload.single('softwareFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Clean up old files, keeping only the 3 most recent
    const files = fs.readdirSync(uploadDir);
    
    const fileStats = files.map(file => {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);
      return { file, filePath, time: stats.mtime.getTime() };
    }).sort((a, b) => b.time - a.time); // newest first

    // If we have more than 3 files, delete the older ones
    if (fileStats.length > 3) {
      const filesToDelete = fileStats.slice(3);
      for (const fileObj of filesToDelete) {
        try {
          fs.unlinkSync(fileObj.filePath);
          console.log(`Deleted old software version: ${fileObj.file}`);
        } catch (unlinkErr) {
          console.error(`Failed to delete old file ${fileObj.file}:`, unlinkErr);
        }
      }
    }

    return res.json({ 
      success: true, 
      message: 'File uploaded successfully',
      file: req.file.filename
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
